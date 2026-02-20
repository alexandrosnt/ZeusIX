<script lang="ts">
	import { ChevronDown, Hash, Volume2, Plus, Trash2, MicOff, HeadphoneOff } from 'lucide-svelte';
	import { channelsStore } from '$lib/stores/channels.svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';
	import { membersStore } from '$lib/stores/members.svelte';
	import { presenceStore } from '$lib/stores/presence.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { dmsStore } from '$lib/stores/dms.svelte';
	import AnimatedAvatar from './AnimatedAvatar.svelte';
	import type { Channel, Category } from '$lib/types';

	function getMemberAvatar(userId: string): string | null {
		return membersStore.getMember(userId)?.user?.avatar_url ?? null;
	}

	function getMemberNameColor(userId: string): string | null {
		return membersStore.getTopRoleColor(userId);
	}

	interface Props {
		oncreatechannel?: (categoryId?: string) => void;
		candeletechannel?: boolean;
		onchanneldelete?: (channelId: string) => void;
		onvoicejoin?: (channelId: string) => void;
	}

	let { oncreatechannel, candeletechannel = false, onchanneldelete, onvoicejoin }: Props = $props();

	let collapsedCategories = $state(new Set<string>());
	let hoveredChannel = $state<string | null>(null);

	// Voice participant profile popup
	let selectedParticipantId = $state<string | null>(null);
	let popupY = $state(0);
	let popupEl = $state<HTMLDivElement | null>(null);

	let selectedMember = $derived.by(() => {
		if (!selectedParticipantId) return null;
		const member = membersStore.getMember(selectedParticipantId);
		if (!member) return null;
		const currentUser = authStore.user;
		if (currentUser && member.user_id === currentUser.id) {
			return { ...member, user: currentUser };
		}
		return member;
	});

	function handleParticipantClick(userId: string, e: MouseEvent) {
		if (selectedParticipantId === userId) {
			selectedParticipantId = null;
			return;
		}
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		popupY = Math.max(52, Math.min(rect.top, window.innerHeight - 280));
		selectedParticipantId = userId;
	}

	function closePopup() {
		selectedParticipantId = null;
	}

	$effect(() => {
		if (!selectedParticipantId) return;
		function onClickOutside(e: MouseEvent) {
			if (popupEl && !popupEl.contains(e.target as Node)) closePopup();
		}
		function onEscape(e: KeyboardEvent) {
			if (e.key === 'Escape') closePopup();
		}
		document.addEventListener('mousedown', onClickOutside);
		document.addEventListener('keydown', onEscape);
		return () => {
			document.removeEventListener('mousedown', onClickOutside);
			document.removeEventListener('keydown', onEscape);
		};
	});

	const statusColors: Record<string, string> = {
		online: '#30D158',
		idle: '#FF9F0A',
		dnd: '#FF453A',
		offline: '#636366'
	};

	let categories = $derived(channelsStore.categories);
	let activeChannelId = $derived(channelsStore.activeChannelId);
	let isEmpty = $derived(channelsStore.channels.length === 0);

	function toggleCategory(categoryId: string) {
		if (collapsedCategories.has(categoryId)) {
			collapsedCategories.delete(categoryId);
		} else {
			collapsedCategories.add(categoryId);
		}
	}

	function selectChannel(channel: Channel) {
		if (channel.channel_type === 'voice') {
			onvoicejoin?.(channel.id);
			return;
		}
		// Clear any active DM to prevent stale DM content from rendering
		dmsStore.setActive(null);
		channelsStore.setActive(channel.id);
	}
</script>

