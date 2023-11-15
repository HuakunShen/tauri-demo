<script lang="ts">
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { invoke } from '@tauri-apps/api';
	import { onDestroy, onMount } from 'svelte';

	let clipboardUnlisten: UnlistenFn;
	let clipboardText: string = '';
	onMount(async () => {
		clipboardUnlisten = await listen('clipboard-update', (event) => {
			clipboardText = event.payload as string;
		});
	});

	onDestroy(() => {
		clipboardUnlisten();
	});
</script>

<button
	on:click={() => invoke('listen_to_clipboard', { delayMillis: 100 })}
	type="button"
	class="btn variant-filled">Listen To Clipboard</button
>
<br />
<p><strong>Current Clipboard Text:</strong> {clipboardText}</p>
