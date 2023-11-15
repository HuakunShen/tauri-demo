// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, Runtime};

#[tauri::command]
async fn long_running_job<R: Runtime>(window: tauri::Window<R>) {
    for i in 0..101 {
        window.emit("progress", i).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(40));
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            app.listen_global("age", |event| {
                println!("age: {}", event.payload().unwrap());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![long_running_job])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
