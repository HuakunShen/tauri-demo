<script lang="ts">
  import Database from "@tauri-apps/plugin-sql";
  import { appConfigDir, join, resourceDir } from "@tauri-apps/api/path";
  import { onMount } from "svelte";
  import { openPath } from "@tauri-apps/plugin-opener";
  import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
  import { readDir } from "@tauri-apps/plugin-fs";

  let appConfigPath = $state("");
  let dbPath = $state("");

  onMount(async () => {
    const path = await appConfigDir();
    appConfigPath = path;
    dbPath = await join(path, "test.db");
  });

  const queries = {
    createTables: `
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
          );
    `,
  };
</script>

<main class="container flex flex-col gap-4">
  <button
    type="button"
    class="btn preset-filled"
    onclick={async () => {
      const db = await Database.load("sqlite:test.db");
      const result = await db.execute(queries.createTables);
      await db.close();
      console.log(result);

      const resourcePath = await resourceDir();
      console.log("resourcePath", resourcePath);

      const files = await readDir(`${resourcePath}/migrations`);
      console.log("files", files);
    }}>Init Sqlite</button
  >
  <div class="flex gap-2">
    <button
      class="font-mono text-sm text-blue-400 hover:text-blue-500 hover:underline cursor-pointer text-left"
      onclick={() => {
        openPath(appConfigPath)
          .then(() => {
            console.log("opened");
          })
          .catch((err) => {
            console.error(err);
          });
      }}
    >
      {dbPath}
    </button>
    <button
      type="button"
      class="btn preset-filled btn-sm"
      onclick={async () => {
        await writeText(dbPath);
      }}
    >
      Copy
    </button>
  </div>
</main>
