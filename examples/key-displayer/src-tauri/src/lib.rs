use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Clone, serde::Serialize)]
struct KeyEvent {
    #[serde(rename = "type")]
    event_type: String,
    key: Option<String>,
    keys: Vec<String>,
    button: Option<u32>,
    x: Option<f64>,
    y: Option<f64>,
    timestamp: u64,
}

pub struct AppState {
    pressed_keys: Arc<Mutex<std::collections::HashSet<String>>>,
    is_monitoring: Arc<AtomicBool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            pressed_keys: Arc::new(Mutex::new(std::collections::HashSet::new())),
            is_monitoring: Arc::new(AtomicBool::new(false)),
        }
    }
}

fn get_key_name(key: monio::Key) -> String {
    use monio::Key;
    match key {
        // Letters - just return the letter
        Key::KeyA => "A".to_string(),
        Key::KeyB => "B".to_string(),
        Key::KeyC => "C".to_string(),
        Key::KeyD => "D".to_string(),
        Key::KeyE => "E".to_string(),
        Key::KeyF => "F".to_string(),
        Key::KeyG => "G".to_string(),
        Key::KeyH => "H".to_string(),
        Key::KeyI => "I".to_string(),
        Key::KeyJ => "J".to_string(),
        Key::KeyK => "K".to_string(),
        Key::KeyL => "L".to_string(),
        Key::KeyM => "M".to_string(),
        Key::KeyN => "N".to_string(),
        Key::KeyO => "O".to_string(),
        Key::KeyP => "P".to_string(),
        Key::KeyQ => "Q".to_string(),
        Key::KeyR => "R".to_string(),
        Key::KeyS => "S".to_string(),
        Key::KeyT => "T".to_string(),
        Key::KeyU => "U".to_string(),
        Key::KeyV => "V".to_string(),
        Key::KeyW => "W".to_string(),
        Key::KeyX => "X".to_string(),
        Key::KeyY => "Y".to_string(),
        Key::KeyZ => "Z".to_string(),
        // Numbers - handle via fallback
        // Special keys
        Key::Escape => "Esc".to_string(),
        Key::Backspace => "⌫".to_string(),
        Key::Tab => "Tab".to_string(),
        Key::Enter => "↵".to_string(),
        Key::ShiftLeft | Key::ShiftRight => "Shift".to_string(),
        Key::ControlLeft | Key::ControlRight => "Ctrl".to_string(),
        Key::AltLeft | Key::AltRight => "Alt".to_string(),
        Key::MetaLeft | Key::MetaRight => "⌘".to_string(),
        Key::Space => "Space".to_string(),
        Key::ArrowUp => "↑".to_string(),
        Key::ArrowDown => "↓".to_string(),
        Key::ArrowLeft => "←".to_string(),
        Key::ArrowRight => "→".to_string(),
        Key::CapsLock => "Caps".to_string(),
        Key::Delete => "Del".to_string(),
        Key::Insert => "Ins".to_string(),
        Key::Home => "Home".to_string(),
        Key::End => "End".to_string(),
        Key::PageUp => "PgUp".to_string(),
        Key::PageDown => "PgDn".to_string(),
        Key::F1 => "F1".to_string(),
        Key::F2 => "F2".to_string(),
        Key::F3 => "F3".to_string(),
        Key::F4 => "F4".to_string(),
        Key::F5 => "F5".to_string(),
        Key::F6 => "F6".to_string(),
        Key::F7 => "F7".to_string(),
        Key::F8 => "F8".to_string(),
        Key::F9 => "F9".to_string(),
        Key::F10 => "F10".to_string(),
        Key::F11 => "F11".to_string(),
        Key::F12 => "F12".to_string(),
        // Punctuation and other keys
        _ => {
            let s = format!("{:?}", key);
            // Strip common prefixes
            if s.starts_with("Key") {
                s[3..].to_string()
            } else if s.starts_with("Digit") {
                s[5..].to_string()
            } else {
                s
            }
        }
    }
}

