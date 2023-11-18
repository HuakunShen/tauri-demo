// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::sync::{Arc, Mutex};

use arboard::Clipboard;
use tauri::{Manager, Window};

struct ClipboardListenerState {
    clipboard_listener_running: Arc<Mutex<bool>>,
}

#[tauri::command]
fn listen_to_clipboard(
    window: Window,
    delay_millis: u64,
    listener_state: tauri::State<'_, ClipboardListenerState>,
) {
    println!("Start Clipboard listening");
    let clipboard = Arc::new(Mutex::new(Clipboard::new().unwrap()));
    let content = clipboard.lock().unwrap().get_text().unwrap();
    let content = Arc::new(Mutex::new(content));
    let clipboard = Arc::clone(&clipboard);
    let content = Arc::clone(&content);
    let mut running = listener_state.clipboard_listener_running.lock().unwrap();
    *running = true;
    let _ = window.emit("clipboard_listener_running", *running);
    let running = listener_state.clipboard_listener_running.clone();

    std::thread::spawn(move || loop {
        let mut cb = clipboard.lock().unwrap();
        let cur_text = cb.get_text().unwrap();
        let mut pre_text = content.lock().unwrap();
        if !*running.lock().unwrap() {
            println!("Clipboard Listener stopped running");
            let _ = window.emit("clipboard_listener_running", false);
            return;
        }
        if cur_text != *pre_text {
            *pre_text = cur_text.clone();
            window.emit("clipboard-update", cur_text).unwrap();
        }
        std::thread::sleep(std::time::Duration::from_millis(delay_millis));
    });
}

#[tauri::command]
fn stop_clipboard_listener(listener_state: tauri::State<'_, ClipboardListenerState>) {
    println!("stop_clipboard_listener called");
    let mut running = listener_state.clipboard_listener_running.lock().unwrap();
    *running = false;
}

fn main() {
    tauri::Builder::default()
        .manage(ClipboardListenerState {
            clipboard_listener_running: Arc::new(Mutex::new(false)),
        })
        .invoke_handler(tauri::generate_handler![
            listen_to_clipboard,
            stop_clipboard_listener,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
