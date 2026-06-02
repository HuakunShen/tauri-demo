use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tauri_nspanel::{tauri_panel, ManagerExt, WebviewWindowExt};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

tauri_panel! {
    panel!(SpotlightPanel {
        config: {
            can_become_key_window: true,
            can_become_main_window: false,
            is_floating_panel: true,
            becomes_key_only_if_needed: true,
        }
    })
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn hide_window(app: AppHandle) {
    hide_spotlight(&app);
}

fn show_spotlight(app: &AppHandle) {
    if let Ok(panel) = app.get_webview_panel("main") {
        let _ = panel.show_and_make_key();
        if let Some(window) = panel.to_window() {
            let _ = window.center();
            let _ = window.eval("document.querySelector('.spotlight-input')?.focus()");
        }
    }
}

fn hide_spotlight(app: &AppHandle) {
    if let Ok(panel) = app.get_webview_panel("main") {
        let _ = panel.hide();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_nspanel::init())
        .setup(|app| {
            // Convert the main window into an NSPanel subclass so it can show
            // and accept keyboard input without activating the host app.
            let window = app.get_webview_window("main").unwrap();
            let _panel = window.to_panel::<SpotlightPanel>().unwrap();

            // Show and focus the panel on startup
            show_spotlight(&app.handle());

            // Hide dock icon on macOS - do this after window is shown
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            // Register global shortcut Cmd+Shift+Space
            let shortcut = Shortcut::new(
                Some(
                    tauri_plugin_global_shortcut::Modifiers::META
                        | tauri_plugin_global_shortcut::Modifiers::SHIFT,
                ),
                tauri_plugin_global_shortcut::Code::KeyH,
            );

            app.global_shortcut()
                .on_shortcut(shortcut, move |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Ok(panel) = app.get_webview_panel("main") {
                            if panel.is_visible() {
                                hide_spotlight(app);
                            } else {
                                show_spotlight(app);
                            }
                        }
                    }
                })?;

            // Create tray menu
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            // Create tray icon with icon path for macOS
            let _ = TrayIconBuilder::with_id("tray")
                .tooltip("CrossCopy")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        show_spotlight(app);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_spotlight(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, hide_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
