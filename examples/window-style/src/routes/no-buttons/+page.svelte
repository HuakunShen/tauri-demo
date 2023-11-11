<script lang="ts">
  import { appWindow } from "@tauri-apps/api/window";
  import { onMount } from "svelte";

  function handleEscKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      appWindow.close();
    }
  }
  onMount(() => {
    window.addEventListener("keydown", handleEscKey);
    return () => {
      window.removeEventListener("keydown", handleEscKey);
    };
  });
</script>

<div data-tauri-drag-region class="w-full h-8" />
<h2 class="text-2xl">Press Escape key to quit</h2>
