use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, image::Image};

static MINIMIZE_TO_TRAY: AtomicBool = AtomicBool::new(true);

pub fn should_minimize_to_tray() -> bool {
    MINIMIZE_TO_TRAY.load(Ordering::SeqCst)
}

/// Generate a filled circle icon from raw RGBA data.
fn create_circle_icon(r: u8, g: u8, b: u8, glow: bool) -> Image<'static> {
    let size: u32 = 32;
    let center = size as f32 / 2.0;
    let radius = center - 2.0;
    let mut data = vec![0u8; (size * size * 4) as usize];
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - center;
            let dy = y as f32 - center;
            let dist = (dx * dx + dy * dy).sqrt();
            let idx = ((y * size + x) * 4) as usize;
            if dist <= radius {
                let edge_alpha = ((radius - dist).min(1.0) * 255.0) as u8;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = edge_alpha;
            } else if glow && dist <= radius + 3.0 {
                let glow_alpha = ((1.0 - (dist - radius) / 3.0) * 100.0) as u8;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = glow_alpha;
            }
        }
    }
    Image::new_owned(data, size, size)
}

#[tauri::command]
pub fn set_minimize_to_tray(enabled: bool) {
    MINIMIZE_TO_TRAY.store(enabled, Ordering::SeqCst);
}

#[tauri::command]
pub fn update_tray_icon(app: AppHandle, state: String) {
    let Some(tray) = app.tray_by_id("main") else { return };
    match state.as_str() {
        "in_call" => {
            let icon = create_circle_icon(48, 209, 88, false);
            let _ = tray.set_icon(Some(icon));
            let _ = tray.set_tooltip(Some("ZeusIX — In Call"));
        }
        "speaking" => {
            let icon = create_circle_icon(100, 255, 130, true);
            let _ = tray.set_icon(Some(icon));
            let _ = tray.set_tooltip(Some("ZeusIX — Speaking"));
        }
        _ => {
            if let Some(icon) = app.default_window_icon().cloned() {
                let _ = tray.set_icon(Some(icon));
            }
            let _ = tray.set_tooltip(Some("ZeusIX"));
        }
    }
}
