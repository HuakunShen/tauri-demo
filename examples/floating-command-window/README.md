# Tauri Floating NSPanel Window

A Raycast-style floating spotlight panel implementation using Tauri v2 + Svelte + macOS `NSPanel`.

## Features

- **Floating NSPanel**: Non-activating macOS panel that does not steal focus from the current app
- **Global Shortcut**: Cmd+Shift+H to toggle window visibility
- **System Tray**: Menu bar icon with Show/Quit options
- **Blurry Background**: Native macOS vibrancy/blur effects
- **Draggable**: Drag window by the search icon
- **Command Palette**: Searchable command list with keyboard navigation

## Architecture Overview

### 1. Window Configuration (`tauri.conf.json`)

```json
{
  "app": {
    "macOSPrivateApi": true,
    "windows": [{
      "label": "main",
      "width": 600,
      "height": 400,
      "decorations": false,
      "transparent": true,
      "alwaysOnTop": true,
      "skipTaskbar": true,
      "visible": true,
      "windowEffects": {
        "effects": ["popover"],
        "radius": 10,
        "state": "active"
      }
    }]
  }
}
```

**Key Properties:**
- `macOSPrivateApi`: Required for window effects and activation policy
- `decorations: false`: Removes window title bar and borders
- `transparent: true`: Allows see-through background
- `skipTaskbar: true`: Hides from dock and alt-tab
- `windowEffects`: Native macOS blur/vibrancy with rounded corners

### 2. Rust Backend (`src-tauri/src/lib.rs`)

#### Hide Dock Icon (macOS)
```rust
#[cfg(target_os = "macos")]
{
    app.set_activation_policy(tauri::ActivationPolicy::Accessory);
}
```

#### NSPanel Setup
```rust
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

let window = app.get_webview_window("main").unwrap();
let _panel = window.to_panel::<SpotlightPanel>().unwrap();
```

#### Global Shortcut Registration
```rust
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

let shortcut = Shortcut::new(
    Some(tauri_plugin_global_shortcut::Modifiers::META | 
         tauri_plugin_global_shortcut::Modifiers::SHIFT),
    tauri_plugin_global_shortcut::Code::KeyH
);

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

#### System Tray Setup
```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
};

let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

let _ = TrayIconBuilder::with_id("tray")
    .tooltip("CrossCopy")
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .menu_on_left_click(true)
    .on_menu_event(|app, event| { /* ... */ })
    .on_tray_icon_event(|tray, event| { /* ... */ })
    .build(app)?;
```

#### Show/Hide Helpers
```rust
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

### 3. Frontend (`src/routes/+page.svelte`)

#### Window Dragging
Add `data-tauri-drag-region` attribute to draggable elements:
```html
<main class="spotlight-container" data-tauri-drag-region>
  <div class="input-wrapper" data-tauri-drag-region>
    <svg class="search-icon" data-tauri-drag-region>...</svg>
```

#### NSPanel Focus Caveat
Do not use the search input's `blur` event as the default hide trigger in NSPanel mode. A non-activating panel can briefly blur while becoming key, which makes the panel flash: show, immediately hide, then show again.

Use explicit hide paths instead:
- Cmd+Shift+H toggles the panel
- Escape hides the panel
- Selecting a command hides the panel

#### Keyboard Navigation
```typescript
onMount(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") invoke("hide_window")
    if (e.key === "ArrowDown") {
      e.preventDefault()
      selectedIndex = (selectedIndex + 1) % filteredCommands.length
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length
    }
    if (e.key === "Enter") {
      if (filteredCommands.length > 0) {
        handleSelect(filteredCommands[selectedIndex])
      }
    }
  }
  window.addEventListener("keydown", handleKeyDown)
})
```

### 4. Permissions (`capabilities/default.json`)

```json
{
  "permissions": [
    "core:default",
    "opener:default",
    "global-shortcut:default"
  ]
}
```

### 5. Dependencies (`Cargo.toml`)

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "macos-private-api"] }
tauri-plugin-opener = "2"
tauri-plugin-global-shortcut = "2"
tauri-nspanel = { git = "https://github.com/ahkohd/tauri-nspanel", branch = "v2.1" }
```

## File Structure

```
apps/tauri-desktop/
├── src-tauri/
│   ├── src/lib.rs          # Rust backend logic
│   ├── Cargo.toml          # Rust dependencies
│   ├── tauri.conf.json     # Window configuration
│   ├── capabilities/
│   │   └── default.json    # Permission definitions
│   └── Entitlements.plist  # macOS entitlements
├── src/routes/
│   └── +page.svelte        # Main UI component
└── package.json            # Node dependencies
```

## Key Implementation Details

### Window Effects (macOS)
Tauri v2 provides native window effects via `windowEffects` config:
- `effects`: ["popover"] - macOS popover-style blur
- `radius`: Corner radius in pixels
- `state`: "active" | "inactive" | "followsWindowActiveState"

Available effects: `popover`, `menu`, `hudWindow`, `contentBackground`, `headerView`, etc.

### CSS for Transparent Window
```css
:root {
  background: transparent;
}

.spotlight-wrapper {
  background: transparent; /* Let window effect show through */
}
```

### Focus Management
When showing the panel via shortcut or tray, use `show_and_make_key()` and then focus the input through the regular Tauri window handle:
```rust
panel.show_and_make_key();
if let Some(window) = app.get_webview_window("main") {
    let _ = window.eval("document.querySelector('.spotlight-input')?.focus()");
}
```

Do **not** call `panel.to_window()` during normal show/focus flow. In `tauri-nspanel`, `to_window()` converts the panel back to a regular window. Calling it after startup makes later `get_webview_panel("main")` lookups fail.

### Tray Icon
The tray icon uses the app icon by default:
```rust
.icon(app.default_window_icon().unwrap().clone())
```

## Build & Run

```bash
cd apps/tauri-desktop
pnpm install
pnpm tauri dev
```

## References

- [Tauri Window Effects](https://v2.tauri.app/reference/config/#windoweffectsconfig)
- [Tauri System Tray](https://v2.tauri.app/learn/system-tray)
- [Tauri Global Shortcut](https://v2.tauri.app/plugin/global-shortcut)
- [Tauri macOS Private API](https://v2.tauri.app/reference/config/#macosprivateapi)
- [tauri-nspanel](https://github.com/ahkohd/tauri-nspanel)
