# Tauri Floating Window

A Raycast-style floating spotlight window implementation using Tauri v2 + Svelte.

## Features

- **Floating Window**: No dock icon, no alt-tab visibility, always on top
- **Global Shortcut**: Cmd+Shift+H to toggle window visibility
- **System Tray**: Menu bar icon with Show/Quit options
- **Blurry Background**: Native macOS vibrancy/blur effects
- **Pin/Unpin**: Keep window open on blur
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

#### Global Shortcut Registration
```rust
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

let shortcut = Shortcut::new(
    Some(tauri_plugin_global_shortcut::Modifiers::META | 
         tauri_plugin_global_shortcut::Modifiers::SHIFT),
    tauri_plugin_global_shortcut::Code::KeyH
);

app.global_shortcut()
    .on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            // Toggle window visibility
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

#### Auto-focus Input on Show
```rust
window.eval("document.querySelector('.spotlight-input')?.focus()").ok();
```

### 3. Frontend (`src/routes/+page.svelte`)

#### Window Dragging
Add `data-tauri-drag-region` attribute to draggable elements:
```html
<main class="spotlight-container" data-tauri-drag-region>
  <div class="input-wrapper" data-tauri-drag-region>
    <svg class="search-icon" data-tauri-drag-region>...</svg>
```

#### Pin/Unpin Feature
```typescript
let isPinned = $state(false)

function handleBlur(e: FocusEvent) {
  if (isPinned) return
  // Only hide if not pinned
  const relatedTarget = e.relatedTarget as HTMLElement | null
  if (!relatedTarget || !document.contains(relatedTarget)) {
    invoke("hide_window")
  }
}
```

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
When showing window via shortcut or tray, explicitly focus the input:
```rust
window.show();
window.set_focus();
window.eval("document.querySelector('.spotlight-input')?.focus()").ok();
```

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
