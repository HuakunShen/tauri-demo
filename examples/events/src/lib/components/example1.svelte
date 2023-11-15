<script lang="ts">
	import { ProgressBar } from '@skeletonlabs/skeleton';
	import { invoke } from '@tauri-apps/api';
	import { onDestroy, onMount } from 'svelte';
	import { listen, emit, type UnlistenFn } from '@tauri-apps/api/event';
	import { z } from 'zod';

	let progress = 0;
	let unlisten: UnlistenFn;
	onMount(async () => {
		unlisten = await listen('progress', (event) => {
			progress = z.number().parse(event.payload);
		});
	});

	onDestroy(() => {
		unlisten();
	});
</script>

<h2 class="text-2xl">Example 1: Progress Bar</h2>
<button
	class="btn variant-filled mt-5"
	on:click={() => {
		progress = 0;
		invoke('long_running_job');
	}}>Run Job</button
>
<div class="flex mt-5 space-x-4">
	<ProgressBar label="Progress Bar" value={progress} max={100} class="mt-2" />
	<span>{progress}/100%</span>
</div>
