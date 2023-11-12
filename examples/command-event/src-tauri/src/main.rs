// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::collections::HashMap;

use serde_json::Number;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// custom data structure must be Deserialize as a parameter and Serialize as a return value
#[derive(serde::Deserialize, serde::Serialize)]
struct MyCustomData {
    pub name: String,
}

#[tauri::command]
fn custom_payload(payload: MyCustomData) -> MyCustomData {
    payload
}

// Async command
#[tauri::command]
async fn my_ip() -> Result<HashMap<String, String>, String> {
    let resp = reqwest::get("https://httpbin.org/ip")
        .await
        .map_err(|err| err.to_string())?
        .json::<HashMap<String, String>>()
        .await
        .map_err(|err| err.to_string())?;
    // Ok(resp["origin"].to_string())
    Ok(resp)
}

#[tauri::command]
fn window_label(window: tauri::Window) -> String {
    window.label().to_string()
}


#[derive(Default)]
struct Counter {
    count: std::sync::Mutex<i32>,
}
#[tauri::command]
fn event_and_state_increment(app_handle: tauri::AppHandle, count_state: tauri::State<'_, Counter>) {
    // increment counter_state.count
    *count_state.count.lock().unwrap() += 1;
    let count = *count_state.count.lock().unwrap();
    app_handle.emit_all("event_and_state_increment", count).unwrap();
}

fn main() {
    tauri::Builder::default()
        .manage(Counter { count: 0.into() })
        .invoke_handler(tauri::generate_handler![
            greet,
            custom_payload,
            my_ip,
            window_label,
            event_and_state_increment
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
