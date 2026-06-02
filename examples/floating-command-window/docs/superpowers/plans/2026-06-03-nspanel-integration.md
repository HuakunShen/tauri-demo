# NSPanel Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the floating-command-window's main window into a `tauri-nspanel` `SpotlightPanel` so the launcher can show and accept keyboard input without activating the host application (Spotlight/Raycast behavior).

**Architecture:** Add `tauri-nspanel` as a Cargo dependency, define one panel class via the `tauri_panel!` macro, convert the existing "main" window to that panel in `setup`, and route all show/hide calls through two helper functions. Frontend and Tauri config are untouched.

**Tech Stack:** Tauri v2, Svelte 5, `tauri-nspanel` v2.1 (git), Rust 2021, macOS only.

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `src-tauri/Cargo.toml` | Modify | Add `tauri-nspanel` git dependency |
| `src-tauri/src/lib.rs` | Modify | Define `SpotlightPanel` class, register plugin, convert window in setup, add `show_spotlight` / `hide_spotlight` helpers, update shortcut + tray to use helpers, simplify `hide_window` command |

`src-tauri/src/lib.rs` is currently 125 lines and will grow to ~150. It stays a single file — not unwieldy enough to split.

No changes to `tauri.conf.json`, `capabilities/default.json`, `src/routes/+page.svelte`, `Entitlements.plist`, or `package.json`.

---

## Task 1: Add tauri-nspanel dependency

**Files:**
- Modify: `src-tauri/Cargo.toml:20-26`

- [ ] **Step 1: Add the dependency line**

Edit `src-tauri/Cargo.toml`. Find the existing dependencies block:

```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api", "tray-icon"] }
tauri-plugin-opener = "2"

serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-global-shortcut = "2.3.1"
```

Add `tauri-nspanel` as a new line after `tauri-plugin-global-shortcut`:

```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api", "tray-icon"] }
tauri-plugin-opener = "2"

serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-global-shortcut = "2.3.1"
tauri-nspanel = { git = "https://github.com/ahkohd/tauri-nspanel", branch = "v2.1" }
```

- [ ] **Step 2: Verify cargo can resolve the new dep**

Run:
```bash
cd src-tauri && cargo fetch
```

Expected: completes without errors. New entries for `tauri-nspanel`, `objc2-app-kit`, etc. will appear in `Cargo.lock` (created or updated).

- [ ] **Step 3: Verify the project still compiles**

Run:
```bash
cd src-tauri && cargo check
```

Expected: `Finished` line at the end with no errors. Warnings about unused imports or similar are fine.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(floating-command-window): add tauri-nspanel dependency"
```

---

## Task 2: Define SpotlightPanel and register the plugin

**Files:**
- Modify: `src-tauri/src/lib.rs:1-23`

- [ ] **Step 1: Add tauri-nspanel imports**

Replace the existing import block at the top of `src-tauri/src/lib.rs`:

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
```

with:

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};
use tauri_nspanel::{tauri_panel, ManagerExt, WebviewWindowExt};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
```

Notes:
- `Runtime` is kept for now because `hide_window` still uses it. It will be removed in Task 5 when the command is simplified to take `AppHandle` instead of `tauri::Window<R>`.
- `AppHandle` is added now because it will be needed by the helpers in Task 3.
- `ManagerExt` and `WebviewWindowExt` come from `tauri-nspanel` and provide `get_webview_panel` and `to_panel`.

- [ ] **Step 2: Add the panel class definition**

Insert this block immediately above `// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/` (i.e. just before line 9 of the original file):

```rust
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
```

- [ ] **Step 3: Register the plugin in the builder**

In the `tauri::Builder::default()` chain, add a new line for the nspanel plugin. Find:

```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
```

and insert the nspanel plugin line between the global-shortcut plugin and `.setup`:

```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_nspanel::init())
        .setup(|app| {
```

- [ ] **Step 4: Verify the project still compiles**

Run:
```bash
cd src-tauri && cargo check
```

