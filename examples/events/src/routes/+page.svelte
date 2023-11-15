<script lang="ts">
	import ClipboardListener from '$lib/components/ClipboardListener.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { AppShell, AppBar, TabGroup, Tab, TabAnchor } from '@skeletonlabs/skeleton';

	
	let tabSet: number = 0;
</script>


<TabGroup>
	<Tab bind:group={tabSet} name="tab1" value={0}>
		<span>Listen To Clipboard</span>
	</Tab>
	<Tab bind:group={tabSet} name="tab2" value={1}>(label 2)</Tab>
	<Tab bind:group={tabSet} name="tab3" value={2}>(label 3)</Tab>
	<svelte:fragment slot="panel">
		{#if tabSet === 0}
			<ClipboardListener />
		{:else if tabSet === 1}
			(tab panel 2 contents)
		{:else if tabSet === 2}
			(tab panel 3 contents)
		{/if}
	</svelte:fragment>
</TabGroup>
					