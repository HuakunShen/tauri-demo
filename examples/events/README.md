This example demonstrate how to use state, command, events.

And some advanced usage with state such as passing state to thread.

However, the clipboard listener detects updates by comparing current clipboard content with previous value. This is not the most efficient way.

For example, `clipboard-master` crate may be a better choice for clipboard listener and I made a tauri clipboard plugin: https://github.com/CrossCopy/tauri-plugin-clipboard

This is the best way to listen for clipboard update in a tauri app.

Image clipboard listening is not supported as this is just a demo. `arboard` crate supports reading image, read the source code, you can implement image clipboard listener easily.

Or use the plugin https://github.com/CrossCopy/tauri-plugin-clipboard.