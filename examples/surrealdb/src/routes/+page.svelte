<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import Inspect from "svelte-inspect-value";
  import { preventDefault } from "../lib/utils";
  import { onMount } from "svelte";

  let name = $state("");
  let people = $state([]);

  onMount(() => {
    getPeople();
  });

  async function createPerson() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    await invoke("create_person", { name, title: "Developer" });
    name = ""; // Reset the input
    await getPeople(); // Make sure to refresh the people list
  }

  async function getPeople() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    try {
      people = await invoke("get_people");
    } catch (error) {
      console.error("Error getting people:", error);
    }
  }

  async function deleteAllPeople() {
    await invoke("delete_all_people");
    await getPeople(); // Make sure to refresh the people list
  }
</script>

<main class="container mx-auto space-y-4 px-4">
  <h1 class="text-2xl font-bold">Welcome to Tauri + SurrealDB</h1>

  <form class="row" onsubmit={preventDefault(createPerson)}>
    <input id="greet-input" placeholder="Enter a name..." bind:value={name} />
    <button type="submit">Create Person</button>
  </form>

  <form class="row" onsubmit={preventDefault(getPeople)}>
    <button type="submit">Get People</button>
  </form>

  <form class="row" onsubmit={preventDefault(deleteAllPeople)}>
    <button type="submit">Delete All People</button>
  </form>
  <Inspect expandAll={true} value={people} />
</main>

<style>
  :root {
    font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;

    color: #0f0f0f;
    background-color: #f6f6f6;

    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-text-size-adjust: 100%;
  }

  .container {
    margin: 0;
    padding-top: 10vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
  }

  h1 {
    text-align: center;
  }

  input,
  button {
    border-radius: 8px;
    border: 1px solid transparent;
    padding: 0.6em 1.2em;
    font-size: 1em;
    font-weight: 500;
    font-family: inherit;
    color: #0f0f0f;
    background-color: #ffffff;
    transition: border-color 0.25s;
    box-shadow: 0 2px 2px rgba(0, 0, 0, 0.2);
  }

  button {
    cursor: pointer;
  }

  button:hover {
    border-color: #396cd8;
  }
  button:active {
    border-color: #396cd8;
    background-color: #e8e8e8;
  }

  input,
  button {
    outline: none;
  }

  #greet-input {
    margin-right: 5px;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      color: #f6f6f6;
      background-color: #2f2f2f;
    }

    input,
    button {
      color: #ffffff;
      background-color: #0f0f0f98;
    }
    button:active {
      background-color: #0f0f0f69;
    }
  }
</style>
