<script lang="ts">
  import { onMount } from "svelte";
  import "../app.css";
  import { migrate } from "../lib/db/migrate";

  let { children } = $props();

  onMount(async () => {
    // await migrate(); // Migrations are handled by the Tauri plugin in lib.rs, but this is here for reference
  });
</script>

{@render children()}
