<script lang="ts">
  import { onMount } from "svelte";
  import "../app.css";
  import { join, resourceDir } from "@tauri-apps/api/path";
  import { exists, mkdir, readDir } from "@tauri-apps/plugin-fs";

  let { children } = $props();

  onMount(async () => {
    const resourcePath = await resourceDir();
    const migrationsPath = await join(resourcePath, "migrations");
    const _exists = await exists(migrationsPath);
    if (!_exists) {
      await mkdir(migrationsPath);
    }
  });
</script>

{@render children()}
