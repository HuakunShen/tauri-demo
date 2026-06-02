---
name: tauri-nspanel-spotlight
description: Use when building or debugging a macOS Tauri v2 floating command window, Spotlight/Raycast-style launcher, global hotkey panel, non-activating NSPanel, or tauri-nspanel integration.
---

# Tauri NSPanel Spotlight

## Overview

Use `tauri-nspanel` for macOS Spotlight/Raycast-style panels that can receive keyboard input without activating the app. Treat `NSPanel` focus semantics as different from normal Tauri windows.

## Core Pattern

Convert the existing Tauri `main` window once in `setup`, then always show/hide through panel helpers.

```rust
use tauri::{AppHandle, Manager};
use tauri_nspanel::{tauri_panel, ManagerExt, WebviewWindowExt};

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

fn show_spotlight(app: &AppHandle) {
    if let Ok(panel) = app.get_webview_panel("main") {
        panel.show_and_make_key();
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.center();
            let _ = window.eval("document.querySelector('.spotlight-input')?.focus()");
        }
    }
}

fn hide_spotlight(app: &AppHandle) {
    if let Ok(panel) = app.get_webview_panel("main") {
        panel.hide();
    }
}
```

## Critical Gotchas

| Symptom | Root Cause | Fix |
|---|---|---|
| Hotkey fires but panel lookup fails after first show | Calling `panel.to_window()` converts the panel back into a regular window | Use `app.get_webview_window("main")` for `center()` and `eval()`; do not call `panel.to_window()` during normal show |
| Hotkey callback fires but cannot find panel | The callback-provided `app` may not see the converted panel in this setup | Capture `let app_handle = app.handle().clone()` in `setup` and use that inside the shortcut callback |
| Panel flashes: shows then immediately hides | Frontend `input onblur` calls `hide_window`; NSPanel can blur while becoming key | Do not use input blur as the default hide trigger. Prefer `Cmd+Shift+H`, `Escape`, command selection, or explicit Rust-side panel/window events |
| Panel steals active app/cursor | Using regular `window.show()` + `window.set_focus()` | Use `panel.show_and_make_key()` on a non-main floating panel |

## Global Shortcut Pattern

```rust
let app_handle = app.handle().clone();
app.global_shortcut()
    .on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            if let Ok(panel) = app_handle.get_webview_panel("main") {
                if panel.is_visible() {
                    hide_spotlight(&app_handle);
                } else {
                    show_spotlight(&app_handle);
                }
            }
        }
    })?;
```

## Frontend Rules

- Keep `Escape` and command selection as explicit hide paths.
- Avoid `onblur={handleBlur}` on the search input for NSPanel mode unless you have proven it does not fire during `show_and_make_key()`.
- A placeholder hint like `Search commands... (⌘+Shift+H)` makes the global shortcut discoverable.

## Debugging Checklist

1. Add temporary logs around shortcut registration, callback fired, panel lookup, show, and hide.
2. If registration logs but no callback logs, inspect shortcut conflicts or macOS global hotkey registration.
3. If callback logs but panel lookup fails, check for accidental `panel.to_window()` or wrong app handle.
4. If show logs followed immediately by hide logs, inspect frontend IPC calls such as `hide_window` from blur handlers.
5. Remove debug logs before committing.

## External Docs

Prefer GitHub/raw, DeepWiki, or Context7 for external repo/API checks. Avoid reading local dependency checkouts such as `~/.cargo/git/...` when workspace permissions are constrained.
