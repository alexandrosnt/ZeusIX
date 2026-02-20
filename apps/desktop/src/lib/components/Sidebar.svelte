<script lang="ts">
	import { ChevronDown, Search, UserPlus, X, Plus } from 'lucide-svelte';
	import ChannelList from './ChannelList.svelte';
	import ServerDropdownMenu from './ServerDropdownMenu.svelte';
	import UserPanel from './UserPanel.svelte';
	import VoiceConnectionPanel from './VoiceConnectionPanel.svelte';
	import { serversStore } from '$lib/stores/servers.svelte';
	import { channelsStore } from '$lib/stores/channels.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';
	import { callsStore } from '$lib/stores/calls.svelte';
	import { dmsStore } from '$lib/stores/dms.svelte';
	import { presenceStore } from '$lib/stores/presence.svelte';
	import { closeDm } from '$lib/services/api';
	import { goto } from '$app/navigation';

	interface Props {
		onaddfriend?: () => void;
		oninvite?: () => void;
		onsettings?: () => void;
		ondelete?: () => void;
		oncreatechannel?: (categoryId?: string) => void;
		oncreategroupdm?: () => void;
		candeletechannel?: boolean;
		onchanneldelete?: (channelId: string) => void;
		onvoicejoin?: (channelId: string) => void;
		onvoicedisconnect?: () => void;
		oncalldisconnect?: () => void;
	}

	let { onaddfriend, oninvite, onsettings, ondelete, oncreatechannel, oncreategroupdm, candeletechannel = false, onchanneldelete, onvoicejoin, onvoicedisconnect, oncalldisconnect }: Props = $props();

	let activeServer = $derived(serversStore.activeServer);
	let isHome = $derived(!serversStore.activeServerId);
	let showDropdown = $state(false);
	let isOwner = $derived(activeServer?.owner_id === authStore.user?.id);

	// DM call state for the voice connection panel
	let activeCall = $derived(callsStore.activeCall);
	let isInCall = $derived(activeCall?.status === 'active');
	let callLabel = $derived.by(() => {
		if (!activeCall) return undefined;
		const dm = dmsStore.channels.find((c) => c.id === activeCall.dm_channel_id);
		return dm?.recipient_username ?? 'DM Call';
	});

	let dmChannels = $derived(dmsStore.channels);
	let activeDmId = $derived(dmsStore.activeChannelId);

	function getAvatarGradient(name: string): string {
		const gradients = [
			'linear-gradient(135deg, #0A84FF, #5E5CE6)',
			'linear-gradient(135deg, #BF5AF2, #FF375F)',
			'linear-gradient(135deg, #30D158, #0A84FF)',
			'linear-gradient(135deg, #FF9F0A, #FF375F)',
			'linear-gradient(135deg, #FF453A, #BF5AF2)',
			'linear-gradient(135deg, #5E5CE6, #30D158)'
		];
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}
		return gradients[Math.abs(hash) % gradients.length];
	}

	function getDmDisplayName(dm: typeof dmChannels[number]): string {
		if (dm.dm_type === 'group') {
			if (dm.name) return dm.name;
			if (dm.participants && dm.participants.length > 0) {
				const names = dm.participants.map((p) => p.username).join(', ');
				return names.length > 28 ? names.slice(0, 28) + '...' : names;
			}
			return 'Group DM';
		}
		return dm.recipient_username ?? 'Unknown User';
	}

	function getDmMeta(dm: typeof dmChannels[number]): string {
		if (dm.dm_type === 'group') {
			const count = dm.participants?.length ?? 0;
			return `${count} member${count !== 1 ? 's' : ''}`;
		}
		if (dm.recipient_id) {
			const status = presenceStore.getStatus(dm.recipient_id);
			return status === 'online' ? 'Online' : status === 'idle' ? 'Idle' : status === 'dnd' ? 'Do Not Disturb' : 'Offline';
		}
		return 'Offline';
	}

	function getRecipientStatus(dm: typeof dmChannels[number]): string {
		if (dm.dm_type === 'group') return 'group';
		if (dm.recipient_id) {
			return presenceStore.getStatus(dm.recipient_id);
		}
		return 'offline';
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'online': return '#30D158';
			case 'idle': return '#FF9F0A';
			case 'dnd': return '#FF453A';
			default: return '#636366';
		}
	}

	function getInitials(name: string): string {
		return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
	}

	async function handleDmClick(dm: typeof dmChannels[number]) {
		serversStore.setActive(null);
		channelsStore.setChannels([]);
		channelsStore.setActive(null);
		dmsStore.setActive(dm.id);
		await goto(`/dms/${dm.id}`);
	}

	async function handleCloseDm(e: MouseEvent, dmId: string) {
		e.stopPropagation();
		try {
			await closeDm(dmId);
			dmsStore.removeChannel(dmId);
			if (activeDmId === dmId) {
				await goto('/');
			}
		} catch {
			// Silently handle - could show toast later
		}
	}
