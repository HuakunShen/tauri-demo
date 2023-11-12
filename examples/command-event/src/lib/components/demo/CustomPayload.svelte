<script lang="ts">
  import { invoke } from "@tauri-apps/api";
  import { z } from "zod";

  const payloadSchema = z.object({ name: z.string() });
  type PayloadSchema = z.infer<typeof payloadSchema>;
  let greetName = "";
  let greetRes: PayloadSchema = { name: "" };
  $: invoke("custom_payload", { payload: { name: greetName } }).then((res) => {
    greetRes = payloadSchema.parse(res);
  });
</script>

<div>
  <h2>Custom Payload</h2>
  <input type="text" bind:value={greetName} placeholder="Enter Name" />
  <br />
  <strong><code>custom_payload</code> command response</strong>
  <pre>{JSON.stringify(greetRes, null, 2)}</pre>
</div>
