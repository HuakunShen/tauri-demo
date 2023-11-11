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

<div class="h-full rounded-xl p-4 border-3 bg-slate-200">
  <!-- <div data-tauri-drag-region class="w-full h-8" /> -->
  <input autofocus type="text" class="w-full border rounded-xl h-10 text-xl px-2" placeholder="Search Bar">
  <h2 class="text-2xl">Press Escape key to quit</h2>
</div>

<style>
  /* fully transparent background */
  :global(body) {
    background: transparent;
    height: 100vh;
  }
</style>
