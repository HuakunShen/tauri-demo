<script lang="ts">
	import { appWindow, WebviewWindow } from '@tauri-apps/api/window';
	import { listen, emit } from '@tauri-apps/api/event';
	import { onMount } from 'svelte';
	import { z } from 'zod';

	let age = 0;
	let time = '';
	const windows: Record<string, number> = {};
	onMount(() => {
		listen('time', (event) => {
			time = z.string().parse(event.payload);
		});

		listen('age', (event) => {
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
</script>

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

<p><strong>Time:</strong> {time}</p>
<strong>Windows:</strong>
<ul>
	{#each Object.entries(windows) as win}
		<li>{win[0]}: {win[1]}</li>
	{/each}
</ul>
