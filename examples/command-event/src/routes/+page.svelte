<script lang="ts">
  import Greet from "$lib/components/demo/Greet.svelte";
  import CustomPayload from "$lib/components/demo/CustomPayload.svelte";
  import MyIp from "$lib/components/demo/MyIp.svelte";
  import WindowLabel from "$lib/components/demo/WindowLabel.svelte";
  import EventListen from "$lib/components/demo/EventListen.svelte";
</script>

<main class="container">
  <div>
    <Greet />
    <CustomPayload />
    <MyIp />
    <WindowLabel />
    <EventListen />
  </div>
</main>
