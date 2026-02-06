---
name: tauri-keycastr-input-monitoring
description: Build a KeyCastr-like global input monitoring overlay using Tauri v2, Monio, and SvelteKit. Captures keyboard and mouse events system-wide and displays them in a floating translucent window with native vibrancy effects.
license: MIT
compatibility: opencode
metadata:
  category: desktop-development
  stack: tauri-v2, rust, sveltekit, monio
  platforms: macos, windows, linux
  difficulty: intermediate
---

# Tauri KeyCastr Input Monitoring Implementation Guide

Build a KeyCastr-like global input monitoring overlay using Tauri v2, Monio, and SvelteKit.

## Overview

This skill enables creation of a floating input display window that captures system-wide keyboard and mouse events using native OS hooks. The implementation features:

- **Global Input Capture**: Monitors all keyboard and mouse events system-wide
- **Floating Overlay Window**: Always-on-top translucent display with native vibrancy effects
- **Queue-Based Display**: Keys stay visible for 2 seconds with fade animations
- **Cross-Platform**: Works on macOS, Windows, and Linux (with platform-specific adaptations)

## Architecture

```
┌─────────────────┐     Events     ┌──────────────────┐
│  Monio (Rust)   │ ─────────────► │   Main Window    │
│  Input Capture  │                │   (Controls)     │
└────────┬────────┘                └──────────────────┘
         │
         │  Tauri Events
         ▼
┌──────────────────┐
│ Keycastr Window  │
│  (Overlay UI)    │
└──────────────────┘
```

## Prerequisites

- Tauri v2 CLI installed
- Rust toolchain
- Bun or npm

## Step-by-Step Implementation

### 1. Add Dependencies

**Cargo.toml:**
```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
monio = "0.1.0"
```

**Frontend (package.json):**
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-opener": "^2.0.0"
  }
}
```

### 2. Configure Tauri Windows

**src-tauri/tauri.conf.json:**
```json
{
  "app": {
    "macOSPrivateApi": true,
    "windows": [
      {
        "label": "main",
        "title": "key-displayer",
        "width": 800,
        "height": 600
      },
      {
        "label": "keycastr",
        "title": "Keycastr",
        "url": "/keycastr",
        "width": 500,
        "height": 160,
        "visible": true,
        "transparent": true,
        "decorations": false,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "resizable": false,
        "center": false,
        "x": 440,
        "y": 600,
        "windowEffects": {
          "effects": ["popover"],
          "state": "active"
        }
      }
    ]
  }
}
```

**Critical Configuration Fields:**
- `transparent: true` - Allows window transparency
- `decorations: false` - Removes window borders
- `alwaysOnTop: true` - Stays above other windows
- `skipTaskbar: true` - Hides from taskbar/dock
- `macOSPrivateApi: true` - Required for vibrancy effects
- `windowEffects` - Native platform vibrancy (popover, blur, acrylic, mica)

### 3. Update Capabilities

**src-tauri/capabilities/default.json:**
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main", "keycastr"],
  "permissions": [
    "core:default",
    "opener:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-create",
    "core:window:allow-close",
    "core:window:allow-start-dragging",
    "core:event:allow-listen",
    "core:event:allow-emit",
    "core:event:allow-emit-to"
  ]
}
```

**Required Permission:** `core:window:allow-start-dragging` is essential for `data-tauri-drag-region` to work.

### 4. Implement Rust Backend

