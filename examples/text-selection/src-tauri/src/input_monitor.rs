use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, LogicalPosition, Manager};

static POPUP_COUNTER: AtomicU64 = AtomicU64::new(0);

pub struct SelectionState {
    pub is_dragging: bool,
    pub drag_start_x: f64,
    pub drag_start_y: f64,
    pub is_enabled: bool,
    pub last_selected_text: String,
}

impl SelectionState {
    pub fn new() -> Self {
        Self {
            is_dragging: false,
            drag_start_x: 0.0,
            drag_start_y: 0.0,
            is_enabled: true,
            last_selected_text: String::new(),
        }
    }
}

fn emit_debug(app_handle: &AppHandle, message: String) {
    let _ = app_handle.emit(
        "debug-event",
        serde_json::json!({
            "message": message,
            "timestamp": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        }),
    );
    println!("[DEBUG] {}", message);
}

fn close_popup(app_handle: &AppHandle) {
    for (label, win) in app_handle.webview_windows() {
        if label.starts_with("selection-popup") {
            let _ = win.close();
        }
    }
}

pub fn start_input_monitoring(app_handle: AppHandle) {
    let state = Arc::new(Mutex::new(SelectionState::new()));

    emit_debug(&app_handle, "Starting input monitoring...".to_string());

    let app_handle_for_thread = app_handle.clone();
    thread::spawn(move || {
        let state_clone = state.clone();
        let app_handle_clone = app_handle_for_thread.clone();

        let result = monio::listen(move |event| {
            let ah = app_handle_clone.clone();

            match event.event_type {
                monio::EventType::MousePressed => {
                    if let Some(mouse) = &event.mouse {
                        if mouse.button == Some(monio::Button::Left) {
                            // Close popup immediately on any click/drag start
                            close_popup(&ah);

                            let mut state = state_clone.lock().unwrap();
                            state.is_dragging = true;
                            state.drag_start_x = mouse.x;
                            state.drag_start_y = mouse.y;
                        }
                    }
                }
                monio::EventType::MouseReleased => {
                    if let Some(mouse) = &event.mouse {
                        let mut state = state_clone.lock().unwrap();
                        if !state.is_enabled {
                            return;
                        }

                        if mouse.button == Some(monio::Button::Left) && state.is_dragging {
                            state.is_dragging = false;

                            let dx = mouse.x - state.drag_start_x;
                            let dy = mouse.y - state.drag_start_y;
                            let distance = (dx * dx + dy * dy).sqrt();

                            if distance > 5.0 {
                                drop(state);
                                thread::sleep(Duration::from_millis(50));
                                handle_text_selection(ah);
                            }
                        }
                    }
                }
                monio::EventType::HookEnabled => {
                    emit_debug(&ah, "Hook enabled - monio is running!".to_string());
                }
                _ => {}
            }
        });

        if let Err(e) = result {
            emit_debug(
                &app_handle_for_thread,
                format!("Monio listener error: {:?}", e),
            );
        }
    });

    emit_debug(&app_handle, "Input monitoring thread spawned".to_string());
}

fn handle_text_selection(app_handle: AppHandle) {
    let (mouse_x, mouse_y) = match monio::mouse_position() {
        Ok(pos) => pos,
        Err(_) => (0.0, 0.0),
    };

    let selected_text = selection::get_text();
    if selected_text.is_empty() {
        return;
    }

    let state = app_handle.state::<Arc<Mutex<SelectionState>>>();
    let mut state = state.lock().unwrap();
    if selected_text == state.last_selected_text {
        return;
    }
    state.last_selected_text = selected_text.clone();
    drop(state);

    emit_debug(
        &app_handle,
        format!(
            "Selected {} chars, monio pos: ({:.0}, {:.0})",
            selected_text.len(),
            mouse_x,
            mouse_y
        ),
    );

    // Log Tauri monitor info for coordinate comparison
    if let Some(monitors) = app_handle.available_monitors().ok() {
        for m in &monitors {
            let pos = m.position();
            let size = m.size();
            let scale = m.scale_factor();
            emit_debug(
                &app_handle,
                format!(
                    "Tauri monitor: pos=({},{}), size={}x{}, scale={}",
                    pos.x, pos.y, size.width, size.height, scale
                ),
            );
        }
    }

    // Use unique label each time to avoid stale window handle conflicts
    let popup_id = POPUP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let label = format!("selection-popup-{}", popup_id);
    let popup_url = format!("popup.html?text={}", urlencoding::encode(&selected_text));

    match tauri::WebviewWindowBuilder::new(
        &app_handle,
        &label,
        tauri::WebviewUrl::App(popup_url.into()),
    )
    .title("")
    .inner_size(220.0, 90.0)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .visible(true)
    .focused(false)
    .build()
    {
        Ok(win) => {
            let popup_w = 220.0_f64;
            let popup_h = 90.0_f64;
            let offset = 10.0_f64;

            let (mut px, mut py) = (mouse_x + offset, mouse_y + offset);

            // Find which monitor the mouse is on and clamp to its edges
            if let Ok(monitors) = app_handle.available_monitors() {
                for m in &monitors {
                    let scale = m.scale_factor();
                    let mon_x = m.position().x as f64 / scale;
                    let mon_y = m.position().y as f64 / scale;
                    let mon_w = m.size().width as f64 / scale;
                    let mon_h = m.size().height as f64 / scale;

                    let mouse_in_monitor = mouse_x >= mon_x
                        && mouse_x < mon_x + mon_w
                        && mouse_y >= mon_y
                        && mouse_y < mon_y + mon_h;

                    if mouse_in_monitor {
                        let mon_right = mon_x + mon_w;
                        let mon_bottom = mon_y + mon_h;

                        if px + popup_w > mon_right {
                            px = mouse_x - popup_w - offset;
                        }
                        if py + popup_h > mon_bottom {
                            py = mouse_y - popup_h - offset;
                        }

                        px = px.max(mon_x).min(mon_right - popup_w);
                        py = py.max(mon_y).min(mon_bottom - popup_h);
                        break;
                    }
                }
            }

            let logical_pos = LogicalPosition::new(px, py);
            emit_debug(&app_handle, format!("Popup at ({:.0}, {:.0})", px, py));
            let _ = win.set_position(tauri::Position::Logical(logical_pos));
        }
        Err(e) => {
            emit_debug(&app_handle, format!("Failed to create popup: {:?}", e));
        }
    }
}

#[tauri::command]
pub fn toggle_enabled(state: tauri::State<Arc<Mutex<SelectionState>>>) -> bool {
    let mut state = state.lock().unwrap();
    state.is_enabled = !state.is_enabled;
    state.is_enabled
}

#[tauri::command]
pub fn get_enabled_status(state: tauri::State<Arc<Mutex<SelectionState>>>) -> bool {
    let state = state.lock().unwrap();
    state.is_enabled
}

#[tauri::command]
pub fn translate_text(app_handle: AppHandle, text: String) {
    let _ = app_handle.emit("translate-request", text);
}

#[tauri::command]
pub fn summarize_text(app_handle: AppHandle, text: String) {
    let _ = app_handle.emit("summarize-request", text);
}
