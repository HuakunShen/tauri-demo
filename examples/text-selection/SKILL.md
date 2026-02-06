---
name: tauri-text-selection-popup
description: Build a global text selection popup tool using Tauri v2, Monio, and the Selection crate. Detects text selected in any application system-wide and shows a floating action popup near the mouse cursor with monitor-aware edge clamping.
license: MIT
compatibility: opencode
metadata:
  category: desktop-development
  stack: tauri-v2, rust, react, monio, selection-crate
  platforms: macos (tested), windows, linux (untested)
  difficulty: intermediate
---

# Tauri Text Selection Popup Implementation Guide

Build a global text selection detection tool that shows a floating popup near the mouse cursor, implemented as a Tauri v2 desktop application.

## Overview

This skill enables creation of a system-wide text selection detector with floating action popups. When a user selects text in **any application**, a small popup appears near the cursor with contextual actions (Translate, Summarize, etc.). The implementation features:

- **Global Text Selection Detection**: Monitors mouse drag events system-wide via `monio`, retrieves selected text via the `selection` crate's native Accessibility API
- **Floating Popup Window**: Frameless, always-on-top Tauri WebviewWindow created from Rust
- **Monitor-Aware Positioning**: Popup flips to opposite side of cursor near screen edges, handles multi-monitor setups with negative coordinates
- **Click-to-Dismiss**: Popup closes on next mouse click anywhere

## Architecture

```
┌─────────────────┐     Tauri Events      ┌──────────────────┐
│  Rust Backend    │ ────────────────────► │  React Frontend  │
│                  │                       │                  │
│ monio::listen()  │  "debug-event"        │ Main Window      │
│ (global mouse)   │  "text-selected"      │  - Status toggle │
│                  │  "translate-request"   │  - Debug log     │
│ selection::      │  "summarize-request"   │                  │
│   get_text()     │                       │ Popup Window     │
│ (native a11y)    │                       │  - popup.html    │
│                  │                       │  - Action buttons │
│ WebviewWindow    │                       │                  │
│   Builder        │                       │                  │
│ (create popup    │                       │                  │
│  from Rust)      │                       │                  │
└─────────────────┘                       └──────────────────┘
```

### Flow

1. `monio::listen()` runs on a background thread, receiving global mouse events
2. On `MousePressed` (left button): close any existing popup, record drag start position
3. On `MouseReleased` (left button): calculate drag distance
4. If drag distance > 5 pixels:
   - Wait 50ms for OS to complete selection
   - Call `selection::get_text()` to get selected text
   - Call `monio::mouse_position()` to get cursor position
   - Create a new Tauri `WebviewWindow` from Rust using `WebviewWindowBuilder`
   - Position using `LogicalPosition` with monitor edge clamping

## Prerequisites

- Tauri v2 CLI installed
- Rust toolchain (2021 edition)
- Bun (or npm)
- macOS: Accessibility permissions granted (System Settings > Privacy & Security > Accessibility)

## Step-by-Step Implementation

### 1. Add Dependencies

**Cargo.toml:**
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
monio = "0.1.1"
selection = "1.2"
urlencoding = "2.1"
```

**Frontend (package.json):**
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.10.0",
    "@tauri-apps/plugin-opener": "^2.0.0"
  }
}
```

> **Note:** `arboard` (clipboard crate) is NOT needed. The `selection` crate uses native Accessibility API directly. Do NOT use clipboard-simulation approaches (Cmd+C hack) — they are fragile, clobber the user's clipboard, and produce alert sounds on macOS.

### 2. Configure Tauri

**src-tauri/tauri.conf.json** — Only the main window is declared statically. Popup windows are created dynamically from Rust.

**src-tauri/capabilities/default.json:**
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

**Critical:** Capabilities go in `src-tauri/capabilities/default.json`, NOT in `tauri.conf.json`. Tauri v2 rejects inline capabilities.

### 3. Configure Vite for Multi-Page Build

The popup is a separate HTML entry point. Vite needs explicit multi-page config.

