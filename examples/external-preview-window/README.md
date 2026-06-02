# External Preview Window

A Tauri + React MVP for a clipboard-history window with an external hover preview.

The app uses two native Tauri windows:

- `history`: the interactive clipboard history list.
- `preview`: a transparent, click-through render-only window that shows the enlarged preview card and connector curve.

The goal is to keep hover detection in the history window while making the preview feel visually connected, smooth, and non-intrusive.

## Run

```bash
bun install
bun run tauri dev
```

Useful checks:

```bash
bun test
bun run build
cargo test --manifest-path src-tauri/Cargo.toml
./node_modules/.bin/tauri build --bundles app
```

## Current Behavior

- The preview window is transparent, always-on-top, hidden until hover, skip-taskbar, non-focusable, and ignores cursor events.
- Hovering a history item emits item data, item rect, viewport size, and preview placement direction to the preview window.
- The preview card moves with CSS transforms inside the preview webview, instead of repeatedly moving the native window during hover.
- The connector is an SVG cubic Bezier curve, not a straight DOM line.
- The preview window chooses a placement based on the current monitor work area: left, right, top, then bottom, with screen-edge clamping.
- The frameless history window can be dragged from its header.

## Lessons Learned

### macOS Transparency

On macOS, setting a Tauri window to `"transparent": true` is not enough. Tauri requires the private API flag:

```json
{
  "app": {
    "macOSPrivateApi": true
  }
}
```

Without it, the preview window background is not truly transparent and Tauri warns that `macos-private-api` is not enabled. This is fine for a local desktop tool, but it matters because private APIs can affect Mac App Store acceptance.

### Click-Through Preview Window

The preview window must not participate in mouse interaction. The important calls are:

```ts
await preview.setIgnoreCursorEvents(true);
await preview.setFocusable(false);
await preview.setAlwaysOnTop(true);
await preview.setSkipTaskbar(true);
```

The history window remains the source of truth for hover, scroll, and keyboard input.

### Logical vs Physical Pixels

Tauri window positions and sizes can come back as physical pixels. Browser layout and CSS constants are logical pixels. Mixing them causes the preview window to drift or overlap, especially on Retina displays.

The fix is to convert native window data using the current scale factor before calculating placement:

```ts
const scaleFactor = await history.scaleFactor();
const logicalPosition = position.toLogical(scaleFactor);
const logicalSize = size.toLogical(scaleFactor);
```

Then set the preview window with `LogicalPosition` and `LogicalSize`.

### Adaptive Placement

A fixed "preview on the left" layout fails when the history window sits near the left screen edge. The placement code now reads `currentMonitor().workArea`, converts it to logical pixels, and chooses the first side with enough room:

1. left
2. right
3. top
4. bottom

If no side has perfect room, it chooses the side with the most available space and clamps the preview window inside the work area.

### Connector Curve

The connector should be drawn inside the preview window. It is not a third window.

The straight line was replaced with an SVG cubic Bezier path so each placement direction can have its own curve:

- `left` and `right`: horizontal curve between card and history.
- `top` and `bottom`: vertical curve between card and history.

The path helper lives in `src/lib/connector-path.ts`.

### Frameless Window Dragging

For a decoration-free Tauri window, `data-tauri-drag-region` alone may not be enough. The history header uses both drag-region attributes and a manual `startDragging()` call.

The capability must include:

```json
"core:window:allow-start-dragging"
```

Without this permission, the JavaScript drag call fails and the main window feels stuck.

### Capabilities Are Part of the Feature

Tauri v2 capabilities are not a formality. Window APIs used by this MVP need matching permissions, including positioning, sizing, focusability, click-through, show/hide, monitor/window info, and dragging.

When adding a new Tauri API call, check whether the capability file needs a matching `core:window:*` permission.

## Important Files

- `src/routes/HistoryWindow.tsx`: history UI, hover bridge, drag handling, preview placement sync.
- `src/routes/PreviewWindow.tsx`: preview event listener and render state.
- `src/lib/window-layout.ts`: monitor-aware preview window placement.
- `src/lib/geometry.ts`: card, connector, and clamp geometry.
- `src/lib/connector-path.ts`: SVG Bezier connector paths.
- `src-tauri/tauri.conf.json`: two-window Tauri configuration and macOS transparency flag.
- `src-tauri/capabilities/clipboard-preview.json`: permissions for the window APIs used by the MVP.
