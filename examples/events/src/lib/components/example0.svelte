<script lang="ts">
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { onDestroy, onMount } from 'svelte';

	let unlisten: UnlistenFn;
	let fileDropped = '';
	onMount(async () => {
		unlisten = await listen('tauri://file-drop', (event) => {
			fileDropped = JSON.stringify(event.payload);
		});
	});

	onDestroy(() => {
		unlisten();
	});
</script>

<h2 class="text-2xl">Example 0: File Drop</h2>

<p>File Dropped: {fileDropped}</p>