**vite.config.ts:**
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

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
  // ... dev server config
}));
```

**tsconfig.node.json** — Add `"types": ["node"]` for `resolve()` and `__dirname` to work.

**popup.html** — Create at project root:
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

### 4. Implement Rust Backend

**src-tauri/src/input_monitor.rs** — Core logic:

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

fn close_popup(app_handle: &AppHandle) {
    for (label, win) in app_handle.webview_windows() {
        if label.starts_with("selection-popup") {
            let _ = win.close();
        }
    }
}

pub fn start_input_monitoring(app_handle: AppHandle) {
    let state = Arc::new(Mutex::new(SelectionState::new()));

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
                            // Close existing popup on ANY click
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
                                drop(state); // Release lock before sleep
                                thread::sleep(Duration::from_millis(50));
                                handle_text_selection(ah);
                            }
                        }
                    }
                }
                _ => {}
            }
        });

        if let Err(e) = result {
            eprintln!("Monio listener error: {:?}", e);
        }
    });
}
```

**Key design decisions in the handler:**

1. **Close popup on `MousePressed`, not on creation.** This gives the OS time to destroy the previous window before a new one is created with a unique label.

2. **Unique popup labels via `AtomicU64` counter.** Prevents label collisions from async window destruction race conditions.

3. **Drop the Mutex lock before `thread::sleep`.** Otherwise the 50ms sleep blocks all other event processing.

#### Popup Creation with Monitor-Aware Edge Clamping

```rust
fn handle_text_selection(app_handle: AppHandle) {
    let (mouse_x, mouse_y) = match monio::mouse_position() {
        Ok(pos) => pos,
        Err(_) => (0.0, 0.0),
    };

    let selected_text = selection::get_text();
    if selected_text.is_empty() {
        return;
    }

    // Deduplicate: skip if same text selected again
    let state = app_handle.state::<Arc<Mutex<SelectionState>>>();
    let mut state = state.lock().unwrap();
    if selected_text == state.last_selected_text {
        return;
    }
    state.last_selected_text = selected_text.clone();
    drop(state);

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

            // Monitor-aware edge clamping
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

                        // Flip to opposite side if overflowing
                        if px + popup_w > mon_right {
                            px = mouse_x - popup_w - offset;
                        }
                        if py + popup_h > mon_bottom {
                            py = mouse_y - popup_h - offset;
                        }

                        // Final clamp within monitor bounds
                        px = px.max(mon_x).min(mon_right - popup_w);
                        py = py.max(mon_y).min(mon_bottom - popup_h);
                        break;
                    }
                }
            }

            // CRITICAL: Use LogicalPosition, not PhysicalPosition
            // monio returns macOS "points" (logical coordinates)
            let logical_pos = LogicalPosition::new(px, py);
            let _ = win.set_position(tauri::Position::Logical(logical_pos));
        }
        Err(e) => {
            eprintln!("Failed to create popup: {:?}", e);
        }
    }
}
```

#### App Setup and Commands

**src-tauri/src/lib.rs:**
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

### 5. Create Popup Frontend

**src/popup-main.tsx:**
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