fn run_input_monitoring(app_handle: AppHandle, state: Arc<AppState>) -> Result<(), String> {
    use monio::{listen, Event, EventType};

    let pressed_keys = state.pressed_keys.clone();
    let is_monitoring = state.is_monitoring.clone();
    let app_handle_for_closure = app_handle.clone();

    let last_mouse_move = Arc::new(AtomicU64::new(0));

    is_monitoring.store(true, Ordering::SeqCst);
    eprintln!("Input monitoring started");

    listen(move |event: &Event| {
        if !is_monitoring.load(Ordering::SeqCst) {
            return;
        }

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        match event.event_type {
            EventType::KeyPressed => {
                if let Some(kb) = &event.keyboard {
                    let key_name = get_key_name(kb.key);
                    eprintln!("Key pressed: {}", key_name);
                    pressed_keys.lock().unwrap().insert(key_name.clone());

                    let event_data = KeyEvent {
                        event_type: "keydown".to_string(),
                        key: Some(key_name.clone()),
                        keys: pressed_keys.lock().unwrap().iter().cloned().collect(),
                        button: None,
                        x: None,
                        y: None,
                        timestamp,
                    };

                    if let Err(e) = app_handle_for_closure.emit("keycastr-event", event_data) {
                        eprintln!("Failed to emit key event: {}", e);
                    } else {
                        eprintln!("Emitted key event: {}", key_name);
                    }
                }
            }
            EventType::KeyReleased => {
                if let Some(kb) = &event.keyboard {
                    let key_name = get_key_name(kb.key);
                    pressed_keys.lock().unwrap().remove(&key_name);

                    let event_data = KeyEvent {
                        event_type: "keyup".to_string(),
                        key: Some(key_name),
                        keys: pressed_keys.lock().unwrap().iter().cloned().collect(),
                        button: None,
                        x: None,
                        y: None,
                        timestamp,
                    };

                    let _ = app_handle_for_closure.emit("keycastr-event", event_data);
                }
            }
            EventType::MousePressed => {
                if let Some(mouse) = &event.mouse {
                    let btn_name = mouse
                        .button
                        .and_then(|b| match b {
                            monio::Button::Left => Some("MouseL"),
                            monio::Button::Middle => Some("MouseM"),
                            monio::Button::Right => Some("MouseR"),
                            _ => None,
                        })
                        .unwrap_or("Mouse");

                    pressed_keys.lock().unwrap().insert(btn_name.to_string());

                    let event_data = KeyEvent {
                        event_type: "mousedown".to_string(),
                        key: Some(btn_name.to_string()),
                        keys: pressed_keys.lock().unwrap().iter().cloned().collect(),
                        button: mouse.button.map(|b| match b {
                            monio::Button::Left => 1,
                            monio::Button::Middle => 2,
                            monio::Button::Right => 3,
                            _ => 0,
                        }),
                        x: Some(mouse.x),
                        y: Some(mouse.y),
                        timestamp,
                    };

                    let _ = app_handle_for_closure.emit("keycastr-event", event_data);
                }
            }
            EventType::MouseReleased => {
                if let Some(mouse) = &event.mouse {
                    let btn_name = mouse
                        .button
                        .and_then(|b| match b {
                            monio::Button::Left => Some("MouseL"),
                            monio::Button::Middle => Some("MouseM"),
                            monio::Button::Right => Some("MouseR"),
                            _ => None,
                        })
                        .unwrap_or("Mouse");

                    pressed_keys.lock().unwrap().remove(btn_name);

                    let event_data = KeyEvent {
                        event_type: "mouseup".to_string(),
                        key: Some(btn_name.to_string()),
                        keys: pressed_keys.lock().unwrap().iter().cloned().collect(),
                        button: mouse.button.map(|b| match b {
                            monio::Button::Left => 1,
                            monio::Button::Middle => 2,
                            monio::Button::Right => 3,
                            _ => 0,
                        }),
                        x: Some(mouse.x),
                        y: Some(mouse.y),
                        timestamp,
                    };

                    let _ = app_handle_for_closure.emit("keycastr-event", event_data);
                }
            }
            EventType::MouseMoved | EventType::MouseDragged => {
                if timestamp.saturating_sub(last_mouse_move.load(Ordering::Relaxed)) < 50 {
                    return;
                }
                last_mouse_move.store(timestamp, Ordering::Relaxed);

                if let Some(mouse) = &event.mouse {
                    let event_data = KeyEvent {
                        event_type: "mousemove".to_string(),
                        key: None,
                        keys: pressed_keys.lock().unwrap().iter().cloned().collect(),
                        button: None,
                        x: Some(mouse.x),
                        y: Some(mouse.y),
                        timestamp,
                    };

                    let _ = app_handle_for_closure.emit("keycastr-event", event_data);
                }
            }
            _ => {}
        }
    })
    .map_err(|e| format!("Input hook error: {}", e))?;

    eprintln!("Input monitoring stopped");
    Ok(())
}

#[tauri::command]
fn start_monitoring(app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if state.is_monitoring.load(Ordering::SeqCst) {
        return Ok(());
    }

    let state_arc = Arc::new(AppState {
        pressed_keys: state.pressed_keys.clone(),
        is_monitoring: state.is_monitoring.clone(),
    });

    std::thread::spawn(move || {
        if let Err(e) = run_input_monitoring(app_handle, state_arc) {
            eprintln!("Input monitoring error: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_monitoring(state: State<'_, AppState>) -> Result<(), String> {
    state.is_monitoring.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn is_monitoring(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.is_monitoring.load(Ordering::SeqCst))
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .setup(|app| {
            // Ensure keycastr window is always on top
            if let Some(window) = app.get_webview_window("keycastr") {
                let _ = window.set_always_on_top(true);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            start_monitoring,
            stop_monitoring,
            is_monitoring
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
