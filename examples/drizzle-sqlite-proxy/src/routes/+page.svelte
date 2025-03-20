<script lang="ts">
  import { appConfigDir, join } from "@tauri-apps/api/path";
  import { onMount } from "svelte";
  import { openPath } from "@tauri-apps/plugin-opener";
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";
  import * as schema from "$lib/db/schema";
  import { db } from "$lib/db/database";
  import Inspect from "svelte-inspect-value";

  let appConfigPath = $state("");
  let dbPath = $state("");
  let nameInput = $state("");
  let users = $state<
    { id: number; created_at: string | null; name: string | null }[]
  >([]);

  onMount(async () => {
    const path = await appConfigDir();
    appConfigPath = path;
    dbPath = await join(path, "test.db");
    loadUsers();
  });

  const loadUsers = async () => {
    db.query.users
      .findMany()
      .execute()
      .then((results) => {
        console.log("🚀 ~ FindMany response from Drizzle:", results);
        users = results;
      });
  };

  async function addUser() {
    await db.insert(schema.users).values({ name: nameInput });
    nameInput = "";
    loadUsers();
  }
</script>

<main class="container mx-auto flex flex-col gap-4">
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

  <form
    onsubmit={(e) => {
      e.preventDefault();
      addUser();
    }}
  >
    <label class="label">
      <span class="label-text">Name</span>
      <div class="flex gap-2">
        <input
          bind:value={nameInput}
          class="input"
          type="text"
          placeholder="Enter a name..."
        />
        <button type="submit" class="btn preset-filled">
          Add name to the db
        </button>
      </div>
    </label>
  </form>
  <button
    type="button"
    class="btn preset-tonal-error"
    onclick={async () => {
      await db.delete(schema.users).execute();
      loadUsers();
    }}
  >
    Delete All Users
  </button>
  <Inspect value={users} />
</main>