</script>

<aside class="sidebar">
	{#if isHome}
		<div class="sidebar-header home-header-bar">
			<span class="server-name">Direct Messages</span>
		</div>
		<div class="dm-actions">
			<button class="dm-action-btn" aria-label="Find or start a conversation">
				<Search size={16} />
				<span>Find or start a conversation</span>
			</button>
		</div>
		<div class="dm-section">
			<div class="dm-section-header">
				<span>Direct Messages</span>
				<button class="dm-add-btn" aria-label="Create Group DM" onclick={() => oncreategroupdm?.()}>
					<Plus size={16} />
				</button>
			</div>
			{#if dmChannels.length === 0}
				<div class="dm-empty">
					<p>No direct messages yet.</p>
				</div>
			{:else}
				<div class="dm-list">
					{#each dmChannels as dm (dm.id)}
						{@const displayName = getDmDisplayName(dm)}
						{@const status = getRecipientStatus(dm)}
						<div
							class="dm-item"
							class:active={activeDmId === dm.id}
							onclick={() => handleDmClick(dm)}
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDmClick(dm); }}
							role="button"
							tabindex="0"
							aria-label="Open conversation with {displayName}"
						>
							{#if dm.dm_type === 'group'}
								<div class="dm-avatar dm-group-avatars" style:background={getAvatarGradient(displayName)}>
									{#if dm.icon_url}
										<img src={dm.icon_url} alt={displayName} class="dm-avatar-img" />
									{:else}
										<span class="dm-avatar-initials">{getInitials(displayName)}</span>
									{/if}
								</div>
							{:else}
								<div class="dm-avatar" style:background={getAvatarGradient(dm.recipient_username ?? 'Unknown')}>
									{#if dm.recipient_avatar_url}
										<img src={dm.recipient_avatar_url} alt={displayName} class="dm-avatar-img" />
									{:else}
										<span class="dm-avatar-initials">{getInitials(displayName)}</span>
									{/if}
									<div class="dm-status-dot" style:background-color={getStatusColor(status)}></div>
								</div>
							{/if}
							<div class="dm-info">
								<span class="dm-name">{displayName}</span>
								<span class="dm-meta">{getDmMeta(dm)}</span>
							</div>
							<button
								class="dm-close-btn"
								aria-label="Close DM with {displayName}"
								onclick={(e) => handleCloseDm(e, dm.id)}
							>
								<X size={14} />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="server-header-wrapper">
			<button class="sidebar-header" aria-label="Server options" onclick={() => showDropdown = !showDropdown}>
				<span class="server-name">{activeServer?.name ?? 'No Server'}</span>
				<ChevronDown size={18} class={showDropdown ? 'chevron-rotated' : ''} />
			</button>
			{#if showDropdown}
				<ServerDropdownMenu
					{isOwner}
					onclose={() => showDropdown = false}
					oninvite={() => { showDropdown = false; oninvite?.(); }}
					onsettings={() => { showDropdown = false; onsettings?.(); }}
					ondelete={() => { showDropdown = false; ondelete?.(); }}
				/>
			{/if}
		</div>
		<div class="channel-list-container">
			<ChannelList {oncreatechannel} {candeletechannel} {onchanneldelete} {onvoicejoin} />
		</div>
	{/if}

	{#if voiceStore.isInVoice || voiceStore.rtcStatus === 'connecting'}
		<VoiceConnectionPanel ondisconnect={() => onvoicedisconnect?.()} />
	{:else if isInCall}
		<VoiceConnectionPanel
			ondisconnect={() => oncalldisconnect?.()}
			label={callLabel}
			showServer={false}
			onclick={() => {
				if (activeCall) {
					serversStore.setActive(null);
					channelsStore.setChannels([]);
					channelsStore.setActive(null);
					dmsStore.setActive(activeCall.dm_channel_id);
					goto(`/dms/${activeCall.dm_channel_id}`);
				}
			}}
		/>
	{/if}

	<UserPanel />
</aside>

<style>
	.sidebar {
		width: 260px;
		background: rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
		border-right: 1px solid rgba(255, 255, 255, 0.08);
	}

	.sidebar-header {
		height: 52px;
		padding: 0 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-weight: 600;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		cursor: pointer;
		transition: background 0.2s;
		background: none;
		border-top: none;
		border-left: none;
		border-right: none;
		color: inherit;
		font-family: inherit;
		font-size: inherit;
		width: 100%;
	}

	.sidebar-header:hover {
		background: var(--bg-glass-lighter, rgba(58, 58, 60, 0.3));
	}

	.server-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.server-header-wrapper {
		position: relative;
	}

	.channel-list-container {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}

	.home-header-bar {
		cursor: default;
	}

	.home-header-bar:hover {
		background: transparent;
	}

	.dm-actions {
		padding: 8px 8px 0;
	}

	.dm-action-btn {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.3);
		border: none;
		color: rgba(235, 235, 245, 0.4);
		font-size: 13px;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s;
	}

	.dm-action-btn:hover {
		background: rgba(0, 0, 0, 0.5);
		color: rgba(235, 235, 245, 0.6);
	}

	.dm-section {
		flex: 1;
		padding: 16px 8px;
		overflow-y: auto;
	}

	.dm-section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 8px;
		margin-bottom: 8px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: rgba(235, 235, 245, 0.6);
		letter-spacing: 0.5px;
	}

	.dm-add-btn {
		background: none;
		border: none;
		color: rgba(235, 235, 245, 0.4);
		cursor: pointer;
		padding: 2px;
		display: flex;
		transition: color 0.15s;
	}

	.dm-add-btn:hover {
		color: rgba(235, 235, 245, 0.8);
	}

	.dm-empty {
		padding: 8px;
	}

	.dm-empty p {
		color: rgba(235, 235, 245, 0.3);
		font-size: 13px;
		text-align: center;
		margin: 0;
	}

	/* DM List */
	.dm-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
		max-height: 100%;
	}

	.dm-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 8px;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.15s;
		background: none;
		border: none;
		color: inherit;
		font-family: inherit;
		font-size: inherit;
		text-align: left;
		width: 100%;
		position: relative;
	}

	.dm-item:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.dm-item.active {
		background: rgba(255, 255, 255, 0.1);
	}

	.dm-item.active:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	/* Avatar */
	.dm-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: visible;
	}

	.dm-avatar-img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.dm-avatar-initials {
		font-size: 12px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		line-height: 1;
		text-transform: uppercase;
	}

	/* Status dot */
	.dm-status-dot {
		position: absolute;
		bottom: -1px;
		right: -1px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 2px solid rgba(30, 30, 30, 1);
		z-index: 1;
	}

	/* Info */
	.dm-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.dm-name {
		font-size: 14px;
		font-weight: 500;
		color: rgba(235, 235, 245, 0.85);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dm-item.active .dm-name {
		color: rgba(255, 255, 255, 1);
	}

	.dm-meta {
		font-size: 12px;
		color: rgba(235, 235, 245, 0.35);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Close button */
	.dm-close-btn {
		opacity: 0;
		background: none;
		border: none;
		color: rgba(235, 235, 245, 0.3);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: opacity 0.15s, color 0.15s, background 0.15s;
		flex-shrink: 0;
	}

	.dm-item:hover .dm-close-btn {
		opacity: 1;
	}

	.dm-close-btn:hover {
		color: rgba(235, 235, 245, 0.7);
		background: rgba(255, 255, 255, 0.08);
	}

	/* Group DM avatars */
	.dm-group-avatars {
		border-radius: 8px;
	}
</style>
