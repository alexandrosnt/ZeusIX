<script lang="ts">
	import { onMount } from 'svelte';
	import { Mic, MicOff, Headphones, HeadphoneOff, Settings } from 'lucide-svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { presenceStore } from '$lib/stores/presence.svelte';
	import { updateProfile } from '$lib/services/api';
	import { gateway } from '$lib/services/gateway';
	const lk = () => import('$lib/services/livekit').then(m => m.livekit);
	import ProfilePopup from './ProfilePopup.svelte';
	import ProfileEditModal from './ProfileEditModal.svelte';
	import UserSettingsModal from './UserSettingsModal.svelte';

	let user = $derived(authStore.user);
	let username = $derived(user?.username ?? 'User');
	let discriminator = $derived(user?.discriminator ?? '0000');
	let avatarUrl = $derived(user?.avatar_url ?? null);
	let status = $derived(user ? presenceStore.getStatus(user.id) : 'offline');
	let isMuted = $derived(voiceStore.muted);
	let isDeafened = $derived(voiceStore.deafened);

	let showPopup = $state(false);
	let showEditModal = $state(false);
	let showSettings = $state(false);

	let initials = $derived.by(() => {
		const name = username;
		const parts = name.split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		}
		return name.slice(0, 2).toUpperCase();
	});

	const statusColors: Record<string, string> = {
		online: '#30D158',
		idle: '#FF9F0A',
		dnd: '#FF453A',
		offline: '#636366'
	};

	let statusColor = $derived(statusColors[status] ?? '#636366');

	// Set presence to online on mount (respects showOnlineStatus setting)
	onMount(() => {
		try {
			if (settingsStore.showOnlineStatus) {
				gateway.updatePresence('online');
			}
		} catch (err) {
			console.error('[UserPanel] Presence error:', err);
		}
	});

	function togglePopup() {
		showPopup = !showPopup;
	}

	async function toggleMute() {
		(await lk()).toggleMute();
	}

	async function toggleDeafen() {
		(await lk()).toggleDeafen();
	}

	function openSettings() {
		showSettings = true;
	}

	function handleEditProfile() {
		showPopup = false;
		showEditModal = true;
	}

	async function handleSaveProfile(data: { username?: string; avatar_url?: string | null; cover_url?: string | null; status?: string }) {
		const updated = await updateProfile(data);
		authStore.setUser(updated);
		showEditModal = false;
	}
</script>

<div class="user-panel-wrapper">
	<div class="user-panel">
		<button class="profile-trigger" onclick={togglePopup} aria-label="Open profile">
			<div class="avatar-container">
				<div class="avatar">
					{#if avatarUrl}
						<img src={avatarUrl} alt={username} class="avatar-img" />
					{:else}
						{initials}
					{/if}
				</div>
				<span class="status-dot" style:background={statusColor}></span>
			</div>

			<div class="user-info">
				<div class="user-name">{username}</div>
				<div class="user-discriminator">#{discriminator}</div>
			</div>
		</button>

		<button
			class="icon-btn"
			class:active-warning={isMuted}
			onclick={toggleMute}
			aria-label={isMuted ? 'Unmute' : 'Mute'}
		>
			{#if isMuted}
				<MicOff size={18} />
			{:else}
				<Mic size={18} />
			{/if}
		</button>

		<button
			class="icon-btn"
			class:active-warning={isDeafened}
			onclick={toggleDeafen}
			aria-label={isDeafened ? 'Undeafen' : 'Deafen'}
		>
			{#if isDeafened}
				<HeadphoneOff size={18} />
			{:else}
				<Headphones size={18} />
			{/if}
		</button>

		<button
			class="icon-btn"
			onclick={openSettings}
			aria-label="Settings"
		>
			<Settings size={18} />
		</button>
	</div>

	{#if showPopup && user}
		<ProfilePopup
			{user}
			onclose={() => showPopup = false}
			oneditprofile={handleEditProfile}
		/>
	{/if}
</div>

{#if showEditModal && user}
	<ProfileEditModal
		{user}
		onclose={() => showEditModal = false}
		onsave={handleSaveProfile}
	/>
{/if}

{#if showSettings}
	<UserSettingsModal onclose={() => showSettings = false} />
{/if}

<style>
	.user-panel-wrapper {
		position: relative;
	}

	.user-panel {
		height: 56px;
		background: rgba(0, 0, 0, 0.2);
		display: flex;
		align-items: center;
		padding: 0 8px;
		gap: 8px;
	}

	.profile-trigger {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		color: inherit;
		font-family: inherit;
		padding: 4px;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.profile-trigger:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.avatar-container {
		position: relative;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, #ff9f0a, #ff375f);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		font-weight: 600;
		color: white;
		overflow: hidden;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.status-dot {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 12px;
		height: 12px;
		border: 2px solid #1c1c1e;
		border-radius: 50%;
		z-index: 1;
	}

	.user-info {
		flex: 1;
		overflow: hidden;
		text-align: left;
	}

	.user-name {
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-discriminator {
		font-size: 11px;
		color: rgba(235, 235, 245, 0.3);
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		cursor: pointer;
		color: rgba(235, 235, 245, 0.6);
		background: none;
		border: none;
		padding: 0;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.icon-btn:hover {
		background: rgba(var(--glass-lighter-rgb, 58, 58, 60), 0.5);
		color: rgba(255, 255, 255, 0.95);
	}

	.icon-btn.active-warning {
		color: #ff453a;
	}

	.icon-btn.active-warning:hover {
		color: #ff6961;
	}
</style>