<div class="channel-list">
	{#if isEmpty && oncreatechannel}
		<div class="empty-state">
			<p class="empty-text">No channels yet</p>
			<button class="empty-create-btn" onclick={() => oncreatechannel?.()}>
				<Plus size={16} />
				<span>Create Channel</span>
			</button>
		</div>
	{:else}
		{#each categories as category (category.id)}
			<div class="category-header">
				<button
					class="category-label"
					onclick={() => toggleCategory(category.id)}
					aria-expanded={!collapsedCategories.has(category.id)}
				>
					<span
						class="chevron"
						class:collapsed={collapsedCategories.has(category.id)}
					>
						<ChevronDown size={10} />
					</span>
					{category.name}
				</button>
				{#if oncreatechannel}
					<button
						class="category-action"
						aria-label="Create channel in {category.name}"
						onclick={(e) => { e.stopPropagation(); oncreatechannel?.(category.id === '__uncategorized' ? undefined : category.id); }}
					>
						<Plus size={14} />
					</button>
				{/if}
			</div>

			{#if !collapsedCategories.has(category.id)}
				{#each category.channels as channel (channel.id)}
					<div
						class="channel-row"
						role="group"
						onmouseenter={() => hoveredChannel = channel.id}
						onmouseleave={() => hoveredChannel = null}
					>
						<button
							class="channel-item"
							class:active={activeChannelId === channel.id}
							class:voice={channel.channel_type === 'voice'}
							class:voice-connected={channel.channel_type === 'voice' && voiceStore.channelId === channel.id}
							onclick={() => selectChannel(channel)}
						>
							{#if channel.channel_type === 'voice'}
								<span class="channel-hash">
									<Volume2 size={18} />
								</span>
							{:else}
								<span class="channel-hash">
									<Hash size={18} />
								</span>
							{/if}
							<span class="channel-name">{channel.name}</span>
						</button>
						{#if candeletechannel && hoveredChannel === channel.id}
							<button
								class="channel-action delete"
								aria-label="Delete {channel.name}"
								onclick={(e) => { e.stopPropagation(); onchanneldelete?.(channel.id); }}
							>
								<Trash2 size={14} />
							</button>
						{/if}
					</div>

					{#if channel.channel_type === 'voice' && voiceStore.channelId === channel.id}
						{#each voiceStore.participants as participant (participant.userId)}
							{@const nameColor = getMemberNameColor(participant.userId)}
							<button class="voice-participant" onclick={(e) => handleParticipantClick(participant.userId, e)}>
								<AnimatedAvatar
									url={getMemberAvatar(participant.userId)}
									speaking={participant.speaking}
									size={24}
									username={participant.username}
								/>
								<span class="voice-participant-name" style:color={nameColor ?? undefined}>{participant.username}</span>
								{#if participant.deafened}
									<span class="voice-status-icon"><HeadphoneOff size={14} /></span>
								{:else if participant.muted}
									<span class="voice-status-icon"><MicOff size={14} /></span>
								{/if}
							</button>
						{/each}
					{/if}
				{/each}
			{/if}
		{/each}
	{/if}
</div>

{#if selectedMember}
	{@const sm = selectedMember}
	{@const smUsername = sm.nickname ?? sm.user?.username ?? 'Unknown'}
	{@const smStatus = presenceStore.getStatus(sm.user_id)}
	<div class="voice-profile-card" style:top="{popupY}px" bind:this={popupEl} role="dialog" aria-label="Member profile">
		<div class="vpc-cover">
			{#if sm.user?.cover_url}
				<img src={sm.user.cover_url} alt="" class="vpc-cover-img" />
			{/if}
		</div>
		<div class="vpc-avatar-row">
			<div class="vpc-avatar">
				{#if sm.user?.avatar_url}
					<img src={sm.user.avatar_url} alt={smUsername} class="vpc-avatar-img" />
				{:else}
					<span class="vpc-avatar-initials">{smUsername.slice(0, 2).toUpperCase()}</span>
				{/if}
			</div>
			<span class="vpc-status-dot" style:background-color={statusColors[smStatus]}></span>
		</div>
		<div class="vpc-body">
			<div class="vpc-username">{smUsername}<span class="vpc-discrim">#{sm.user?.discriminator ?? '0000'}</span></div>
			{#if sm.roles && sm.roles.length > 0}
				<div class="vpc-roles">
					{#each sm.roles as role (role.id)}
						<span class="vpc-role" style:border-color={role.color ?? 'rgba(255,255,255,0.15)'}>
							{#if role.color}<span class="vpc-role-dot" style:background={role.color}></span>{/if}
							{role.name}
						</span>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.channel-list {
		flex: 1;
		padding: 16px 8px;
		overflow-y: auto;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 32px 16px;
	}

	.empty-text {
		color: rgba(235, 235, 245, 0.3);
		font-size: 13px;
		margin: 0;
	}

	.empty-create-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-radius: 8px;
		border: 1px dashed rgba(255, 255, 255, 0.15);
		background: none;
		color: rgba(235, 235, 245, 0.5);
		font-size: 13px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.15s;
	}

	.empty-create-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(235, 235, 245, 0.8);
		border-color: rgba(255, 255, 255, 0.25);
	}

	.category-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 16px 8px 8px 8px;
	}

	.category-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: rgba(235, 235, 245, 0.6);
		letter-spacing: 0.5px;
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
		background: none;
		border: none;
		padding: 0;
		font-family: inherit;
		flex: 1;
		min-width: 0;
	}

	.category-label:hover {
		color: rgba(235, 235, 245, 0.8);
	}

	.category-action {
		background: none;
		border: none;
		color: rgba(235, 235, 245, 0.3);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		transition: color 0.15s;
		flex-shrink: 0;
	}

	.category-action:hover {
		color: rgba(235, 235, 245, 0.8);
	}

	.chevron {
		display: flex;
		align-items: center;
		transition: transform 0.2s;
	}

	.chevron.collapsed {
		transform: rotate(-90deg);
	}

	.channel-row {
		display: flex;
		align-items: center;
		position: relative;
	}

	.channel-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		margin-bottom: 2px;
		border-radius: 6px;
		color: rgba(235, 235, 245, 0.6);
		font-size: 15px;
		cursor: pointer;
		transition: all 0.2s;
		background: none;
		border: none;
		width: 100%;
		text-align: left;
		font-family: inherit;
	}

	.channel-item:hover {
		background: var(--bg-glass-lighter, rgba(58, 58, 60, 0.3));
		color: rgba(255, 255, 255, 0.95);
	}

	.channel-item.active {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.95);
	}

	.channel-item.voice {
		cursor: pointer;
		opacity: 0.8;
	}

	.channel-item.voice:hover {
		background: rgba(var(--glass-lighter-rgb, 58, 58, 60), 0.3);
		opacity: 1;
	}

	.channel-item.voice-connected {
		opacity: 1;
		color: #30D158;
	}

	.voice-participant {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px 4px 34px;
		margin-bottom: 2px;
		width: 100%;
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-family: inherit;
		color: inherit;
		text-align: left;
		transition: background 0.15s;
	}

	.voice-participant:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.voice-participant-name {
		font-size: 13px;
		color: rgba(235, 235, 245, 0.6);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.voice-status-icon {
		display: flex;
		align-items: center;
		color: rgba(235, 235, 245, 0.35);
		flex-shrink: 0;
		margin-left: auto;
	}

	.channel-hash {
		color: rgba(235, 235, 245, 0.3);
		width: 18px;
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.channel-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.channel-action {
		position: absolute;
		right: 8px;
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		transition: color 0.15s;
	}

	.channel-action.delete {
		color: rgba(235, 235, 245, 0.3);
	}

	.channel-action.delete:hover {
		color: #ff453a;
	}

	/* Voice participant profile card */
	.voice-profile-card {
		position: fixed;
		left: 340px;
		width: 280px;
		background: rgba(30, 30, 32, 0.98);
		backdrop-filter: blur(40px);
		-webkit-backdrop-filter: blur(40px);
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
		overflow: hidden;
		z-index: 200;
	}

	.vpc-cover {
		height: 60px;
		background: linear-gradient(135deg, #2c1e4a, #1a2a40);
		overflow: hidden;
	}

	.vpc-cover-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.vpc-avatar-row {
		position: relative;
		margin-top: -24px;
		padding: 0 16px;
	}

	.vpc-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: linear-gradient(135deg, #ff9f0a, #ff375f);
		border: 3px solid rgba(30, 30, 32, 0.98);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.vpc-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.vpc-avatar-initials {
		color: white;
		font-size: 16px;
		font-weight: 600;
	}

	.vpc-status-dot {
		position: absolute;
		bottom: 0;
		left: 48px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 3px solid rgba(30, 30, 32, 0.98);
	}

	.vpc-body {
		padding: 8px 16px 16px;
	}

	.vpc-username {
		font-size: 16px;
		font-weight: 700;
		color: #fff;
	}

	.vpc-discrim {
		font-weight: 400;
		color: rgba(235, 235, 245, 0.3);
		font-size: 13px;
		margin-left: 2px;
	}

	.vpc-roles {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 10px;
	}

	.vpc-role {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
		color: rgba(235, 235, 245, 0.8);
		border: 1px solid;
		background: rgba(255, 255, 255, 0.04);
	}

	.vpc-role-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
