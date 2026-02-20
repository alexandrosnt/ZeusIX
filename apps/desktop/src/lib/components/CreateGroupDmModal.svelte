<script lang="ts">
	import { X, Check } from 'lucide-svelte';
	import { listFriends, createGroupDm } from '$lib/services/api';
	import { dmsStore } from '$lib/stores/dms.svelte';
	import { goto } from '$app/navigation';
	import type { Friendship } from '$lib/types';

	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	let visible = $state(false);
	let friends: Friendship[] = $state([]);
	let selectedIds = $state(new Set<string>());
	let groupName = $state('');
	let loading = $state(true);
	let creating = $state(false);
	let error: string | null = $state(null);
	let search = $state('');

	let acceptedFriends = $derived(friends.filter((f) => f.status === 'accepted'));
	let filteredFriends = $derived.by(() => {
		const q = search.toLowerCase().trim();
		if (!q) return acceptedFriends;
		return acceptedFriends.filter((f) => f.username.toLowerCase().includes(q));
	});
	let canCreate = $derived(selectedIds.size >= 1 && selectedIds.size <= 9 && !creating);

	$effect(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	$effect(() => {
		loadFriends();
	});

	async function loadFriends() {
		loading = true;
		try {
			friends = await listFriends();
		} catch {
			error = 'Failed to load friends';
		} finally {
			loading = false;
		}
	}

	function toggleFriend(userId: string) {
		if (selectedIds.has(userId)) {
			selectedIds.delete(userId);
			selectedIds = new Set(selectedIds);
		} else {
			if (selectedIds.size >= 9) return;
			selectedIds.add(userId);
			selectedIds = new Set(selectedIds);
		}
	}

	async function handleCreate() {
		if (!canCreate) return;
		creating = true;
		error = null;
		try {
			const recipientIds = Array.from(selectedIds);
			const dm = await createGroupDm(recipientIds, groupName.trim() || undefined);
			dmsStore.addOrUpdateChannel(dm);
			dmsStore.setActive(dm.id);
			onclose();
			await goto(`/dms/${dm.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create group DM';
		} finally {
			creating = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function getInitial(name: string): string {
		return name.charAt(0).toUpperCase();
	}

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
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" class:visible role="dialog" aria-label="Create Group DM">
	<div class="modal" class:visible>
		<header class="modal-header">
			<h2>Select Friends</h2>
			<span class="selected-count">
				{selectedIds.size}/9 selected
			</span>
			<button class="close-btn" onclick={onclose} aria-label="Close">
				<X size={20} />
			</button>
		</header>

		<div class="name-input-wrapper">
			<input
				type="text"
				class="name-input"
				placeholder="Group Name (optional)"
				bind:value={groupName}
				maxlength={100}
			/>
		</div>

		<div class="search-wrapper">
			<input
				type="text"
				class="search-input"
				placeholder="Search friends..."
				bind:value={search}
			/>
		</div>

		<div class="friend-list">
			{#if loading}
				<div class="empty-state">
					<div class="spinner"></div>
				</div>
			{:else if filteredFriends.length === 0}
				<div class="empty-state">
					<p>{search ? 'No friends found' : 'No friends to add'}</p>
				</div>
			{:else}
				{#each filteredFriends as friend (friend.id)}
					{@const isSelected = selectedIds.has(friend.user_id)}
					<button
						class="friend-row"
						class:selected={isSelected}
						onclick={() => toggleFriend(friend.user_id)}
					>
						<div class="friend-avatar" style:background={getAvatarGradient(friend.username)}>
							{#if friend.avatar_url}
								<img src={friend.avatar_url} alt={friend.username} class="avatar-img" />
							{:else}
								{getInitial(friend.username)}
							{/if}
						</div>
						<span class="friend-name">{friend.username}</span>
						<span class="friend-disc">#{friend.discriminator}</span>
						<div class="checkbox" class:checked={isSelected}>
							{#if isSelected}
								<Check size={14} />
							{/if}
						</div>
					</button>
				{/each}
			{/if}
		</div>

		{#if error}
			<p class="error-text">{error}</p>
		{/if}

		<footer class="modal-footer">
			<button class="cancel-btn" onclick={onclose}>Cancel</button>
			<button class="create-btn" onclick={handleCreate} disabled={!canCreate}>
				{creating ? 'Creating...' : `Create Group DM`}
			</button>
		</footer>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 500;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.overlay.visible {
		opacity: 1;
	}

	.modal {
		width: 420px;
		max-height: 70vh;
		display: flex;
		flex-direction: column;
		background: rgba(30, 30, 32, 0.98);
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
		transform: scale(0.95) translateY(10px);
		transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
		overflow: hidden;
	}

	.modal.visible {
		transform: scale(1) translateY(0);
	}

	.modal-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px 16px 12px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.modal-header h2 {
		font-size: 16px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		margin: 0;
		flex: 1;
	}

	.selected-count {
		font-size: 12px;
		color: rgba(235, 235, 245, 0.4);
		white-space: nowrap;
	}

	.close-btn {
		background: none;
		border: none;
		color: rgba(235, 235, 245, 0.4);
		cursor: pointer;
		padding: 4px;
		display: flex;
		border-radius: 4px;
		transition: color 0.15s;
	}

	.close-btn:hover {
		color: rgba(235, 235, 245, 0.8);
	}

	.name-input-wrapper {
		padding: 8px 16px 0;
	}

	.name-input,
	.search-input {
		width: 100%;
		padding: 10px 12px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(0, 0, 0, 0.3);
		color: rgba(255, 255, 255, 0.95);
		font-size: 14px;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s;
		box-sizing: border-box;
	}

	.name-input::placeholder,
	.search-input::placeholder {
		color: rgba(235, 235, 245, 0.25);
	}

	.name-input:focus,
	.search-input:focus {
		border-color: var(--accent-blue, #0a84ff);
	}

	.search-wrapper {
		padding: 8px 16px;
	}

	.friend-list {
		flex: 1;
		overflow-y: auto;
		padding: 0 8px;
		min-height: 120px;
		max-height: 320px;
	}

	.friend-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
		border-radius: 8px;
		cursor: pointer;
		background: none;
		border: none;
		width: 100%;
		text-align: left;
		font-family: inherit;
		color: inherit;
		transition: background 0.15s;
	}

	.friend-row:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.friend-row.selected {
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.08);
	}

	.friend-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		font-weight: 600;
		color: white;
		flex-shrink: 0;
		overflow: hidden;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.friend-name {
		font-size: 14px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.95);
	}

	.friend-disc {
		font-size: 14px;
		color: rgba(235, 235, 245, 0.3);
	}

	.checkbox {
		margin-left: auto;
		width: 20px;
		height: 20px;
		border-radius: 4px;
		border: 2px solid rgba(255, 255, 255, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.checkbox.checked {
		background: var(--accent-blue, #0a84ff);
		border-color: var(--accent-blue, #0a84ff);
		color: white;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 32px;
		color: rgba(235, 235, 245, 0.3);
		font-size: 13px;
	}

	.empty-state p {
		margin: 0;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255, 255, 255, 0.1);
		border-top-color: var(--accent-blue, #0a84ff);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-text {
		padding: 0 16px;
		font-size: 13px;
		color: #FF453A;
		margin: 4px 0;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 16px;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.cancel-btn {
		padding: 8px 16px;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: rgba(235, 235, 245, 0.6);
		font-size: 14px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.15s;
	}

	.cancel-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(235, 235, 245, 0.8);
	}

	.create-btn {
		padding: 8px 20px;
		border-radius: 8px;
		border: none;
		background: var(--accent-blue, #0a84ff);
		color: white;
		font-size: 14px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.15s;
	}

	.create-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.create-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.friend-list::-webkit-scrollbar {
		width: 6px;
	}

	.friend-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.friend-list::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}
</style>
