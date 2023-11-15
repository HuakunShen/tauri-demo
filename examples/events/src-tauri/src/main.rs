// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{DateTime, Utc};
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();

            std::thread::spawn(move || loop {
                let now: DateTime<Utc> = Utc::now();
                let time_string = now.format("%d-%m-%Y %H:%M:%S").to_string();
                let _ = app_handle.emit_to("main", "time", &time_string);
                app_handle.emit_all("time", time_string).unwrap();
                std::thread::sleep(std::time::Duration::from_secs(1));
            });
            app.handle().listen_global("age", |event| {
                println!("age: {}", event.payload().unwrap());
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