**src-tauri/src/lib.rs:**
```rust
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, serde::Serialize)]
struct KeyEvent {
    #[serde(rename = "type")]
    event_type: String,
    key: Option<String>,
    keys: Vec<String>,
    button: Option<u32>,
    x: Option<f64>,
    y: Option<f64>,
    timestamp: u64,
}

pub struct AppState {
    pressed_keys: Arc<Mutex<std::collections::HashSet<String>>>,
    is_monitoring: Arc<AtomicBool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            pressed_keys: Arc::new(Mutex::new(std::collections::HashSet::new())),
            is_monitoring: Arc::new(AtomicBool::new(false)),
        }
    }
}

fn get_key_name(key: monio::Key) -> String {
    use monio::Key;
    match key {
        Key::Escape => "Esc".to_string(),
        Key::Backspace => "⌫".to_string(),
        Key::Tab => "Tab".to_string(),
        Key::Enter => "↵".to_string(),
        Key::ShiftLeft | Key::ShiftRight => "Shift".to_string(),
        Key::ControlLeft | Key::ControlRight => "Ctrl".to_string(),
        Key::AltLeft | Key::AltRight => "Alt".to_string(),
        Key::MetaLeft | Key::MetaRight => "⌘".to_string(),
        Key::Space => "Space".to_string(),
        Key::ArrowUp => "↑".to_string(),
        Key::ArrowDown => "↓".to_string(),
        Key::ArrowLeft => "←".to_string(),
        Key::ArrowRight => "→".to_string(),
        Key::CapsLock => "Caps".to_string(),
        Key::Delete => "Del".to_string(),
        Key::Insert => "Ins".to_string(),
        Key::Home => "Home".to_string(),
        Key::End => "End".to_string(),
        Key::PageUp => "PgUp".to_string(),
        Key::PageDown => "PgDn".to_string(),
        Key::F1 => "F1".to_string(),
        Key::F2 => "F2".to_string(),
        Key::F3 => "F3".to_string(),
        Key::F4 => "F4".to_string(),
        Key::F5 => "F5".to_string(),
        Key::F6 => "F6".to_string(),
        Key::F7 => "F7".to_string(),
        Key::F8 => "F8".to_string(),
        Key::F9 => "F9".to_string(),
        Key::F10 => "F10".to_string(),
        Key::F11 => "F11".to_string(),
        Key::F12 => "F12".to_string(),
        _ => format!("{:?}", key),
    }
}

fn run_input_monitoring(app_handle: AppHandle, state: Arc<AppState>) -> Result<(), String> {
    use monio::{listen, Event, EventType};

    let pressed_keys = state.pressed_keys.clone();
    let is_monitoring = state.is_monitoring.clone();
    let app_handle_for_closure = app_handle.clone();
    let last_mouse_move = Arc::new(AtomicU64::new(0));

    is_monitoring.store(true, Ordering::SeqCst);

    listen(move |event: &Event| {
        if !is_monitoring.load(Ordering::SeqCst) {
            return;
        }

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        match event.event_type {
            EventType::KeyPressed => {
                if let Some(kb) = &event.keyboard {
                    let key_name = get_key_name(kb.key);
                    pressed_keys.lock().unwrap().insert(key_name.clone());

                    let event_data = KeyEvent {
                        event_type: "keydown".to_string(),
                        key: Some(key_name.clone()),
                        keys: pressed_keys.lock().unwrap().iter().cloned().collect(),
                        button: None,
                        x: None,
                        y: None,
                        timestamp,
                    };

                    let _ = app_handle_for_closure.emit("keycastr-event", event_data);
                }
            }
            EventType::KeyReleased => {
                if let Some(kb) = &event.keyboard {
                    let key_name = get_key_name(kb.key);
                    pressed_keys.lock().unwrap().remove(&key_name);

                    let event_data = KeyEvent {
                        event_type: "keyup".to_string(),
                        key: Some(key_name),
                        keys: pressed_keys.lock().unwrap().iter().cloned().collect(),
                        button: None,
                        x: None,
                        y: None,
                        timestamp,
                    };

                    let _ = app_handle_for_closure.emit("keycastr-event", event_data);
                }
            }
            EventType::MousePressed => {
                if let Some(mouse) = &event.mouse {
                    let btn_name = mouse
                        .button
                        .and_then(|b| match b {
                            monio::Button::Left => Some("MouseL"),
                            monio::Button::Middle => Some("MouseM"),
                            monio::Button::Right => Some("MouseR"),
                            _ => None,
                        })
                        .unwrap_or("Mouse");

                    pressed_keys.lock().unwrap().insert(btn_name.to_string());

                    let event_data = KeyEvent {
                        event_type: "mousedown".to_string(),
                        key: Some(btn_name.to_string()),
                        keys: pressed_keys.lock().unwrap().iter().cloned().collect(),
                        button: mouse.button.map(|b| match b {
                            monio::Button::Left => 1,
                            monio::Button::Middle => 2,
                            monio::Button::Right => 3,
                            _ => 0,
                        }),
                        x: Some(mouse.x),
                        y: Some(mouse.y),
                        timestamp,
                    };

                    let _ = app_handle_for_closure.emit("keycastr-event", event_data);
                }
            }
            EventType::MouseReleased => {
                if let Some(mouse) = &event.mouse {
                    let btn_name = mouse
                        .button
                        .and_then(|b| match b {
                            monio::Button::Left => Some("MouseL"),
                            monio::Button::Middle => Some("MouseM"),
                            monio::Button::Right => Some("MouseR"),
                            _ => None,
                        })
                        .unwrap_or("Mouse");

                    pressed_keys.lock().unwrap().remove(btn_name);

                    let event_data = KeyEvent {
                        event_type: "mouseup".to_string(),
                        key: Some(btn_name.to_string()),
                        keys: pressed_keys.lock().unwrap().iter().cloned().collect(),
                        button: mouse.button.map(|b| match b {
                            monio::Button::Left => 1,
                            monio::Button::Middle => 2,
                            monio::Button::Right => 3,
                            _ => 0,
                        }),
                        x: Some(mouse.x),
                        y: Some(mouse.y),
                        timestamp,
                    };

                    let _ = app_handle_for_closure.emit("keycastr-event", event_data);
                }
            }
            EventType::MouseMoved | EventType::MouseDragged => {
                if timestamp.saturating_sub(last_mouse_move.load(Ordering::Relaxed)) < 50 {
                    return;
                }
                last_mouse_move.store(timestamp, Ordering::Relaxed);

                if let Some(mouse) = &event.mouse {
                    let event_data = KeyEvent {
                        event_type: "mousemove".to_string(),
                        key: None,
                        keys: pressed_keys.lock().unwrap().iter().cloned().collect(),
                        button: None,
                        x: Some(mouse.x),
                        y: Some(mouse.y),
                        timestamp,
                    };

                    let _ = app_handle_for_closure.emit("keycastr-event", event_data);
                }
            }
            _ => {}
        }
    })
    .map_err(|e| format!("Input hook error: {}", e))?;

    Ok(())
}

#[tauri::command]
fn start_monitoring(app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if state.is_monitoring.load(Ordering::SeqCst) {
        return Ok(());
    }

    let state_arc = Arc::new(AppState {
        pressed_keys: state.pressed_keys.clone(),
        is_monitoring: state.is_monitoring.clone(),
    });

    std::thread::spawn(move || {
        if let Err(e) = run_input_monitoring(app_handle, state_arc) {
            eprintln!("Input monitoring error: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_monitoring(state: State<'_, AppState>) -> Result<(), String> {
    state.is_monitoring.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn is_monitoring(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.is_monitoring.load(Ordering::SeqCst))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            start_monitoring,
            stop_monitoring,
            is_monitoring
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 5. Create Main Control Page

**src/routes/+page.svelte:**
```svelte
<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { getAllWindows } from "@tauri-apps/api/window";
  import { onMount } from "svelte";

  let isMonitoring = $state(false);
  let keycastrVisible = $state(true);

  async function getKeycastrWindow() {
    const windows = await getAllWindows();
    return windows.find(w => w.label === 'keycastr');
  }

  async function toggleMonitoring() {
    try {
      if (isMonitoring) {
        await invoke("stop_monitoring");
        isMonitoring = false;
      } else {
        await invoke("start_monitoring");
        isMonitoring = true;
      }
    } catch (e) {
      console.error("Failed to toggle monitoring:", e);
    }
  }

  async function toggleKeycastrWindow() {
    try {
      const keycastrWindow = await getKeycastrWindow();
      if (!keycastrWindow) return;
      
      if (keycastrVisible) {
        await keycastrWindow.hide();
        keycastrVisible = false;
      } else {
        await keycastrWindow.show();
        keycastrVisible = true;
      }
    } catch (e) {
      console.error("Failed to toggle keycastr window:", e);
    }
  }

  onMount(async () => {
    try {
      isMonitoring = await invoke("is_monitoring");
      const keycastrWindow = await getKeycastrWindow();
      if (keycastrWindow) {
        keycastrVisible = await keycastrWindow.isVisible();
      }
    } catch (e) {
      console.error("Failed to get initial state:", e);
    }
  });
