pub mod input_monitor;

use input_monitor::*;
use std::sync::{Arc, Mutex};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = Arc::new(Mutex::new(input_monitor::SelectionState::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .setup(|app| {
            let app_handle = app.handle().clone();
            input_monitor::start_input_monitoring(app_handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            toggle_enabled,
            get_enabled_status,
            translate_text,
            summarize_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