Expected: `Finished` with no errors. Two `dead_code` warnings about `AppHandle` and `WebviewWindowExt` being unused are expected — both will be used in Task 3. If you see "method `to_panel` not found" or similar, the `WebviewWindowExt` import is missing — re-check Step 1.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(floating-command-window): define SpotlightPanel class and register nspanel plugin"
```

---

## Task 3: Convert window to panel in setup and add helpers

**Files:**
- Modify: `src-tauri/src/lib.rs` — `setup` closure and a new helpers block before it

- [ ] **Step 1: Add the helper functions**

Insert these two functions immediately above `#[cfg_attr(mobile, tauri::mobile_entry_point)]` (i.e. just above the `pub fn run()` definition):

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

fn hide_spotlight(app: &AppHandle) {
    if let Some(panel) = app.get_webview_panel("main") {
        let _ = panel.hide();
    }
}
```

- [ ] **Step 2: Convert the window in setup**

Inside the `.setup(|app| { ... })` closure, replace the existing window retrieval and startup show block:

```rust
            // Get the main window
            let window = app.get_webview_window("main").unwrap();

            // Show and focus the window on startup
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.center();

            // Focus the input element
            window
                .eval("document.querySelector('.spotlight-input')?.focus()")
                .ok();
```

with:

```rust
            // Convert the main window into an NSPanel subclass so it can show
            // and accept keyboard input without activating the host app.
            let window = app.get_webview_window("main").unwrap();
            let _panel = window.to_panel::<SpotlightPanel>().unwrap();

            // Show and focus the panel on startup
            show_spotlight(&app.handle());
```

The `_panel` binding is intentionally prefixed with `_` — we don't keep it around because subsequent lookups (shortcut, tray) use `get_webview_panel("main")` on the `AppHandle`. Keeping the binding (with the `_`) documents that the conversion is intentional and not dead code.

- [ ] **Step 3: Verify the project still compiles**

Run:
```bash
cd src-tauri && cargo check
```

Expected: `Finished` with no errors. If you see "no method named `show_and_make_key`" or "no method named `get_webview_panel`", the `ManagerExt` import is missing — re-check Task 2 Step 1.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "refactor(floating-command-window): convert window to SpotlightPanel and add show/hide helpers"
```

---

## Task 4: Update shortcut and tray to use the helpers

**Files:**
- Modify: `src-tauri/src/lib.rs` — shortcut handler and tray callbacks inside `setup`

- [ ] **Step 1: Update the shortcut handler**

In the `app.global_shortcut().on_shortcut(...)` callback, replace the current visibility-toggle block:

```rust
            app.global_shortcut()
                .on_shortcut(shortcut, move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let window = app_handle.get_webview_window("main").unwrap();
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.center();
                            // Focus the input element when showing via shortcut
                            window
                                .eval("document.querySelector('.spotlight-input')?.focus()")
                                .ok();
                        }
                    }
                })?;
```

with:

```rust
            app.global_shortcut()
                .on_shortcut(shortcut, move |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Some(panel) = app.get_webview_panel("main") {
                            if panel.is_visible() {
                                hide_spotlight(&app.app_handle().clone());
                            } else {
                                show_spotlight(&app.app_handle().clone());
                            }
                        }
                    }
                })?;
```

Notes:
- The closure parameter changes from `_app` to `app` so we can call `app.get_webview_panel(...)` and `app.app_handle().clone()`. `AppHandle: Clone` is cheap (it wraps an `Arc`).
- `panel.is_visible()` is a `bool` (no `Result`), unlike the window's `is_visible()` which returned `Result<bool>`.

- [ ] **Step 2: Update the tray "show" menu handler**

In the `.on_menu_event(|app, event| { ... })` closure, find the `"show"` arm:

```rust
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.center();
                            window
                                .eval("document.querySelector('.spotlight-input')?.focus()")
                                .ok();
                        }
                    }
```

and replace it with:

```rust
                    "show" => {
                        show_spotlight(app);
                    }
```

`app` here is already an `&AppHandle` (the closure parameter of `on_menu_event`).

- [ ] **Step 3: Update the tray icon click handler**

In the `.on_tray_icon_event(|tray, event| { ... })` closure, find the click branch:

```rust
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.center();
                            window
                                .eval("document.querySelector('.spotlight-input')?.focus()")
                                .ok();
                        }
                    }
                })
```

and replace it with:

```rust
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
```

`tray.app_handle()` returns `&AppHandle`, matching the helper's parameter.

- [ ] **Step 4: Verify the project still compiles**

Run:
```bash
cd src-tauri && cargo check
```