</script>

<main class="container">
  <h1>Key Displayer</h1>
  <p class="subtitle">A KeyCastr-like input monitoring app</p>

  <div class="controls">
    <button 
      class="btn-primary {isMonitoring ? 'active' : ''}" 
      onclick={toggleMonitoring}
    >
      {isMonitoring ? '⏹ Stop Monitoring' : '▶ Start Monitoring'}
    </button>

    <button 
      class="btn-secondary {keycastrVisible ? 'active' : ''}" 
      onclick={toggleKeycastrWindow}
    >
      {keycastrVisible ? '👁 Hide Overlay' : '👁 Show Overlay'}
    </button>
  </div>
</main>
```

### 6. Create Keycastr Overlay Component

**src/routes/keycastr/+page.svelte:**
```svelte
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";

  interface KeycastrEvent {
    type: string;
    key?: string;
    keys?: string[];
    button?: number;
    x?: number;
    y?: number;
    timestamp: number;
  }

  interface QueuedKey {
    id: number;
    key: string;
    timestamp: number;
    fading: boolean;
  }

  const modifierKeys = ["Ctrl", "Alt", "Shift", "⌘"];
  const specialKeys = ["Esc", "Tab", "Caps", "Enter", "⌫", "Del", "Ins", "Home", "End", "PgUp", "PgDn"];
  const mouseButtons = ["MouseL", "MouseM", "MouseR"];

  let keyQueue = $state<QueuedKey[]>([]);
  let mousePos = $state({ x: 0, y: 0 });
  let unlisten: UnlistenFn | undefined;
  let fadeInterval: ReturnType<typeof setInterval> | null = null;
  let keyIdCounter = 0;

  const MAX_QUEUE_SIZE = 8;
  const KEY_LIFETIME_MS = 2000;
  const FADE_DURATION_MS = 500;

  function getKeyClass(key: string, fading: boolean): string {
    const baseClass = "key-badge";
    const fadeClass = fading ? "fading" : "active";
    
    if (mouseButtons.includes(key)) return `${baseClass} ${fadeClass} mouse`;
    if (modifierKeys.includes(key)) return `${baseClass} ${fadeClass} modifier`;
    if (specialKeys.includes(key)) return `${baseClass} ${fadeClass} special`;
    return `${baseClass} ${fadeClass} regular`;
  }

  function addToQueue(key: string) {
    const now = Date.now();
    keyIdCounter++;
    
    const newKey: QueuedKey = {
      id: keyIdCounter,
      key,
      timestamp: now,
      fading: false,
    };

    keyQueue = [...keyQueue, newKey];

    if (keyQueue.length > MAX_QUEUE_SIZE) {
      const oldest = keyQueue[0];
      if (oldest && !oldest.fading) {
        oldest.fading = true;
        keyQueue = [...keyQueue];
        
        setTimeout(() => {
          keyQueue = keyQueue.filter(k => k.id !== oldest.id);
        }, FADE_DURATION_MS);
      }
    }
  }

  function processExpiredKeys() {
    const now = Date.now();
    let hasChanges = false;
    
    for (const qk of keyQueue) {
      if (!qk.fading && now - qk.timestamp > KEY_LIFETIME_MS) {
        qk.fading = true;
        hasChanges = true;
        
        setTimeout(() => {
          keyQueue = keyQueue.filter(k => k.id !== qk.id);
        }, FADE_DURATION_MS);
      }
    }
    
    if (hasChanges) keyQueue = [...keyQueue];
  }

  async function closeWindow() {
    const window = getCurrentWindow();
    await window.hide();
  }

  onMount(async () => {
    unlisten = await listen<KeycastrEvent>("keycastr-event", (event) => {
      const data = event.payload;
      
      if (data.type === "keydown" && data.key) {
        addToQueue(data.key);
      } else if (data.type === "mousedown") {
        const buttonNames = ["MouseL", "MouseM", "MouseR"];
        const btn = data.button ? buttonNames[data.button - 1] || `Mouse${data.button}` : "Mouse";
        addToQueue(btn);
      } else if (data.type === "mousemove" && data.x !== undefined && data.y !== undefined) {
        mousePos = { x: Math.round(data.x), y: Math.round(data.y) };
      }
    });

    fadeInterval = setInterval(processExpiredKeys, 100);
  });

  onDestroy(() => {
    unlisten?.();
    if (fadeInterval) clearInterval(fadeInterval);
  });
