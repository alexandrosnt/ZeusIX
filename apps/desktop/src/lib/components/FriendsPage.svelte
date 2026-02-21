<script lang="ts">
	import { Users, UserPlus, Check, X, Search, Clock, MessageCircle } from 'lucide-svelte';
	import { searchUsers, listFriends, sendFriendRequest, acceptFriend, declineFriend, removeFriend, createDm, blockUser, ignoreUser } from '$lib/services/api';
	import { dmsStore } from '$lib/stores/dms.svelte';
	import { friendsStore } from '$lib/stores/friends.svelte';
	import { presenceStore } from '$lib/stores/presence.svelte';
	import { unreadStore } from '$lib/stores/unread.svelte';
	import { goto } from '$app/navigation';
	import ContextMenu from './ContextMenu.svelte';
	import type { User, Friendship } from '$lib/types';

	type Tab = 'all' | 'online' | 'pending' | 'add';

	let { initialTab = 'all' as Tab }: { initialTab?: Tab } = $props();

	let activeTab: Tab = $state('all');
	let loading = $state(true);
	let error: string | null = $state(null);

	// Add Friend tab state
	let addInput = $state('');
	let addMessage: { text: string; type: 'success' | 'error' } | null = $state(null);
	let addLoading = $state(false);

	// Search state
	let searchQuery = $state('');
	let searchResults: User[] = $state([]);
	let searchLoading = $state(false);

	// Hover state for remove buttons
	let hoveredFriendId: string | null = $state(null);

	// Sync tab when initialTab prop changes externally
	$effect(() => {
		activeTab = initialTab;
	});

	// Derived lists
	let acceptedFriends = $derived(friendsStore.friends.filter((f) => f.status === 'accepted'));
	let onlineFriends = $derived(acceptedFriends.filter((f) => presenceStore.getStatus(f.user_id) !== 'offline'));
	let pendingFriends = $derived(friendsStore.friends.filter((f) => f.status === 'pending'));

	// Tab counts
	let onlineCount = $derived(onlineFriends.length);
	let pendingCount = $derived(pendingFriends.length);
	let allCount = $derived(acceptedFriends.length);

	// Display list based on tab
	let displayList = $derived.by(() => {
		switch (activeTab) {
			case 'all':
				return acceptedFriends;
			case 'online':
				return onlineFriends;
			case 'pending':
				return pendingFriends;
			default:
				return [];
		}
	});

	// Load friends on mount
	$effect(() => {
		loadFriends();
	});

	// Debounced search — setTimeout is inherently side-effectful,
	// so $effect with teardown is the correct pattern here.
	$effect(() => {
		const query = searchQuery;
		let cancelled = false;

		if (!query.trim()) {
			searchResults = [];
			searchLoading = false;
			return;
		}

		searchLoading = true;
		const timer = setTimeout(async () => {
			try {
				const results = await searchUsers(query.trim());
				if (!cancelled) {
					searchResults = results;
				}
			} catch {
				if (!cancelled) {
					searchResults = [];
				}
			} finally {
				if (!cancelled) {
					searchLoading = false;
				}
			}
		}, 300);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	});

	async function loadFriends() {
		loading = true;
		error = null;
		try {
			friendsStore.setFriends(await listFriends());
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load friends';
		} finally {
			loading = false;
		}
	}

	function getInitial(username: string): string {
		return username.charAt(0).toUpperCase();
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

	async function handleSendRequest() {
		const input = addInput.trim();
		if (!input) return;

		const parts = input.split('#');
		if (parts.length !== 2 || !parts[0] || !parts[1] || !/^\d{4}$/.test(parts[1])) {
			addMessage = { text: 'Invalid format. Use Username#0000 (4-digit tag)', type: 'error' };
			return;
		}

		const [username, discriminator] = parts;
		addLoading = true;
		addMessage = null;

		try {
			const result = await sendFriendRequest(username, discriminator);
			addMessage = { text: `Friend request sent to ${username}#${discriminator}!`, type: 'success' };
			addInput = '';

			// Optimistic: add to pending list
			friendsStore.addOrUpdate({
				id: result.id ?? crypto.randomUUID(),
				user_id: '',
				username,
				discriminator,
				avatar_url: null,
				status: 'pending',
				direction: 'outgoing',
				friend_status: null,
				since: new Date().toISOString()
			});
		} catch (e) {
			addMessage = { text: e instanceof Error ? e.message : 'Failed to send request', type: 'error' };
		} finally {
			addLoading = false;
		}
	}

	async function handleAccept(friendship: Friendship) {
		try {
			await acceptFriend(friendship.id);
			friendsStore.updateStatus(friendship.id, 'accepted');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to accept request';
		}
	}

	async function handleDecline(friendship: Friendship) {
		try {
			await declineFriend(friendship.id);
			friendsStore.remove(friendship.id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to decline request';
		}
	}

	async function handleRemove(friendship: Friendship) {
		try {
			await removeFriend(friendship.id);
			friendsStore.remove(friendship.id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to remove friend';
		}
	}

	async function handleSearchAdd(user: User) {
		try {
			const result = await sendFriendRequest(user.username, user.discriminator);
			// Optimistic update
			friendsStore.addOrUpdate({
				id: result.id ?? crypto.randomUUID(),
				user_id: user.id,
				username: user.username,
				discriminator: user.discriminator,
				avatar_url: user.avatar_url,
				status: 'pending',
				direction: 'outgoing',
				friend_status: null,
				since: new Date().toISOString()
			});
			// Remove from search results
			searchResults = searchResults.filter((u) => u.id !== user.id);
		} catch (e) {
			addMessage = { text: e instanceof Error ? e.message : 'Failed to send request', type: 'error' };
		}
	}

	async function handleMessage(friendship: Friendship) {
		try {
			const dm = await createDm(friendship.user_id);
			dmsStore.addOrUpdateChannel(dm);
			dmsStore.setActive(dm.id);
			await goto(`/dms/${dm.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to open DM';
		}
	}

	function handleAddInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleSendRequest();
		}
	}

	// Context menu for friend items
	let ctxMenu: { x: number; y: number; friendship: Friendship } | null = $state(null);

	function handleFriendContextMenu(e: MouseEvent, friendship: Friendship) {
		e.preventDefault();
		e.stopPropagation();
		// Only for accepted friends, not pending
		if (friendship.status !== 'accepted') return;
		ctxMenu = { x: e.clientX, y: e.clientY, friendship };
	}

	function getFriendContextItems(friendship: Friendship) {
		return [
			{
				label: 'Block',
				danger: true,
				action: async () => {
					try {
						await blockUser(friendship.user_id);
						friendsStore.remove(friendship.id);
					} catch { /* silent */ }
				}
			},
			{
				label: 'Remove Friend',
				danger: true,
				divider: true,
				action: async () => {
					try {
						await removeFriend(friendship.id);
						friendsStore.remove(friendship.id);
					} catch { /* silent */ }
				}
			},
			{
				label: 'Ignore',
				action: async () => {
					try {
						await ignoreUser(friendship.user_id);
						unreadStore.ignoreUser(friendship.user_id);
					} catch { /* silent */ }
				}
			}
		];
	}
</script>

<div class="friends-page">
	<!-- Header Bar -->
	<header class="header-bar">
		<div class="header-left">
			<Users size={20} />
			<span class="header-title">Friends</span>
			<div class="header-divider"></div>
		</div>

		<nav class="header-tabs">
			<button
				class="tab-btn"
				class:active={activeTab === 'all'}
				onclick={() => (activeTab = 'all')}
			>
				All{#if allCount > 0}<span class="tab-count">{allCount}</span>{/if}
			</button>

			<button
				class="tab-btn"
				class:active={activeTab === 'online'}
				onclick={() => (activeTab = 'online')}
			>
				Online{#if onlineCount > 0}<span class="tab-count">{onlineCount}</span>{/if}
			</button>

			<button
				class="tab-btn"
				class:active={activeTab === 'pending'}
				onclick={() => (activeTab = 'pending')}
			>
				Pending{#if pendingCount > 0}<span class="tab-count">{pendingCount}</span>{/if}
			</button>

			<button
				class="tab-btn add-friend-tab"
				class:active={activeTab === 'add'}
				onclick={() => (activeTab = 'add')}
			>
				Add Friend
			</button>
		</nav>
	</header>

	<!-- Main Content -->
	<div class="content">
		{#if loading}
			<div class="empty-state">
				<div class="spinner"></div>
				<p>Loading friends...</p>
			</div>
		{:else if activeTab === 'add'}
			<!-- Add Friend View -->
			<div class="add-friend-section">
				<div class="add-friend-header">
					<h2>Add Friend</h2>
					<p class="add-friend-desc">You can add friends with their username and discriminator tag.</p>
				</div>

				<div class="add-friend-form">
					<div class="input-row">
						<div class="input-wrapper">
							<input
								type="text"
								class="add-input"
								placeholder="Enter a Username#0000"
								bind:value={addInput}
								onkeydown={handleAddInputKeydown}
								disabled={addLoading}
							/>
						</div>
						<button
							class="send-btn"
							onclick={handleSendRequest}
							disabled={addLoading || !addInput.trim()}
						>
							{#if addLoading}
								Sending...
							{:else}
								Send Friend Request
							{/if}
						</button>
					</div>

					{#if addMessage}
						<p class="add-message" class:success={addMessage.type === 'success'} class:error={addMessage.type === 'error'}>
							{addMessage.text}
						</p>
					{/if}
				</div>

				<!-- User Search Section -->
				<div class="search-section">
					<div class="search-divider"></div>
					<h3 class="search-heading">Search Users</h3>
					<div class="search-input-wrapper">
						<Search size={16} />
						<input
							type="text"
							class="search-input"
							placeholder="Search for users..."
							bind:value={searchQuery}
						/>
					</div>

					{#if searchLoading}
						<div class="search-loading">
							<div class="spinner small"></div>
							<span>Searching...</span>
						</div>
					{:else if searchResults.length > 0}
						<div class="search-results">
							{#each searchResults as user (user.id)}
								<div class="friend-row">
									<div class="avatar" style:background={getAvatarGradient(user.username)}>
										{#if user.avatar_url}
											<img src={user.avatar_url} alt={user.username} class="avatar-img" />
										{:else}
											{getInitial(user.username)}
										{/if}
									</div>
									<div class="friend-info">
										<span class="friend-name">{user.username}</span><span class="friend-discriminator">#{user.discriminator}</span>
									</div>
									<button class="action-btn add-btn" onclick={() => handleSearchAdd(user)} aria-label="Add friend">
										<UserPlus size={16} />
										<span>Add Friend</span>
									</button>
								</div>
							{/each}
						</div>
					{:else if searchQuery.trim()}
						<div class="search-empty">
							<p>No users found matching "{searchQuery}"</p>
						</div>
					{/if}
				</div>
			</div>
		{:else if displayList.length === 0}
			<!-- Empty States -->
			<div class="empty-state">
				{#if activeTab === 'pending'}
					<Clock size={48} strokeWidth={1.2} />
					<p>No pending requests.</p>
				{:else}
					<Users size={48} strokeWidth={1.2} />
					<p>No friends yet. Add some friends to get started!</p>
					<button class="empty-add-btn" onclick={() => (activeTab = 'add')}>
						<UserPlus size={16} />
						<span>Add Friend</span>
					</button>
				{/if}
			</div>
		{:else}
			<!-- Friend List -->
			<div class="friend-list-header">
				<span>
					{activeTab === 'all' ? 'ALL FRIENDS' : activeTab === 'online' ? 'ONLINE' : 'PENDING'} &mdash; {displayList.length}
				</span>
			</div>
			<div class="friend-list" role="list">
				{#each displayList as friendship (friendship.id)}
					<div
						class="friend-row"
						role="listitem"
						onmouseenter={() => (hoveredFriendId = friendship.id)}
						onmouseleave={() => (hoveredFriendId = null)}
						oncontextmenu={(e) => handleFriendContextMenu(e, friendship)}
					>
						<div class="avatar" style:background={getAvatarGradient(friendship.username)}>
							{#if friendship.avatar_url}
								<img src={friendship.avatar_url} alt={friendship.username} class="avatar-img" />
							{:else}
								{getInitial(friendship.username)}
							{/if}
							{#if activeTab !== 'pending'}
								{@const friendPresence = presenceStore.getStatus(friendship.user_id)}
								<span
									class="status-dot"
									class:online={friendPresence === 'online'}
									class:idle={friendPresence === 'idle'}
									class:dnd={friendPresence === 'dnd'}
								></span>
							{/if}
						</div>

						<div class="friend-info">
							<span class="friend-name">{friendship.username}</span><span class="friend-discriminator">#{friendship.discriminator}</span>
							{#if activeTab === 'pending'}
								<span class="friend-meta">{friendship.direction === 'incoming' ? 'Incoming Request' : 'Outgoing Request'}</span>
							{:else}
								{@const friendPresence = presenceStore.getStatus(friendship.user_id)}
								<span class="friend-meta">{friendPresence === 'online' ? 'Online' : friendPresence === 'idle' ? 'Idle' : friendPresence === 'dnd' ? 'Do Not Disturb' : 'Offline'}</span>
							{/if}
						</div>

						<div class="friend-actions">
							{#if activeTab === 'pending' && friendship.direction === 'incoming'}
								<button
									class="action-btn accept-btn"
									onclick={() => handleAccept(friendship)}
									aria-label="Accept friend request"
								>
									<Check size={18} />
								</button>
								<button
									class="action-btn decline-btn"
									onclick={() => handleDecline(friendship)}
									aria-label="Decline friend request"
								>
									<X size={18} />
								</button>
							{:else if activeTab === 'pending' && friendship.direction === 'outgoing'}
								<button
									class="action-btn decline-btn"
									onclick={() => handleRemove(friendship)}
									aria-label="Cancel friend request"
								>
									<X size={18} />
								</button>
							{:else}
								{#if hoveredFriendId === friendship.id}
									<button
										class="action-btn message-btn"
										aria-label="Message"
										onclick={() => handleMessage(friendship)}
									>
										<MessageCircle size={18} />
									</button>
									<button
										class="action-btn remove-btn"
										onclick={() => handleRemove(friendship)}
										aria-label="Remove friend"
									>
										<X size={18} />
									</button>
								{/if}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if error}
			<div class="error-toast">
				<span>{error}</span>
				<button class="error-dismiss" onclick={() => (error = null)}>
					<X size={14} />
				</button>
			</div>
		{/if}
	</div>
</div>

{#if ctxMenu}
	<ContextMenu
		x={ctxMenu.x}
		y={ctxMenu.y}
		items={getFriendContextItems(ctxMenu.friendship)}
		onclose={() => { ctxMenu = null; }}
	/>
{/if}

<style>
	.friends-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, sans-serif;
		color: rgba(255, 255, 255, 0.95);
	}

	/* Header Bar */
	.header-bar {
		height: 52px;
		min-height: 52px;
		display: flex;
		align-items: center;
		padding: 0 16px;
		gap: 16px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(0, 0, 0, 0.1);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
		color: rgba(235, 235, 245, 0.6);
		flex-shrink: 0;
	}

	.header-title {
		font-size: 15px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
	}

	.header-divider {
		width: 1px;
		height: 24px;
		background: rgba(255, 255, 255, 0.12);
		margin-left: 8px;
	}

	.header-tabs {
		display: flex;
		gap: 4px;
	}

	.tab-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: rgba(235, 235, 245, 0.5);
		font-size: 13px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.tab-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(235, 235, 245, 0.8);
	}

	.tab-btn.active {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.95);
	}

	.tab-btn.add-friend-tab {
		color: #30D158;
		font-weight: 600;
	}

	.tab-btn.add-friend-tab:hover {
		background: rgba(48, 209, 88, 0.1);
	}

	.tab-btn.add-friend-tab.active {
		background: rgba(48, 209, 88, 0.15);
		color: #30D158;
	}

	.tab-count {
		font-size: 11px;
		font-weight: 600;
		background: rgba(255, 255, 255, 0.12);
		padding: 1px 6px;
		border-radius: 10px;
		min-width: 18px;
		text-align: center;
	}

	/* Content */
	.content {
		flex: 1;
		overflow-y: auto;
		position: relative;
	}

	/* Friend List Header */
	.friend-list-header {
		padding: 16px 20px 8px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: rgba(235, 235, 245, 0.4);
		letter-spacing: 0.5px;
	}

	/* Friend List */
	.friend-list {
		padding: 0 12px;
	}

	.friend-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 8px;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.15s ease;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
	}

	.friend-row:first-child {
		border-top: none;
	}

	.friend-row:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	/* Avatar */
	.avatar {
		width: 40px;
		height: 40px;
		min-width: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		font-weight: 600;
		color: white;
		position: relative;
		overflow: visible;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.status-dot {
		position: absolute;
		bottom: -1px;
		right: -1px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #636366;
		border: 3px solid #1c1c1e;
	}

	.status-dot.online {
		background: #30D158;
	}
	.status-dot.idle {
		background: #FF9F0A;
	}
	.status-dot.dnd {
		background: #FF453A;
	}

	/* Friend Info */
	.friend-info {
		flex: 1;
		min-width: 0;
	}

	.friend-name {
		font-size: 14px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.95);
	}

	.friend-discriminator {
		font-size: 14px;
		font-weight: 400;
		color: rgba(235, 235, 245, 0.3);
	}

	.friend-meta {
		display: block;
		font-size: 12px;
		color: rgba(235, 235, 245, 0.3);
		margin-top: 1px;
	}

	/* Actions */
	.friend-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	.action-btn {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		transition: all 0.15s ease;
		background: rgba(255, 255, 255, 0.06);
		color: rgba(235, 235, 245, 0.6);
		padding: 0;
		font-family: inherit;
	}

	.action-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		color: rgba(255, 255, 255, 0.95);
	}

	.action-btn.accept-btn:hover {
		background: rgba(48, 209, 88, 0.2);
		color: #30D158;
	}

	.action-btn.decline-btn:hover,
	.action-btn.remove-btn:hover {
		background: rgba(255, 69, 58, 0.2);
		color: #FF453A;
	}

	.action-btn.message-btn:hover {
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.2);
		color: var(--accent-blue, #0a84ff);
	}

	.action-btn.add-btn {
		width: auto;
		border-radius: 6px;
		padding: 0 12px;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.15);
		color: var(--accent-blue, #0a84ff);
	}

	.action-btn.add-btn:hover {
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.25);
	}

	.action-btn.add-btn span {
		white-space: nowrap;
	}

	/* Empty States */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 80px 20px;
		color: rgba(235, 235, 245, 0.3);
	}

	.empty-state p {
		font-size: 14px;
		margin: 0;
		text-align: center;
	}

	.empty-add-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
		padding: 8px 16px;
		border-radius: 8px;
		border: none;
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.15);
		color: var(--accent-blue, #0a84ff);
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.empty-add-btn:hover {
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.25);
	}

	/* Add Friend Section */
	.add-friend-section {
		padding: 20px;
	}

	.add-friend-header h2 {
		font-size: 16px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		margin: 0 0 4px 0;
	}

	.add-friend-desc {
		font-size: 13px;
		color: rgba(235, 235, 245, 0.4);
		margin: 0 0 16px 0;
	}

	.add-friend-form {
		margin-bottom: 24px;
	}

	.input-row {
		display: flex;
		gap: 12px;
	}

	.input-wrapper {
		flex: 1;
	}

	.add-input {
		width: 100%;
		padding: 12px 16px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(0, 0, 0, 0.3);
		color: rgba(255, 255, 255, 0.95);
		font-size: 14px;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s ease;
		box-sizing: border-box;
	}

	.add-input::placeholder {
		color: rgba(235, 235, 245, 0.25);
	}

	.add-input:focus {
		border-color: var(--accent-blue, #0a84ff);
	}

	.add-input:disabled {
		opacity: 0.5;
	}

	.send-btn {
		padding: 12px 20px;
		border-radius: 8px;
		border: none;
		background: var(--accent-blue, #0a84ff);
		color: white;
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.send-btn:hover:not(:disabled) {
		background: #0971d6;
	}

	.send-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.add-message {
		margin: 10px 0 0 0;
		font-size: 13px;
		font-weight: 500;
	}

	.add-message.success {
		color: #30D158;
	}

	.add-message.error {
		color: #FF453A;
	}

	/* Search Section */
	.search-section {
		margin-top: 8px;
	}

	.search-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.06);
		margin-bottom: 20px;
	}

	.search-heading {
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		color: rgba(235, 235, 245, 0.4);
		letter-spacing: 0.5px;
		margin: 0 0 12px 0;
	}

	.search-input-wrapper {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(0, 0, 0, 0.3);
		color: rgba(235, 235, 245, 0.4);
		transition: border-color 0.15s ease;
	}

	.search-input-wrapper:focus-within {
		border-color: var(--accent-blue, #0a84ff);
		color: rgba(235, 235, 245, 0.6);
	}

	.search-input {
		flex: 1;
		border: none;
		background: transparent;
		color: rgba(255, 255, 255, 0.95);
		font-size: 14px;
		font-family: inherit;
		outline: none;
	}

	.search-input::placeholder {
		color: rgba(235, 235, 245, 0.25);
	}

	.search-results {
		margin-top: 12px;
	}

	.search-loading {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px 0;
		color: rgba(235, 235, 245, 0.4);
		font-size: 13px;
	}

	.search-empty {
		padding: 16px 0;
	}

	.search-empty p {
		color: rgba(235, 235, 245, 0.3);
		font-size: 13px;
		margin: 0;
	}

	/* Spinner */
	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid rgba(255, 255, 255, 0.1);
		border-top-color: var(--accent-blue, #0a84ff);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.spinner.small {
		width: 16px;
		height: 16px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Error Toast */
	.error-toast {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		border-radius: 8px;
		background: rgba(255, 69, 58, 0.15);
		border: 1px solid rgba(255, 69, 58, 0.3);
		color: #FF453A;
		font-size: 13px;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		z-index: 10;
	}

	.error-dismiss {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: #FF453A;
		cursor: pointer;
		padding: 2px;
		opacity: 0.7;
		transition: opacity 0.15s;
	}

	.error-dismiss:hover {
		opacity: 1;
	}

	/* Scrollbar */
	.content::-webkit-scrollbar {
		width: 6px;
	}

	.content::-webkit-scrollbar-track {
		background: transparent;
	}

	.content::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}

	.content::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.15);
	}
</style>
