<script lang="ts">
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { invoke } from '@tauri-apps/api';
	import { onDestroy, onMount } from 'svelte';

	let clipboardUnlisten: UnlistenFn;
	let isRunningUnlisten: UnlistenFn;
	let isRunning: boolean = false;
	let clipboardText: string = '';
	onMount(async () => {
		clipboardUnlisten = await listen('clipboard-update', (event) => {
			clipboardText = event.payload as string;
		});
		isRunningUnlisten = await listen('clipboard_listener_running', (event) => {
			isRunning = event.payload as boolean;
		});
	});

	onDestroy(() => {
		clipboardUnlisten();
		isRunningUnlisten();
	});
</script>

<p>After start listening, copy some text and check if there is update on the page.</p>
<p>Then click stop running to stop the listener.</p>
<button
	on:click={() => invoke('listen_to_clipboard', { delayMillis: 100 })}
	type="button"
	class="btn variant-filled">Listen To Clipboard</button
>
<br />
<p><strong>Current Clipboard Text:</strong> {clipboardText}</p>
<p>Is Running: {isRunning}</p>
<button
	class="btn variant-filled"
	on:click={() => {
		invoke('stop_clipboard_listener');
	}}
>
	Stop Running
</button>
