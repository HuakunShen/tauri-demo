<script lang="ts">
  import { invoke } from "@tauri-apps/api";
  import { z } from "zod";

  const payloadSchema = z.object({ origin: z.string() });
  type PayloadSchema = z.infer<typeof payloadSchema>;
  let ipRes: PayloadSchema = { origin: "" };
  $: invoke("my_ip").then((res) => {
    ipRes = payloadSchema.parse(res);
  });
</script>

<div>
  <h2>My Ip</h2>
  <pre>{JSON.stringify(ipRes, null, 2)}</pre>
</div>
