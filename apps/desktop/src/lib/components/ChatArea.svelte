<script lang="ts">
	import { Hash, Bell, Users, Search, Trash2 } from 'lucide-svelte';
	import MessageList from './MessageList.svelte';
	import MessageInput from './MessageInput.svelte';
	import { channelsStore } from '$lib/stores/channels.svelte';

	let { ontogglemembers, canpurge = false, onpurge }: {
		ontogglemembers: () => void;
		canpurge?: boolean;
		onpurge?: () => void;
	} = $props();

	let activeChannel = $derived(channelsStore.activeChannel);
</script>

<section class="chat-area">
	<header class="chat-header">
		<span class="header-hash"><Hash size={20} /></span>
		<span class="header-name">{activeChannel?.name ?? 'general'}</span>
		{#if activeChannel?.topic}
			<span class="header-desc">{activeChannel.topic}</span>
		{/if}
		<div class="header-icons">
			{#if canpurge}
				<button class="header-icon-btn purge-btn" aria-label="Purge messages" onclick={onpurge}>
					<Trash2 size={20} />
				</button>
			{/if}
			<button class="header-icon-btn" aria-label="Notifications">
				<Bell size={20} />
			</button>
			<button class="header-icon-btn" aria-label="Toggle members" onclick={ontogglemembers}>
				<Users size={20} />
			</button>
			<button class="header-icon-btn" aria-label="Search">
				<Search size={20} />
			</button>
		</div>
	</header>

	<MessageList />

	<MessageInput />
</section>

<style>
	.chat-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: transparent;
		position: relative;
	}

	.chat-header {
		height: 52px;
		padding: 0 16px;
		display: flex;
		align-items: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		font-weight: 600;
		background: rgba(0, 0, 0, 0.01);
	}

	.header-hash {
		color: rgba(235, 235, 245, 0.3);
		margin-right: 8px;
		display: flex;
		align-items: center;
	}

	.header-name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.header-desc {
		font-size: 13px;
		color: rgba(235, 235, 245, 0.6);
		margin-left: 12px;
		font-weight: 400;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.header-icons {
		margin-left: auto;
		display: flex;
		gap: 16px;
		color: rgba(235, 235, 245, 0.6);
	}

	.header-icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		transition: color 0.2s;
	}

	.header-icon-btn:hover {
		color: rgba(255, 255, 255, 0.95);
	}

	.purge-btn:hover {
		color: #ff453a;
	}
</style>
