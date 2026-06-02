# NSPanel Integration Design

**Date:** 2026-06-03
**Status:** Approved
**Scope:** `examples/floating-command-window`

## Problem

The current implementation uses a regular Tauri `WebviewWindow` that calls `set_focus()` when shown. On macOS this activates the application, which:

1. Switches the previously-active app to the background, losing the user's cursor position and selection in that app.
2. Defeats the purpose of a Spotlight-style launcher — the user wants to issue a command and return to what they were doing without context loss.

## Goal

Convert the existing "main" window into a macOS `NSPanel` subclass (`SpotlightPanel`) so that:

- The panel can receive keyboard input (search box focus works).
- The previously-active application stays in the foreground, keeping its cursor position and selection.
- All existing UX (global shortcut, tray, blur-to-hide, pin, system effects) keeps working.

## Non-Goals

- Cross-platform support. `NSPanel` is macOS-only. Linux/Windows builds are out of scope.
- Replacing the window configuration system. The existing `tauri.conf.json` window config is preserved; the panel is built on top of the converted window.
- New user-facing features. This is a behavioral change only.

## Approach

Add [`tauri-nspanel`](https://github.com/ahkohd/tauri-nspanel) v2.1 as a dependency. Define a single panel class `SpotlightPanel` and convert the existing "main" window into that panel at setup time. Replace window show/hide calls with panel equivalents. No frontend changes.

### Panel Configuration

```rust
use tauri_nspanel::tauri_panel;

tauri_panel! {
    panel!(SpotlightPanel {
        config: {
            can_become_key_window: true,        // receive keyboard input
            can_become_main_window: false,      // never main window
            is_floating_panel: true,            // float above other windows
            becomes_key_only_if_needed: true,   // key window only when needed
        }
    })
}
```

`show_and_make_key()` (used on display) is what makes the panel receive input without activating the host application. This is the Spotlight/Raycast behavior.

## Components

### 1. Cargo.toml — new dependency

```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api", "tray-icon"] }
tauri-plugin-opener = "2"
tauri-plugin-global-shortcut = "2.3.1"
tauri-nspanel = { git = "https://github.com/ahkohd/tauri-nspanel", branch = "v2.1" }
```

The library is pulled from the `v2.1` git branch (the maintained version).

### 2. src-tauri/src/lib.rs — panel class + plugin

Add the `tauri_panel!` block at the top of the file and register the plugin in the builder:

```rust
.plugin(tauri_nspanel::init())
```

### 3. src-tauri/src/lib.rs — setup hook

The existing setup does three things with the "main" window: show on startup, register shortcut, build tray. Each path needs to use the panel after conversion.

#### Panel conversion

Performed once at the start of setup:

```rust
let window = app.get_webview_window("main").unwrap();
let panel = window.to_panel::<SpotlightPanel>().unwrap();
```

`to_panel` is the `WebviewWindowExt` method that retypes the underlying AppKit window as an `NSPanel` subclass. This must happen before any `show`/`hide` calls.

#### Helper function: show_spotlight

The current code duplicates the "show + center + focus input" sequence in three places (startup, shortcut handler, tray "show" menu, tray click). With the panel, that sequence is:

```rust
fn show_spotlight(app: &AppHandle) {
    if let Some(panel) = app.get_webview_panel("main") {
        let _ = panel.show_and_make_key();
        let _ = panel.center();
        if let Some(window) = panel.to_window() {
            let _ = window.eval("document.querySelector('.spotlight-input')?.focus()");
        }
    }
}
```

Extracting this is justified by the change itself — the panel-specific calls would otherwise be repeated in three places.

The `get_webview_panel` lookup inside the function (rather than capturing the converted `panel` value) is required because the shortcut and tray closures are `Fn` (not `FnOnce`); they cannot move owned values out. `AppHandle` is cheap to clone and re-lookups are O(1).

#### Helper function: hide_spotlight

```rust
fn hide_spotlight(app: &AppHandle) {
    if let Some(panel) = app.get_webview_panel("main") {
        let _ = panel.hide();
    }
}
```

#### Shortcut handler

Replaces the current inline `if visible { hide } else { show }` with calls to the helpers. Visibility check uses `panel.is_visible()`.

#### Tray

Same pattern. "show" menu and left-click both call `show_spotlight(app)`. "quit" still calls `app.exit(0)`.

### 4. `hide_window` command

Signature stays the same (`fn hide_window(app: &AppHandle)`) so the frontend's `invoke("hide_window")` calls keep working. Body becomes:

```rust
hide_spotlight(app);
```

The unused `Runtime` generic in the current signature is dropped.

## Data Flow

```
[User presses Cmd+Shift+H]
       │
       ▼
[GlobalShortcut callback in Rust]
       │  app.get_webview_panel("main")
       ▼
[SpotlightPanel instance]
       │
       ├── panel.is_visible() == true  → panel.hide()
       │
       └── panel.is_visible() == false → panel.show_and_make_key()
                                          panel.center()
                                          window.eval("focus input")
                                          │
                                          ▼
[Panel becomes key window]
[Host app NOT activated]
[User's previous app keeps focus and cursor position]
```

The blur-to-hide flow on the frontend (via `handleBlur` and Escape key) calls `invoke("hide_window")` → `hide_spotlight(app)` → `panel.hide()`. Unchanged in shape, just routed through the panel.

## Error Handling

- `get_webview_panel` returns `Result`; use `if let Some` to silently skip on miss (consistent with the current `unwrap_or(false)` style for `is_visible`).
- `show_and_make_key` / `hide` / `center` return `tauri::Result`; ignore with `let _ =` (consistent with the current `let _ = window.show()` pattern).
- `to_panel` in setup is `unwrap()`'d — if the panel conversion fails, the app cannot function. This matches the existing `app.get_webview_window("main").unwrap()` style: the window is required to exist at startup.

## File Changes Summary

| File | Change |
|------|--------|
| `src-tauri/Cargo.toml` | Add `tauri-nspanel` git dep |
| `src-tauri/src/lib.rs` | Add `tauri_panel!` block, register plugin, convert window to panel in setup, extract `show_spotlight` / `hide_spotlight` helpers, update shortcut + tray to use helpers, simplify `hide_window` command |

No changes to: `tauri.conf.json`, `capabilities/default.json`, `src/routes/+page.svelte`, `Entitlements.plist`, `package.json`.

## Verification

Build and run:

```
cd /Users/hk/Dev/tauri-demo/examples/floating-command-window
pnpm tauri dev
```

Manual checks:

1. **Non-activating behavior:** Open another app (e.g. TextEdit or VSCode), type some text, position the cursor mid-sentence, then press `Cmd+Shift+H`. The panel appears, search box is focused, but the other app's text is unchanged and the cursor is still where it was.
2. **Existing UX preserved:** Show/hide via shortcut, show via tray icon, show via tray menu, blur-to-hide, Escape-to-hide, pin/unpin all work as before.
3. **Compile check:** `cargo check` (in `src-tauri/`) passes on macOS.
