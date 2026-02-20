use device_query::{DeviceQuery, DeviceState, Keycode};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Shared state for the PTT listener thread.
static RUNNING: AtomicBool = AtomicBool::new(false);

/// Store the target keycode so the polling thread knows what to watch.
static TARGET_KEY: Mutex<Option<Keycode>> = Mutex::new(None);

/// Map a JavaScript KeyboardEvent.code string to a device_query Keycode.
fn map_js_key(code: &str) -> Option<Keycode> {
    match code {
        // Letters
        "KeyA" => Some(Keycode::A),
        "KeyB" => Some(Keycode::B),
        "KeyC" => Some(Keycode::C),
        "KeyD" => Some(Keycode::D),
        "KeyE" => Some(Keycode::E),
        "KeyF" => Some(Keycode::F),
        "KeyG" => Some(Keycode::G),
        "KeyH" => Some(Keycode::H),
        "KeyI" => Some(Keycode::I),
        "KeyJ" => Some(Keycode::J),
        "KeyK" => Some(Keycode::K),
        "KeyL" => Some(Keycode::L),
        "KeyM" => Some(Keycode::M),
        "KeyN" => Some(Keycode::N),
        "KeyO" => Some(Keycode::O),
        "KeyP" => Some(Keycode::P),
        "KeyQ" => Some(Keycode::Q),
        "KeyR" => Some(Keycode::R),
        "KeyS" => Some(Keycode::S),
        "KeyT" => Some(Keycode::T),
        "KeyU" => Some(Keycode::U),
        "KeyV" => Some(Keycode::V),
        "KeyW" => Some(Keycode::W),
        "KeyX" => Some(Keycode::X),
        "KeyY" => Some(Keycode::Y),
        "KeyZ" => Some(Keycode::Z),
        // Digits
        "Digit0" => Some(Keycode::Key0),
        "Digit1" => Some(Keycode::Key1),
        "Digit2" => Some(Keycode::Key2),
        "Digit3" => Some(Keycode::Key3),
        "Digit4" => Some(Keycode::Key4),
        "Digit5" => Some(Keycode::Key5),
        "Digit6" => Some(Keycode::Key6),
        "Digit7" => Some(Keycode::Key7),
        "Digit8" => Some(Keycode::Key8),
        "Digit9" => Some(Keycode::Key9),
        // Function keys
        "F1" => Some(Keycode::F1),
        "F2" => Some(Keycode::F2),
        "F3" => Some(Keycode::F3),
        "F4" => Some(Keycode::F4),
        "F5" => Some(Keycode::F5),
        "F6" => Some(Keycode::F6),
        "F7" => Some(Keycode::F7),
        "F8" => Some(Keycode::F8),
        "F9" => Some(Keycode::F9),
        "F10" => Some(Keycode::F10),
        "F11" => Some(Keycode::F11),
        "F12" => Some(Keycode::F12),
        // Special keys
        "Space" => Some(Keycode::Space),
        "Tab" => Some(Keycode::Tab),
        "Enter" => Some(Keycode::Enter),
        "Escape" => Some(Keycode::Escape),
        "Backspace" => Some(Keycode::Backspace),
        "CapsLock" => Some(Keycode::CapsLock),
        // Modifiers (can be used as PTT keys)
        "ShiftLeft" | "ShiftRight" => Some(Keycode::LShift),
        "ControlLeft" | "ControlRight" => Some(Keycode::LControl),
        "AltLeft" | "AltRight" => Some(Keycode::LAlt),
        // Arrow keys
        "ArrowUp" => Some(Keycode::Up),
        "ArrowDown" => Some(Keycode::Down),
        "ArrowLeft" => Some(Keycode::Left),
        "ArrowRight" => Some(Keycode::Right),
        // Punctuation
        "Backquote" => Some(Keycode::Grave),
        "Minus" => Some(Keycode::Minus),
        "Equal" => Some(Keycode::Equal),
        "BracketLeft" => Some(Keycode::LeftBracket),
        "BracketRight" => Some(Keycode::RightBracket),
        "Backslash" => Some(Keycode::BackSlash),
        "Semicolon" => Some(Keycode::Semicolon),
        "Quote" => Some(Keycode::Apostrophe),
        "Comma" => Some(Keycode::Comma),
        "Period" => Some(Keycode::Dot),
        "Slash" => Some(Keycode::Slash),
        _ => None,
    }
}

/// Start a background thread that polls the keyboard for the PTT key.
/// Emits "ptt-press" and "ptt-release" events to the frontend.
#[tauri::command]
pub fn start_ptt_listener(app: AppHandle, key_code: String) {
    // Stop any existing listener first
    RUNNING.store(false, Ordering::SeqCst);
    // Brief sleep to let old thread notice and exit
    thread::sleep(Duration::from_millis(60));

    let target = match map_js_key(&key_code) {
        Some(k) => k,
        None => {
            eprintln!("[PTT] Cannot map key code: {}", key_code);
            return;
        }
    };

    *TARGET_KEY.lock().unwrap() = Some(target);
    RUNNING.store(true, Ordering::SeqCst);

    println!("[PTT] Starting listener for {:?} (from {})", target, key_code);

    thread::spawn(move || {
        let device_state = DeviceState::new();
        let mut was_pressed = false;

        while RUNNING.load(Ordering::SeqCst) {
            let keys = device_state.get_keys();
            let target = TARGET_KEY.lock().unwrap().unwrap_or(Keycode::V);
            let is_pressed = keys.contains(&target);

            if is_pressed && !was_pressed {
                let _ = app.emit("ptt-press", ());
            } else if !is_pressed && was_pressed {
                let _ = app.emit("ptt-release", ());
            }

            was_pressed = is_pressed;
            thread::sleep(Duration::from_millis(20)); // 50Hz polling
        }

        println!("[PTT] Listener stopped");
    });
}

/// Stop the PTT listener thread.
#[tauri::command]
pub fn stop_ptt_listener() {
    RUNNING.store(false, Ordering::SeqCst);
}
