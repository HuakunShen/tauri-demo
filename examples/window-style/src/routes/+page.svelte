<script lang="ts">
  import { WebviewWindow } from "@tauri-apps/api/window";
</script>

<button
  on:click={() => {
    new WebviewWindow("custom-title-bar", {
      url: "custom-title-bar",
      decorations: false,
    });
  }}>Custom Title Bar</button
>
<button
  on:click={() => {
    new WebviewWindow("overlay", {
      url: "overlay",
      titleBarStyle: "overlay",
      hiddenTitle: true,
    });
  }}
>
  Overlay
</button>
<button
  on:click={() => {
    new WebviewWindow("no-buttons", {
      url: "no-buttons",
      decorations: false,
    });
  }}>No Buttons (no decorations)</button
>

<button
  on:click={() => {
    new WebviewWindow("no-buttons-rounded", {
      url: "no-buttons-rounded",
      decorations: false,
      transparent: true,
    });
  }}>No Button Rounded</button
>

<style>
  button {
    background: #000;
    color: #fff;
    border: none;
    padding: 10px;
    border-radius: 5px;
    cursor: pointer;
  }
</style>