**src/Popup.tsx:**
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
    await getCurrentWindow().close();
  };

  const handleSummarize = async () => {
    await invoke("summarize_text", { text: selectedText });
    await getCurrentWindow().close();
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

**src/Popup.css:**
```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  margin: 0; padding: 0; overflow: hidden;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.popup-container {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 8px; height: 100vh; width: 100vw; padding: 12px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.popup-buttons { display: flex; width: 100%; gap: 8px; }

.popup-btn {
  flex: 1; padding: 8px 12px; border: none; border-radius: 6px;
  font-size: 12px; font-weight: 500; cursor: pointer; transition: opacity 0.2s;
}
.popup-btn:hover { opacity: 0.9; }
.popup-btn-primary { background: #3b82f6; color: white; }
.popup-btn-secondary { background: #e5e7eb; color: #374151; }

.popup-text {
  max-width: 180px; font-size: 11px; color: #6b7280;
  text-align: center; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
```

## Critical Bugs & Solutions

### Bug 1: Coordinate System Mismatch (PhysicalPosition vs LogicalPosition)

**Symptom:** Popup appears at wrong position, consistently offset (half distance on 2x Retina).

**Root Cause:** `monio` returns macOS "points" (logical coordinates). Using `PhysicalPosition` causes Tauri to interpret them as raw pixels, dividing by the scale factor.

**Solution:** Always use `LogicalPosition::new(mouse_x, mouse_y)` with monio coordinates. Never `PhysicalPosition`.

### Bug 2: Popup Toggle Instead of Always Showing

**Symptom:** First selection shows popup, second hides it.

**Root Cause:** Same window label reused. `close()` is async; new `build()` with same label fails silently because the old window handle isn't fully destroyed yet.

**Solution:** Two changes:
1. Close popup on `MousePressed` (drag start), not at creation time
2. Use unique labels via `AtomicU64` counter: `selection-popup-0`, `selection-popup-1`, etc.

### Bug 3: Frontend WebviewWindow Creation Unreliable

**Symptom:** Rust emits events successfully but frontend never creates popup window.

**Root Cause:** JS `WebviewWindow` API unreliable when main window not focused. Events not consistently received by React listener.

**Solution:** Create popup from Rust using `WebviewWindowBuilder::new()`. Bypass frontend entirely for window creation. Pass selected text via URL query parameter.

### Bug 4: Clipboard-Based Text Detection Fragile

**Symptom:** Race conditions, clipboard clobbered, alert sounds on macOS.

**Root Cause:** Simulating Cmd+C → reading clipboard → restoring clipboard has too many failure modes.

**Solution:** Use the `selection` crate which calls native Accessibility API directly. Simple `selection::get_text() -> String`. No clipboard manipulation needed.

### Bug 5: Popup Clipped at Screen Edges / Multi-Monitor

**Symptom:** Popup partially off-screen near edges. Negative coordinates on secondary monitors positioned above primary.

**Root Cause:** macOS uses primary display's top-left as (0,0). Monitors above have negative Y, monitors to the left have negative X.

**Solution:** Per-monitor boundary detection:
1. Convert physical monitor bounds to logical (divide by scale factor)
2. Find which monitor contains the mouse
3. Flip popup to opposite side of cursor if overflowing
4. Clamp within monitor bounds

## Key Libraries Reference

| Library | Purpose | API |
|---------|---------|-----|
| [monio](https://github.com/HuakunShen/monio) | Global mouse/keyboard monitoring | `listen()` for events, `mouse_position()` for cursor location |
| [selection](https://github.com/pot-app/Selection) | Native text selection detection | `get_text() -> String` via Accessibility API |
| `urlencoding` | URL-encode selected text for query params | `encode(&str) -> String` |

## Comparison with Electron

| Feature | Tauri Implementation | Electron Implementation |
|---------|---------------------|------------------------|
| Input Library | `monio` (Rust) | `uiohook-napi` (Node.js) |
| Selection Library | `selection` (Rust, native a11y) | AppleScript / clipboard hack |
| Popup Creation | Rust `WebviewWindowBuilder` | `new BrowserWindow()` |
| Coordinate System | LogicalPosition (macOS points) | screen.getCursorScreenPoint() |
| Bundle Size | ~3MB | ~150MB+ |
| Memory Usage | ~50MB | ~200MB+ |

## Known Limitations

- Only detects drag-based selection. Double-click (word) and keyboard selection (Shift+Arrow) not detected.
- Selected text passed via URL query parameter — has length limits for very long selections.
- macOS only tested. Windows/Linux untested.
- Requires Accessibility permissions on macOS.
- Debug logging is verbose (should be gated for production).

## Production Considerations

1. **Accessibility Permissions**: macOS requires explicit user grant in System Settings > Privacy & Security > Accessibility
2. **Double-Click Detection**: Would need tracking click timing/count in addition to drag distance
3. **Keyboard Selection**: Would need monitoring Shift+Arrow key combos via `monio::EventType::KeyPressed`
4. **Text Passing**: For long selections, use Tauri managed state or IPC instead of URL query params
5. **System Tray**: Consider a tray icon instead of a full main window for production
