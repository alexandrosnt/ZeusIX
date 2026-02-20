<script lang="ts">
	import { onMount } from 'svelte';
	import type { User, PresenceStatus } from '$lib/types';
	import { gateway } from '$lib/services/gateway';
	import { presenceStore } from '$lib/stores/presence.svelte';
	import { authStore } from '$lib/stores/auth.svelte';

	interface Props {
		user: User;
		onclose: () => void;
		oneditprofile: () => void;
	}

	let { user, onclose, oneditprofile }: Props = $props();

	let currentStatus: PresenceStatus = $derived(presenceStore.chosenStatus);
	let visible = $state(false);
	let popupEl: HTMLDivElement | undefined = $state(undefined);

	const statusOptions: { value: PresenceStatus; label: string; color: string }[] = [
		{ value: 'online', label: 'Online', color: '#30D158' },
		{ value: 'idle', label: 'Idle', color: '#FF9F0A' },
		{ value: 'dnd', label: 'DND', color: '#FF453A' },
		{ value: 'offline', label: 'Invisible', color: '#636366' }
	];

	let initials = $derived(user.username.slice(0, 2).toUpperCase());

	function selectStatus(status: PresenceStatus) {
		presenceStore.setChosenStatus(status);
		if (authStore.user) {
			presenceStore.updatePresence(authStore.user.id, status);
		}
		gateway.updatePresence(status);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (popupEl && !popupEl.contains(e.target as Node)) {
			onclose();
		}
	}

	onMount(() => {
		// Trigger entrance animation on next frame
		requestAnimationFrame(() => {
			visible = true;
		});

		document.addEventListener('keydown', handleKeydown);
		document.addEventListener('mousedown', handleClickOutside);

		return () => {
			document.removeEventListener('keydown', handleKeydown);
			document.removeEventListener('mousedown', handleClickOutside);
		};
	});
</script>

<div
	class="profile-popup"
	class:visible
	bind:this={popupEl}
	role="dialog"
	aria-label="Profile popup"
>
	<!-- Cover -->
	<div class="cover">
		{#if user.cover_url}
			<img src={user.cover_url} alt="Cover" class="cover-img" />
		{/if}
	</div>

	<!-- Avatar -->
	<div class="avatar-wrapper">
		{#if user.avatar_url}
			<img src={user.avatar_url} alt={user.username} class="avatar-img" />
		{:else}
			<div class="avatar-fallback">
				{initials}
			</div>
		{/if}
	</div>

	<!-- User info -->
	<div class="user-info">
		<span class="username">{user.username}</span><span class="discriminator">#{user.discriminator}</span>
	</div>

	<!-- Divider -->
	<div class="divider"></div>

	<!-- Status selector -->
	<div class="section-label">Status</div>
	<div class="status-row">
		{#each statusOptions as opt (opt.value)}
			<button
				class="status-btn"
				class:active={currentStatus === opt.value}
				onclick={() => selectStatus(opt.value)}
				aria-label="Set status to {opt.label}"
			>
				<span class="status-dot" style:background={opt.color}></span>
				<span class="status-label">{opt.label}</span>
			</button>
		{/each}
	</div>

	<!-- Divider -->
	<div class="divider"></div>

	<!-- Edit Profile button -->
	<button class="edit-profile-btn" onclick={oneditprofile}>
		Edit Profile
	</button>
</div>

<style>
	.profile-popup {
		position: fixed;
		bottom: 64px;
		left: 72px;
		width: 320px;
		background: rgba(var(--glass-heavy-rgb, 28, 28, 30), 0.85);
		backdrop-filter: blur(40px);
		-webkit-backdrop-filter: blur(40px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.4),
			0 2px 8px rgba(0, 0, 0, 0.2);
		overflow: hidden;
		z-index: 1000;
		transform: scale(0.95);
		opacity: 0;
		transition:
			transform 0.2s cubic-bezier(0.2, 0, 0, 1),
			opacity 0.2s ease;
		transform-origin: bottom left;
	}

	.profile-popup.visible {
		transform: scale(1);
		opacity: 1;
	}

	/* Cover */
	.cover {
		width: 100%;
		height: 120px;
		background: linear-gradient(135deg, #2c1e4a, #1a2a40);
		position: relative;
		overflow: hidden;
	}

	.cover-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Avatar */
	.avatar-wrapper {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		border: 4px solid rgba(var(--glass-heavy-rgb, 28, 28, 30), 0.85);
		position: relative;
		margin-top: -40px;
		margin-left: 16px;
		overflow: hidden;
		flex-shrink: 0;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 50%;
	}

	.avatar-fallback {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #ff9f0a, #ff375f);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28px;
		font-weight: 700;
		color: white;
		border-radius: 50%;
	}

	/* User info */
	.user-info {
		padding: 8px 16px 0;
	}

	.username {
		font-size: 20px;
		font-weight: 700;
		color: #fff;
	}

	.discriminator {
		font-size: 20px;
		font-weight: 400;
		color: rgba(235, 235, 245, 0.3);
	}

	/* Divider */
	.divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.08);
		margin: 12px 16px;
	}

	/* Status section */
	.section-label {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		color: rgba(235, 235, 245, 0.4);
		padding: 0 16px;
		margin-bottom: 8px;
		letter-spacing: 0.5px;
	}

	.status-row {
		display: flex;
		gap: 4px;
		padding: 0 16px;
	}

	.status-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 4px;
		border: none;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.15s ease;
		color: rgba(235, 235, 245, 0.6);
	}

	.status-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.status-btn.active {
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
	}

	.status-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-label {
		font-size: 11px;
		font-weight: 500;
	}

	/* Edit Profile button */
	.edit-profile-btn {
		width: calc(100% - 32px);
		margin: 0 16px 16px;
		padding: 10px;
		border: none;
		border-radius: 8px;
		background: rgba(88, 101, 242, 0.8);
		color: #fff;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.edit-profile-btn:hover {
		background: rgba(88, 101, 242, 1);
	}
</style>
