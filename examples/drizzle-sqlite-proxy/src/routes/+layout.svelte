<script lang="ts">
  import { onMount } from "svelte";
  import "../app.css";
  import { migrate } from "../lib/db/migrate";

  let { children } = $props();

  onMount(async () => {
    await migrate();
  });
</script>

{@render children()}
