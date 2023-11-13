<script lang="ts">
  import { z } from "zod";
  import { invoke } from "@tauri-apps/api";
  import { listen, type Event, type UnlistenFn } from "@tauri-apps/api/event";
  import { onDestroy, onMount } from "svelte";

  let unlisten: UnlistenFn;
  let data: Event<number> | undefined;
  onMount(async () => {
    unlisten = await listen("event_and_state_increment_mut", (event: Event<number>) => {
      data = event;
    });
  });

  onDestroy(() => {
    unlisten();
  });
</script>

<h2>Listen For Event</h2>
<pre>{JSON.stringify(data, null, 2)}</pre>
<button
  on:click={() => {
    invoke("event_and_state_increment_mut");
  }}>Call "event_and_state_increment_mut" command to increment</button
>
