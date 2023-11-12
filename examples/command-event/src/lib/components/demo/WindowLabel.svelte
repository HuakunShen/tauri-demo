<script lang="ts">
  import { z } from "zod";
  import { invoke } from "@tauri-apps/api";

  let label: string = "";
  $: invoke("window_label").then((res) => {
    label = z.string().parse(res);
  });
</script>

<h2>Window Label</h2>
<p>{label}</p>
