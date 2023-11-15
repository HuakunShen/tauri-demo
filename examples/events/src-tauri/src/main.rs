// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::sync::{Arc, Mutex};

use arboard::Clipboard;
use tauri::{Manager, Window};

#[tauri::command]
fn listen_to_clipboard(window: Window, delay_millis: u64) {
    let clipboard = Arc::new(Mutex::new(Clipboard::new().unwrap()));
    let content = clipboard.lock().unwrap().get_text().unwrap();
    let content = Arc::new(Mutex::new(content));
    let clipboard = Arc::clone(&clipboard);
    let content = Arc::clone(&content);

    std::thread::spawn(move || loop {
        let mut cb = clipboard.lock().unwrap();
        let text = cb.get_text().unwrap();
        let mut cur_content = content.lock().unwrap();
        if text != *cur_content {
            *cur_content = text.clone();
            window.emit("clipboard-update", text).unwrap();
        }
        std::thread::sleep(std::time::Duration::from_millis(delay_millis));
    });
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![listen_to_clipboard])
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            window.open_devtools();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