</script>

<div class="keycastr-container">
  <div class="drag-handle" data-tauri-drag-region>
    <div class="drag-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <button class="close-btn" onclick={closeWindow} title="Hide"></button>
  </div>

  <div class="keys-wrapper">
    {#if keyQueue.length === 0}
      <span class="waiting-text">Waiting for input...</span>
    {:else}
      {#each keyQueue as qk (qk.id)}
        <span class={getKeyClass(qk.key, qk.fading)}>
          {#if mouseButtons.includes(qk.key)}
            <span class="mouse-icon" data-btn={qk.key.slice(-1)}></span>
          {:else}
            {qk.key}
          {/if}
        </span>
      {/each}
    {/if}
  </div>
  
  <div class="mouse-pos">
    {mousePos.x}, {mousePos.y}
  </div>
</div>

<style>
  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: transparent;
  }

  .keycastr-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 12px;
    overflow: hidden;
    user-select: none;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 2px 8px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .drag-handle {
    width: 100%;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    position: relative;
    cursor: grab;
    app-region: drag;
    -webkit-app-region: drag;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .drag-handle button {
    app-region: no-drag;
    -webkit-app-region: no-drag;
  }

  .keys-wrapper {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: center;
    padding: 16px 20px;
    max-width: 100%;
    flex: 1;
    overflow: hidden;
  }

  .key-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 38px;
    padding: 0 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.3),
      0 1px 2px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.12);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .key-badge.regular {
    background: linear-gradient(145deg, #3a3a3c, #2c2c2e);
    color: #f5f5f7;
  }

  .key-badge.modifier {
    background: linear-gradient(145deg, #0a84ff, #0077ed);
    color: white;
  }

  .key-badge.special {
    background: linear-gradient(145deg, #bf5af2, #a855f7);
    color: white;
  }

  .key-badge.mouse {
    background: linear-gradient(145deg, #30d158, #28bd4a);
    color: white;
    padding: 0 10px;
  }
</style>
```

## Critical Bugs & Solutions

### Bug 1: Input Monitoring Not Capturing Events

**Symptom:** App runs but doesn't capture keyboard/mouse input.

**Root Cause:** On macOS, the app needs Accessibility permissions granted in System Preferences.

**Solution:** 
1. Go to System Preferences > Security & Privacy > Privacy > Accessibility
2. Add the key-displayer binary (from `src-tauri/target/debug/`)
3. Restart the app

### Bug 2: Cannot Drag the Overlay Window

**Symptom:** The `data-tauri-drag-region` attribute doesn't enable dragging.

**Root Cause:** Missing permission in capabilities file.

**Solution:** Add to `capabilities/default.json`:
```json
"permissions": [
  "core:window:allow-start-dragging"
]
```

Also add CSS:
```css
.drag-handle {
  app-region: drag;
  -webkit-app-region: drag;
}

.drag-handle button {
  app-region: no-drag;
  -webkit-app-region: no-drag;
}
```

### Bug 3: Window Effects Configuration Error

**Symptom:** Build error: "unknown field `effects`"

**Root Cause:** Wrong field name in tauri.conf.json.

**Solution:** Use `windowEffects` (camelCase), not `effects`:
```json
"windowEffects": {
  "effects": ["popover"],
  "state": "active"
}
```

### Bug 4: Mouse Events Not Showing

**Symptom:** Mouse clicks don't appear in the display.

**Root Cause:** Mouse buttons weren't being tracked in the same Set as keyboard keys.

**Solution:** Track mouse buttons in `pressedKeys` Set:
```rust
pressed_keys.lock().unwrap().insert(btn_name.to_string());
```

### Bug 5: MouseMove Event Flooding

**Symptom:** Performance issues from excessive mousemove events.

**Root Cause:** Mousemove fires hundreds of times per second.

**Solution:** Throttle to 50ms (max 20 updates/sec):
```rust
if timestamp.saturating_sub(last_mouse_move.load(Ordering::Relaxed)) < 50 {
    return;
}
```

## Window Effects Reference

**macOS Effects:**
- `popover` - Popover vibrancy effect (recommended for overlays)
- `sheet` - Sheet presentation style
- `hudWindow` - HUD window style
- `sidebar` - Sidebar material
- `menu` - Menu material
- `tooltip` - Tooltip material
- `underWindowBackground` - Under window background
- `windowBackground` - Window background

**Windows Effects:**
- `mica` - Windows 11 Mica effect
- `acrylic` - Windows 10/11 Acrylic effect
- `blur` - Windows 7/10/11 Blur effect
- `tabbed` - Tabbed Mica effect
- `tabbedDark` - Dark tabbed effect
- `tabbedLight` - Light tabbed effect

**Linux:**
- No native effects supported; transparency controlled by compositor

## Comparison with Electron

| Feature | Tauri Implementation | Electron Implementation |
|---------|---------------------|------------------------|
| Input Library | `monio` (Rust) | `uiohook-napi` (Node.js) |
| Bundle Size | ~3MB | ~150MB+ |
| Memory Usage | ~50MB | ~200MB+ |
| Native Effects | Built-in `windowEffects` | Requires `window-vibrancy` crate |
| Permissions | Capability JSON files | Main process configuration |
| IPC | Tauri events | electron IPC + contextBridge |

## Production Considerations

1. **Code Signing**: Required for macOS distribution to avoid "untrusted developer" warnings
2. **Notarization**: macOS apps must be notarized for distribution outside App Store
3. **Windows Defender**: May flag as keylogger (expected for input monitoring apps)
4. **Privacy Policy**: Required for apps that capture user input
5. **Opt-in Consent**: Consider showing a consent dialog before starting monitoring

## Troubleshooting

**App doesn't show any input:**
- Check Accessibility permissions (macOS)
- Check if `start_monitoring` command was called
- Look at terminal logs for errors

**Window doesn't have vibrancy effect:**
- Ensure `macOSPrivateApi: true` is set
- Use correct effect name for your platform
- Try different effect types (some don't work on all macOS versions)

**Drag region not working:**
- Verify `core:window:allow-start-dragging` permission
- Check CSS `app-region` properties are applied
- Ensure element has `data-tauri-drag-region` attribute
