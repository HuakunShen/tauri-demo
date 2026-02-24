# Tauri Text Selection Popup POC

> Research report documenting a proof-of-concept for detecting global text selection and showing a floating popup menu near the mouse cursor, implemented as a Tauri v2 desktop application.

**Date**: 2026-02-06
**Platform tested**: 
- macOS (Apple Silicon), dual monitor setup at 2x scale
- Ubuntu 24.04 (X11), single monitor with DPI scaling
**Status**: Working POC

---

## 1. Overview

### What it does

When a user selects text in **any application** (not just the Tauri app), a small floating popup window appears near the mouse cursor with action buttons (Translate, Summarize). Clicking anywhere dismisses the popup. A new selection creates a new popup.

This is the same UX pattern used by tools like macOS Dictionary lookup, Grammarly, and various translation tools.

### Tech stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop framework | Tauri | v2.10.2 |
| Backend language | Rust | 2021 edition |
| Frontend framework | React | v19.1.0 |
| Frontend language | TypeScript | ~5.8.3 |
| Bundler | Vite | v7.0.4 |
| Package manager | Bun | v1.3.8 |
| Global input monitoring | `monio` crate | v0.1.1 |
| Text selection detection | `selection` crate | v1.2 |
| Clipboard (unused, legacy) | `arboard` crate | v3.4 |
| URL encoding | `urlencoding` crate | v2.1 |

### Key libraries