Expected: `Finished` with no errors. If you see warnings about an unused `MouseButton`, `MouseButtonState`, `TrayIconEvent`, or `Manager` import, leave them — they will be cleaned up by the compiler. If `cargo check` reports hard errors, re-check that the `Manager` and `ManagerExt` traits are both in scope (the `Manager` import from `tauri` is still needed for `get_webview_window` and `get_webview_panel` in different call sites — but `get_webview_panel` is the `tauri-nspanel` `ManagerExt` extension, not the `tauri` `Manager` extension).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "refactor(floating-command-window): route shortcut and tray through panel helpers"
```

---

## Task 5: Simplify hide_window command

**Files:**
- Modify: `src-tauri/src/lib.rs:14-17`

- [ ] **Step 1: Replace the command body**

Find the existing `hide_window` command:

```rust
#[tauri::command]
fn hide_window<R: Runtime>(window: tauri::Window<R>) {
    let _ = window.hide();
}
```

and replace it with:

```rust
#[tauri::command]
fn hide_window(app: AppHandle) {
    hide_spotlight(&app);
}
```

The frontend already calls `invoke("hide_window")` with no arguments (`src/routes/+page.svelte:54` and `:88`). Changing the Rust signature from `tauri::Window<R>` to `AppHandle` keeps the IPC contract the same — the frontend needs no changes.

- [ ] **Step 2: Verify the project still compiles**

Run:
```bash
cd src-tauri && cargo check
```

Expected: `Finished` with no errors. The `Runtime` import was removed in Task 2 Step 1, so there should be no "unused import" warning. If `cargo check` reports an error about `Runtime` not being in scope, double-check the import block from Task 2.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "refactor(floating-command-window): route hide_window command through panel helper"
```

---

## Task 6: Smoke test the running app

**Files:** none (verification only)

- [ ] **Step 1: Build the frontend and start the app**

Run from the project root:

```bash
pnpm tauri dev
```

Expected: app launches, a small floating panel appears centered on the screen.

- [ ] **Step 2: Verify non-activating behavior**

While `pnpm tauri dev` is running:

1. Open TextEdit (or any other app). Type some text and place the cursor mid-sentence.
2. Switch back to TextEdit if it loses focus.
3. Press `Cmd+Shift+H` to summon the panel.
4. Verify:
   - The panel appears.
   - The search input has a visible focus ring (cursor in the input).
   - Switch to TextEdit — your text and cursor position are exactly where you left them.
5. Click outside the panel (e.g. on TextEdit's window) — the panel hides.

- [ ] **Step 3: Verify existing UX still works**

With the dev server still running:

1. Press `Cmd+Shift+H` again — panel reappears, search input focused.
2. Type "open" — the command list filters. The first result is highlighted.
3. Press Enter — the pin command (first item) toggles. The list re-renders. The panel hides.
4. Press `Cmd+Shift+H` again — panel reappears.
5. Press Escape — panel hides.
6. Click the tray icon — panel appears.
7. Right-click tray → Quit — app exits cleanly.

- [ ] **Step 4: Commit any stray fixes (if needed)**

If everything works, no commit is needed. If a small fix was required (e.g. an import the compiler missed), commit it with a focused message:

```bash
git add src-tauri/src/lib.rs
git commit -m "fix(floating-command-window): <describe the fix>"
```

---

## Self-Review

**Spec coverage:**
- "1. Cargo.toml — new dependency" → Task 1
- "2. lib.rs — panel class + plugin" → Task 2
- "3. lib.rs — setup hook (panel conversion + helpers + shortcut + tray)" → Task 3 (conversion + helpers) + Task 4 (shortcut + tray)
- "4. hide_window command" → Task 5
- "Verification" → Task 6

All spec sections have tasks. No gaps.

**Placeholder scan:** No "TBD" / "TODO" / "implement later". Every code step shows complete code. Every command shows the exact bash invocation.

**Type consistency:** `AppHandle` (added in Task 2) is used in Tasks 3, 4, 5 with the same signature. `show_spotlight` / `hide_spotlight` (defined in Task 3) are called the same way in Tasks 3, 4, 5. `SpotlightPanel` is defined in Task 2 and used in Task 3. `get_webview_panel`, `to_panel`, `show_and_make_key`, `is_visible`, `hide`, `center`, `to_window` all match the `tauri-nspanel` v2.1 API documented in the GitHub README and `docs/panel-methods.md`.
