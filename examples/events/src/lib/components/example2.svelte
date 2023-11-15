<script lang="ts">
	import { appWindow, WebviewWindow } from '@tauri-apps/api/window';
	import { listen, emit, type UnlistenFn } from '@tauri-apps/api/event';
	import { onDestroy, onMount } from 'svelte';
	import { z } from 'zod';

	let age = 0;
	const windows: Record<string, number> = {};
	let unlisten: UnlistenFn;
	onMount(async () => {
		unlisten = await listen('age', (event) => {
			const payload = z.object({ age: z.number(), label: z.string() }).parse(event.payload);
			windows[payload.label] = payload.age;
		});

		setInterval(() => {
			age++;
			emit('age', {
				age: age,
				label: appWindow.label
			});
		}, 1000);
	});

	onDestroy(() => {
		unlisten();
	});
</script>

<h2 class="text-2xl">Example 2: Window Age</h2>
<div class="flex-col space-y-5">
	<p><strong>Label:</strong> {appWindow.label}</p>
	<p><strong>Age: {age}</strong></p>
	<button
		class="btn variant-filled"
		on:click={() => {
			const randomString = Math.random().toString(36).substring(7);
			new WebviewWindow(randomString);
		}}
	>
		New Window
	</button>

	<strong class="block">Windows:</strong>
	<ul class="list-decimal ml-5">
		{#each Object.entries(windows) as win}
			<li>{win[0]}: {win[1]}</li>
		{/each}
	</ul>
</div>
