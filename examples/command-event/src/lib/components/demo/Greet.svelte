<script lang="ts">
  import { invoke } from "@tauri-apps/api";
  import { z } from "zod";

  let greetName = "";
  let greetRes = "";
  $: invoke("greet", { firstName: greetName }).then((res) => {
    greetRes = z.string().parse(res);
  });
</script>

<div>
  <h2>Greet</h2>
  <input type="text" bind:value={greetName} placeholder="Enter Name" />
  <p>{greetRes}</p>
</div>
