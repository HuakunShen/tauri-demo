<script lang="ts">
  import Readme from "$lib/components/README.svelte";
  import { counterStore } from "$lib/counter-store";
  import { invoke } from "@tauri-apps/api/core";
  import {
    getCurrentWebviewWindow,
    WebviewWindow,
  } from "@tauri-apps/api/webviewWindow";
  import { onDestroy, onMount } from "svelte";

  function createNewWindow() {
    const label = `window-${Math.random().toString(36).slice(2, 7)}`;
    new WebviewWindow(label, {
      url: "/",
      title: label,
    });
  }

  onMount(() => {
    counterStore.listen();
  });

  onDestroy(() => {
    console.log("[onDestroy] Call unlisten");
    counterStore.unlisten?.();
    console.log("unlisten should be undefined", counterStore.unlisten);
  });
</script>

<Readme />
<button onclick={() => counterStore.increment()}>Increment</button>
<button onclick={() => counterStore.decrement()}>Decrement</button>
<p>{$counterStore}</p>

<button onclick={createNewWindow}>New Window</button>

<style>
  * {
    font-size: 2em;
  }

  /* Adjust buttons to maintain proportions */
  button {
    padding: 0.5em 1em;
  }

  /* Keep strong relative to its parent */
  :global(strong) {
    font-size: 1em;
  }
</style>
