<script lang="ts">
	import { page } from '$app/stores';
	import DmChatArea from '$lib/components/DmChatArea.svelte';

	let dmChannelId = $derived($page.params.dmChannelId);
</script>

{#if dmChannelId}
	<DmChatArea {dmChannelId} />
{/if}
