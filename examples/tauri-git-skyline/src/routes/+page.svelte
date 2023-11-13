<script lang="ts">
	import { WebviewWindow } from '@tauri-apps/api/window';
	import { onMount } from 'svelte';

	let ifr: HTMLIFrameElement;
	onMount(() => {
		ifr.addEventListener('click', (evt) => {
			console.log(evt.button);

			if (evt.button === 0) {
				evt.preventDefault();
				evt.stopPropagation();
			}
		});
	});
</script>

<div class="h-full z-50" data-tauri-drag-region>
	<div class="mask w-full h-screen absolute top-0" data-tauri-drag-region />
	<iframe
		bind:this={ifr}
		src="https://git-skyline.huakun.tech/contribution/github/huakunshen/embed?"
		class="z-0"
		width="100%"
		height="100%"
		frameborder="0"
	/>
</div>

<style>
	/* fully transparent background */
	:global(body) {
		background: transparent;
		height: 100vh;
	}
</style>
