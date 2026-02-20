/// Native screen capture with JPEG frame buffer.
///
/// Architecture:
///   1. Enumerate monitors/windows → return JSON to frontend for custom picker
///   2. JS starts native capture via Tauri command
///   3. windows-capture handler converts RGBA → RGB → JPEG → shared buffer
///   4. JS polls get_capture_frame() to get latest JPEG as raw binary (ArrayBuffer)
///   5. JS creates MediaStream from canvas, publishes via LiveKit JS client
///
/// No custom protocol (avoids WebView2 memory leak), no libwebrtc in Rust.

#[cfg(target_os = "windows")]
mod inner {
    use image::codecs::jpeg::JpegEncoder;
    use image::ImageEncoder;
    use parking_lot::{Mutex, RwLock};
    use serde::Serialize;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, OnceLock};
    use tauri::ipc::Response as IpcResponse;

    use windows_capture::{
        capture::{CaptureControl, GraphicsCaptureApiHandler},
        frame::Frame,
        graphics_capture_api::InternalCaptureControl,
        monitor::Monitor,
        settings::{
            ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
            MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
        },
        window::Window,
    };

    // ── Shared state ──────────────────────────────────────────────────

    static CAPTURING: AtomicBool = AtomicBool::new(false);

    type FrameBuffer = Arc<Mutex<Option<Vec<u8>>>>;

    struct CaptureSession {
        capture_control: CaptureControl<Handler, Box<dyn std::error::Error + Send + Sync>>,
    }

    fn session_lock() -> &'static RwLock<Option<CaptureSession>> {
        static INSTANCE: OnceLock<RwLock<Option<CaptureSession>>> = OnceLock::new();
        INSTANCE.get_or_init(|| RwLock::new(None))
    }

    fn frame_buffer() -> &'static FrameBuffer {
        static INSTANCE: OnceLock<FrameBuffer> = OnceLock::new();
        INSTANCE.get_or_init(|| Arc::new(Mutex::new(None)))
    }

    // ── Serializable types for frontend ───────────────────────────────

    #[derive(Serialize, Clone)]
    pub struct MonitorInfo {
        pub index: usize,
        pub name: String,
        pub device_name: String,
        pub width: u32,
        pub height: u32,
        pub refresh_rate: u32,
    }

    #[derive(Serialize, Clone)]
    pub struct WindowInfo {
        pub index: usize,
        pub title: String,
        pub process_name: String,
    }

    #[derive(Serialize, Clone)]
    #[serde(tag = "type")]
    pub enum CaptureSource {
        Monitor(MonitorInfo),
        Window(WindowInfo),
    }

    // ── Handler flags (passed to the capture thread) ──────────────────

    pub struct CaptureFlags {
        pub jpeg_quality: u8,
        pub buffer: FrameBuffer,
    }

    // ── The capture handler ───────────────────────────────────────────

    pub struct Handler {
        jpeg_quality: u8,
        buffer: FrameBuffer,
        rgb_buf: Vec<u8>,
        frame_count: u64,
        last_width: u32,
        last_height: u32,
    }

    impl GraphicsCaptureApiHandler for Handler {
        type Flags = CaptureFlags;
        type Error = Box<dyn std::error::Error + Send + Sync>;

        fn new(ctx: windows_capture::capture::Context<Self::Flags>) -> Result<Self, Self::Error> {
            eprintln!("[screencap] Capture handler created");
            Ok(Self {
                jpeg_quality: ctx.flags.jpeg_quality,
                buffer: ctx.flags.buffer,
                rgb_buf: Vec::new(),
                frame_count: 0,
                last_width: 0,
                last_height: 0,
            })
        }

        fn on_frame_arrived(
            &mut self,
            frame: &mut Frame,
            _capture_control: InternalCaptureControl,
        ) -> Result<(), Self::Error> {
            let width = frame.width();
            let height = frame.height();
            self.frame_count += 1;

            if width != self.last_width || height != self.last_height {
                self.last_width = width;
                self.last_height = height;
                eprintln!("[screencap] Resolution: {}x{}", width, height);
            }

            // Get raw RGBA pixels (without row padding)
            let mut fb = frame.buffer()?;
            let rgba = if fb.has_padding() {
                fb.as_nopadding_buffer()?
            } else {
                fb.as_raw_buffer()
            };

            // RGBA → RGB (optimized: pre-sized buffer + indexed writes)
            let pixel_count = (width * height) as usize;
            let expected_rgb = pixel_count * 3;
            self.rgb_buf.clear();
            self.rgb_buf.resize(expected_rgb, 0);
            let mut dst = 0;
            for chunk in rgba.chunks_exact(4) {
                self.rgb_buf[dst] = chunk[0];
                self.rgb_buf[dst + 1] = chunk[1];
                self.rgb_buf[dst + 2] = chunk[2];
                dst += 3;
            }

            // RGB → JPEG
            let mut jpeg_buf = Vec::with_capacity(expected_rgb / 4);
            {
                let encoder = JpegEncoder::new_with_quality(&mut jpeg_buf, self.jpeg_quality);
                encoder.write_image(
                    &self.rgb_buf,
                    width,
                    height,
                    image::ExtendedColorType::Rgb8,
                )?;
            }

            // Store in shared buffer
            *self.buffer.lock() = Some(jpeg_buf);

            if self.frame_count <= 5 {
                eprintln!(
                    "[screencap] Frame #{} encoded: {}x{}",
                    self.frame_count, width, height
                );
            }

            Ok(())
        }

        fn on_closed(&mut self) -> Result<(), Self::Error> {
            eprintln!(
                "[screencap] Capture closed after {} frames",
                self.frame_count
            );
            CAPTURING.store(false, Ordering::SeqCst);
            Ok(())
        }
    }

    // ── Tauri commands ────────────────────────────────────────────────

    #[tauri::command]
    pub fn enumerate_capture_sources() -> Result<Vec<CaptureSource>, String> {
        let mut sources: Vec<CaptureSource> = Vec::new();

        // Enumerate monitors
        if let Ok(monitors) = Monitor::enumerate() {
            for (i, mon) in monitors.iter().enumerate() {
                let name = mon.name().unwrap_or_else(|_| format!("Monitor {}", i + 1));
                let device_name = mon.device_name().unwrap_or_default();
                let width = mon.width().unwrap_or(0);
                let height = mon.height().unwrap_or(0);
                let refresh_rate = mon.refresh_rate().unwrap_or(0);

                sources.push(CaptureSource::Monitor(MonitorInfo {
                    index: i,
                    name,
                    device_name,
                    width,
                    height,
                    refresh_rate,
                }));
            }
        }

        // Enumerate windows
        if let Ok(windows) = Window::enumerate() {
            for (i, win) in windows.iter().enumerate() {
                if !win.is_valid() {
                    continue;
                }
                let title = win.title().unwrap_or_default();
                if title.is_empty() {
                    continue;
                }
                let process_name = win.process_name().unwrap_or_default();

                sources.push(CaptureSource::Window(WindowInfo {
                    index: i,
                    title,
                    process_name,
                }));
            }
        }

        Ok(sources)
    }

    #[tauri::command]
    pub fn start_capture(
        source_type: String,
        source_index: usize,
        fps: u32,
        jpeg_quality: u8,
    ) -> Result<(), String> {
        eprintln!(
            "[screencap] start_capture: type={}, index={}, fps={}, quality={}",
            source_type, source_index, fps, jpeg_quality
        );

        // Stop any existing capture
        stop_capture();

        let interval = if fps > 0 {
            std::time::Duration::from_millis(1000 / fps as u64)
        } else {
            std::time::Duration::from_millis(33)
        };

        let buffer = frame_buffer().clone();
        let flags = CaptureFlags {
            jpeg_quality,
            buffer,
        };

        let control = match source_type.as_str() {
            "monitor" => {
                let monitors = Monitor::enumerate().map_err(|e| e.to_string())?;
                let monitor = monitors
                    .into_iter()
                    .nth(source_index)
                    .ok_or_else(|| format!("Monitor index {} not found", source_index))?;

                let settings = Settings::new(
                    monitor,
                    CursorCaptureSettings::WithCursor,
                    DrawBorderSettings::WithoutBorder,
                    SecondaryWindowSettings::Default,
                    MinimumUpdateIntervalSettings::Custom(interval),
                    DirtyRegionSettings::Default,
                    ColorFormat::Rgba8,
                    flags,
                );

                Handler::start_free_threaded(settings).map_err(|e| e.to_string())?
            }
            "window" => {
                let windows = Window::enumerate().map_err(|e| e.to_string())?;
                let valid_windows: Vec<_> = windows
                    .into_iter()
                    .filter(|w| {
                        w.is_valid() && w.title().map(|t| !t.is_empty()).unwrap_or(false)
                    })
                    .collect();
                let window = valid_windows
                    .into_iter()
                    .nth(source_index)
                    .ok_or_else(|| format!("Window index {} not found", source_index))?;

                let settings = Settings::new(
                    window,
                    CursorCaptureSettings::WithCursor,
                    DrawBorderSettings::WithoutBorder,
                    SecondaryWindowSettings::Default,
                    MinimumUpdateIntervalSettings::Custom(interval),
                    DirtyRegionSettings::Default,
                    ColorFormat::Rgba8,
                    flags,
                );

                Handler::start_free_threaded(settings).map_err(|e| e.to_string())?
            }
            _ => return Err(format!("Unknown source type: {}", source_type)),
        };

        *session_lock().write() = Some(CaptureSession {
            capture_control: control,
        });
        CAPTURING.store(true, Ordering::SeqCst);
        eprintln!("[screencap] Capture started");

        Ok(())
    }

    #[tauri::command]
    pub fn stop_capture() {
        CAPTURING.store(false, Ordering::SeqCst);

        let session = session_lock().write().take();
        if let Some(s) = session {
            let _ = s.capture_control.stop();
            eprintln!("[screencap] Capture stopped");
        }

        // Clear frame buffer
        *frame_buffer().lock() = None;
    }

    #[tauri::command]
    pub fn get_capture_frame() -> IpcResponse {
        let buf = frame_buffer().lock();
        match buf.as_ref() {
            Some(jpeg) => IpcResponse::new(jpeg.clone()),
            None => IpcResponse::new(Vec::<u8>::new()),
        }
    }

    #[tauri::command]
    pub fn is_capturing() -> bool {
        CAPTURING.load(Ordering::SeqCst)
    }
}

// ── Re-export for non-Windows (stubs) ─────────────────────────────────
#[cfg(not(target_os = "windows"))]
mod inner {
    use serde::Serialize;
    use tauri::ipc::Response as IpcResponse;

    #[derive(Serialize, Clone)]
    #[serde(tag = "type")]
    pub enum CaptureSource {}

    #[tauri::command]
    pub fn enumerate_capture_sources() -> Result<Vec<CaptureSource>, String> {
        Err("Native screen capture is only available on Windows".into())
    }

    #[tauri::command]
    pub fn start_capture(
        _source_type: String,
        _source_index: usize,
        _fps: u32,
        _jpeg_quality: u8,
    ) -> Result<(), String> {
        Err("Native screen capture is only available on Windows".into())
    }

    #[tauri::command]
    pub fn stop_capture() {}

    #[tauri::command]
    pub fn get_capture_frame() -> IpcResponse {
        IpcResponse::new(Vec::<u8>::new())
    }

    #[tauri::command]
    pub fn is_capturing() -> bool {
        false
    }
}

pub use inner::*;