- **[monio](https://github.com/HuakunShen/monio)**: Rust library for global keyboard/mouse input monitoring. Provides `listen()` for event callbacks and `mouse_position()` for current cursor location. Equivalent to `uiohook-napi` in the Node.js ecosystem.
- **[selection](https://github.com/pot-app/Selection)** (crates.io: `selection`): Gets text selected by cursor using platform-native APIs. On macOS, uses Accessibility API with clipboard fallback. Simple `get_text() -> String` API.

---

## 2. Architecture

```
+------------------+     Tauri Events      +------------------+
|   Rust Backend   | --------------------> |  React Frontend  |
|                  |                       |                  |
| monio::listen()  |  "debug-event"        | Main Window      |
| (global mouse)   |  "text-selected"      |  - Status toggle |
|                  |  "translate-request"   |  - Debug log panel|
| selection::      |  "summarize-request"   |                  |
|   get_text()     |                       | Popup Window     |
| (get selected    |                       |  - popup.html    |
|  text)           |                       |  - Translate btn |
|                  |                       |  - Summarize btn |
| WebviewWindow    |                       |                  |
|   Builder        |                       |                  |
| (create popup    |                       |                  |
|  from Rust)      |                       |                  |
+------------------+                       +------------------+
```

### Flow

1. `monio::listen()` runs on a background thread, receiving global mouse events
2. On `MousePressed` (left button): close any existing popup, record drag start position
3. On `MouseReleased` (left button): calculate drag distance
4. If drag distance > 5 pixels:
   - Wait 50ms for OS to complete selection
   - Call `selection::get_text()` to get selected text
   - Call `monio::mouse_position()` to get current cursor position
   - Create a new Tauri `WebviewWindow` from Rust using `WebviewWindowBuilder`
   - Position it near the mouse using `LogicalPosition`, with monitor edge clamping

---

## 3. Implementation Details

### 3.1 Rust Backend

#### `src-tauri/src/input_monitor.rs` (core logic)

```rust
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
            selected_text.len(), mouse_x, mouse_y
        ),
    );

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
```

#### `src-tauri/src/lib.rs`

```rust
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
```

### 3.2 Frontend

#### `src/Popup.tsx`

```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./Popup.css";

function Popup() {
  const [selectedText, setSelectedText] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const text = params.get("text");
    if (text) {
      setSelectedText(decodeURIComponent(text));
    }
  }, []);

  const handleTranslate = async () => {
    await invoke("translate_text", { text: selectedText });
    await closePopup();
  };

  const handleSummarize = async () => {
    await invoke("summarize_text", { text: selectedText });
    await closePopup();
  };

  const closePopup = async () => {
    const window = getCurrentWindow();
    await window.close();
  };

  return (
    <div className="popup-container">
      <div className="popup-buttons">
        <button className="popup-btn popup-btn-primary" onClick={handleTranslate}>
          Translate
        </button>
        <button className="popup-btn popup-btn-secondary" onClick={handleSummarize}>
          Summarize
        </button>
      </div>
      {selectedText && (
        <div className="popup-text">
          {selectedText.slice(0, 50)}
          {selectedText.length > 50 ? "..." : ""}
        </div>
      )}
    </div>
  );
}

export default Popup;
```

#### `src/Popup.css`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
}

.popup-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100vh;
  width: 100vw;
  padding: 12px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.popup-buttons {
  display: flex;
  width: 100%;
  gap: 8px;
}

.popup-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.popup-btn:hover {
  opacity: 0.9;
}

.popup-btn-primary {
  background: #3b82f6;
  color: white;
}

.popup-btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.popup-text {
  max-width: 180px;
  font-size: 11px;
  color: #6b7280;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

#### `src/popup-main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import Popup from "./Popup";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
```

#### `popup.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Text Selection Popup</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/popup-main.tsx"></script>
  </body>
</html>
```

### 3.3 Configuration Files

#### `src-tauri/Cargo.toml`

```toml
[package]
name = "text-selection"
version = "0.1.0"
description = "A Tauri App"
authors = ["you"]
edition = "2021"

[lib]
name = "text_selection_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
monio = "0.1.1"
arboard = "3.4"
selection = "1.2"
urlencoding = "2.1"
```

#### `src-tauri/capabilities/default.json`

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "core:window:allow-create",
    "core:window:allow-close",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-position",
    "core:event:default"
  ]
}
```

#### `vite.config.ts` (multi-page build)

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        popup: resolve(__dirname, "popup.html"),
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
```

#### `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

---

## 4. Bugs and Traps Encountered

### Bug 1: Tauri NPM/Rust version mismatch

**Symptom**: Build fails with `Found version mismatched Tauri packages. tauri (v2.10.2) : @tauri-apps/api (v2.9.1)`

**Root cause**: The Tauri CLI enforces matching major.minor versions between the Rust crate and NPM package.

**Fix**: `bun update @tauri-apps/api` to update to v2.10.1.

---

### Bug 2: Capabilities in wrong config file

**Symptom**: `tauri.conf.json error: Additional properties are not allowed ('capabilities' was unexpected)`

**Root cause**: In Tauri v2, capabilities are defined in separate JSON files under `src-tauri/capabilities/`, not inline in `tauri.conf.json`.

**Fix**: Created `src-tauri/capabilities/default.json` with the required permissions (window create, close, show, hide, set-position, event).

---

### Bug 3: Popup HTML not included in Vite build

**Symptom**: Only `index.html` was built. Popup window loaded a blank page.

**Root cause**: Vite only builds the single `index.html` entry by default. A second HTML entry point (`popup.html`) needs explicit multi-page configuration.

**Fix**: Added `build.rollupOptions.input` to `vite.config.ts` with both entry points. Also required `@types/node` for `resolve()` and `__dirname`, and `"types": ["node"]` in `tsconfig.node.json`.

---

### Bug 4: Clipboard-based text detection was fragile (original approach, abandoned)

**Original approach**: On mouse release, simulate Cmd+C via `monio::key_press/tap/release`, read clipboard via `arboard`, then restore original clipboard content.

**Problems**:
- Race conditions between key simulation and clipboard read
- Clobbers the user's clipboard temporarily
- Requires both Accessibility and keyboard simulation permissions
- Alert sounds on macOS when simulating keys

**Fix**: Replaced entire approach with the `selection` crate (from pot-app), which uses native Accessibility API on macOS. Simple `selection::get_text() -> String` call. No clipboard manipulation needed.

---

### Bug 5: Frontend WebviewWindow creation never worked

**Symptom**: Rust successfully emitted `text-selected` events (confirmed by debug logs), but no `[FRONTEND]` prefixed logs ever appeared. Popup window never created from JavaScript.

**Root cause**: The frontend event listener inside the React component was either not receiving events reliably, or `new WebviewWindow()` from the JS API was failing silently. This was never fully diagnosed because the solution was to bypass the frontend entirely.

**Fix**: Moved popup window creation to Rust side using `tauri::WebviewWindowBuilder::new()`. This is synchronous, deterministic, and doesn't depend on frontend event delivery.

---

### Bug 6: Popup toggled (show/hide) instead of always showing

**Symptom**: First text selection showed popup. Second text selection hid it instead of showing a new one.

**Root cause**: Used static window label `"selection-popup"`. Sequence was: close existing window -> create new window with same label. But `close()` is async and the window handle hadn't been fully destroyed by the time `build()` was called with the same label, causing the build to fail silently.

**Fix**: Two changes:
1. Close popup on `MousePressed` (drag start), not at creation time. This gives the OS time to destroy the window before the next selection.
2. Use unique labels with an `AtomicU64` counter: `selection-popup-0`, `selection-popup-1`, etc. No label collisions possible.

---

### Bug 7: Coordinate system mismatch (PhysicalPosition vs LogicalPosition)

**Symptom**: Popup appeared but consistently offset from the actual mouse position (roughly half the distance on a 2x Retina display).

**Debug data**:
```
Tauri monitor: pos=(0,0), size=3024x1964, scale=2
monio mouse_position: (878, 291)
```

The monitor is 3024x1964 physical pixels at scale=2, so 1512x982 logical points. Monio's (878, 291) fits within the logical range, proving monio returns logical coordinates.

**Root cause**: Code used `PhysicalPosition::new(mouse_x as i32, mouse_y as i32)`. On a 2x display, Tauri interprets physical position (878, 291) as logical position (439, 145.5) -- half the intended location.

**Fix**: Changed to `LogicalPosition::new(mouse_x, mouse_y)`. One-line fix.

**Key insight**: On macOS, `monio` reports coordinates in "points" (logical coordinates, same as CGEvent coordinates). Tauri's `LogicalPosition` accepts points. `PhysicalPosition` expects raw pixels. Always use `LogicalPosition` with monio coordinates.

---

### Bug 8: Popup clipped by screen edges

**Symptom**: When mouse is near the bottom or right edge of a monitor, the popup is partially or fully off-screen.

**Fix**: Added monitor-aware boundary detection:
1. Iterate Tauri monitors, convert physical bounds to logical using scale factor
2. Find which monitor contains the mouse
3. Default position: mouse + 10px offset (bottom-right of cursor)
4. If popup would overflow right edge: flip to left of cursor
5. If popup would overflow bottom edge: flip to above cursor
6. Final clamp: ensure popup stays fully within monitor bounds

---

### Bug 9: Negative Y coordinates on multi-monitor setups

**Symptom**: Mouse Y values were negative (e.g., -648, -867) when selecting text on a secondary monitor positioned above the primary.

**Root cause**: macOS coordinate system uses the primary display's top-left as origin (0,0). Monitors above have negative Y, monitors to the left have negative X. This is normal and expected.

**Fix**: The monitor boundary clamping logic (Bug 8 fix) handles negative coordinates naturally because it uses per-monitor bounds rather than assuming (0,0) origin.

---

### Bug 10: Linux X11 Coordinate System Mismatch

**Symptom (Ubuntu 24 X11)**: Popup appears at wrong location, significantly offset from the actual mouse cursor position. The offset is proportional to the display's DPI scale factor.

**Root cause**: Platform differences in how `monio` reports mouse coordinates:
- **macOS**: `monio` returns logical "points" (already scaled by DPI)
- **Linux X11**: `monio` returns raw **physical pixels** (unscaled)

The original code compared physical mouse coordinates against monitor bounds that were converted to logical coordinates (divided by scale factor), causing a coordinate system mismatch on Linux.

**Debug data (Ubuntu 24, 1.5x scale):**
```
Tauri monitor: pos=(0,0), size=2560x1440, scale=1.5
monio mouse_position: (1920, 1080)  // Physical pixels
Expected logical position: (1280, 720)  // After dividing by 1.5
```

**Fix**: Platform-specific coordinate conversion using Rust's conditional compilation:

```rust
// Platform-specific: convert mouse position to logical coordinates
#[cfg(target_os = "macos")]
let (mouse_x_logical, mouse_y_logical) = (mouse_x, mouse_y);
#[cfg(not(target_os = "macos"))]
let (mouse_x_logical, mouse_y_logical) = (mouse_x / scale, mouse_y / scale);
```

The complete fix involves:
1. **Check mouse position using physical coordinates** against monitor physical bounds
2. **Convert mouse to logical** using platform-specific rules (macOS: no-op, Linux/Windows: divide by scale)
3. **Use logical coordinates** for Tauri window positioning with `LogicalPosition`

**Platform coordinate behavior:**

| Platform | monio Returns | Conversion to Logical |
|----------|---------------|----------------------|
| **macOS** | Logical points | `mouse_x` (no change) |
| **Linux X11** | Physical pixels | `mouse_x / scale` |
| **Windows** | Physical pixels | `mouse_x / scale` |

This fix ensures correct popup positioning across macOS and Linux without breaking existing macOS functionality.

---

## 5. Key Technical Decisions

### Decision 1: Create popup from Rust, not JavaScript

The JS `WebviewWindow` API was unreliable. Events emitted by Rust weren't consistently received by the frontend listener. Rust-side `WebviewWindowBuilder` is synchronous, doesn't depend on frontend state, and works regardless of whether the main window is focused.

### Decision 2: `selection` crate over clipboard simulation

The clipboard simulation approach (clear clipboard -> Cmd+C -> read clipboard -> restore) had too many failure modes: race conditions, clipboard clobbering, alert sounds, and complex error handling. The `selection` crate wraps native Accessibility APIs and just works.

### Decision 3: Separate `monio` for input + `selection` for text

Separation of concerns. `monio` handles raw OS input events (mouse press/release/drag). `selection` handles platform-specific text retrieval. Each library does one thing well.

### Decision 4: LogicalPosition for window positioning

`monio` reports macOS "points" (logical coordinates). Tauri's `LogicalPosition` maps 1:1 with macOS points. This was discovered through debugging (see Bug 7).

### Decision 5: Unique popup labels with AtomicU64

Avoids window label collision race conditions. Using a monotonically increasing counter means every popup gets a unique label. Old popups are closed by iterating `app_handle.webview_windows()` and matching the `"selection-popup"` prefix.

### Decision 6: 50ms delay after mouse release

The OS needs a brief moment to finalize the text selection. Without this delay, `selection::get_text()` sometimes returns empty or stale text. 50ms is a reasonable balance between responsiveness and reliability.

---

## 6. Current State

### Working

- Global text selection detection (any application)
- Floating popup appears near mouse cursor
- Monitor-aware edge clamping (popup flips to opposite side near edges)
- Multi-monitor support (including negative coordinate spaces)
- Enable/disable toggle in main window
- Debug log panel in main window
- Popup dismisses on next click

### Known Limitations

- `arboard` crate still in `Cargo.toml` (unused, can be removed)
- Debug logging is verbose (should be removed or gated for production)
- Only detects drag-based selection. Does not detect double-click word selection or keyboard-based selection (Shift+Arrow).
- Translate/Summarize buttons emit events but don't do anything yet
- macOS tested (Apple Silicon, dual monitor)
- Linux tested (Ubuntu 24.04 X11, single monitor)
- Windows not tested
- Requires Accessibility permissions on macOS (System Settings > Privacy & Security > Accessibility)
- Selected text is passed to popup via URL query parameter, which has length limits for very long selections

---

## 7. Next Steps

1. Remove `arboard` dependency
2. Gate debug logging behind a feature flag or dev mode check
3. Add actual translate/summarize functionality (e.g., call an LLM API)
4. Handle double-click word selection and keyboard selection
5. Test on Windows
6. Consider a system tray icon instead of a full main window
7. Use Tauri's managed state or IPC instead of URL query params for passing text to popup
8. Add animation/transition to popup appearance
9. Handle very long selected text gracefully
