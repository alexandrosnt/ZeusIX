<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import type { ServerMember } from '$lib/types';
	import { goto } from '$app/navigation';

	import Titlebar from '$lib/components/Titlebar.svelte';
	import ServerRail from '$lib/components/ServerRail.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MembersSidebar from '$lib/components/MembersSidebar.svelte';
	import CreateServerModal from '$lib/components/CreateServerModal.svelte';
	import DeleteServerConfirmModal from '$lib/components/DeleteServerConfirmModal.svelte';
	import CreateChannelModal from '$lib/components/CreateChannelModal.svelte';
	import ServerSettingsModal from '$lib/components/ServerSettingsModal.svelte';
	import InviteModal from '$lib/components/InviteModal.svelte';
	import FriendsPage from '$lib/components/FriendsPage.svelte';
	import IncomingCallModal from '$lib/components/IncomingCallModal.svelte';
	import CreateGroupDmModal from '$lib/components/CreateGroupDmModal.svelte';

	import { serversStore } from '$lib/stores/servers.svelte';
	import { channelsStore } from '$lib/stores/channels.svelte';
	import { messagesStore } from '$lib/stores/messages.svelte';
	import { membersStore } from '$lib/stores/members.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { dmsStore } from '$lib/stores/dms.svelte';
	import { callsStore } from '$lib/stores/calls.svelte';
	import { updaterStore } from '$lib/stores/updater.svelte';
	import { PERMISSIONS } from '$lib/utils/permissions';
	import { hasPermission } from '$lib/utils/permissions';
	import { applyTheme } from '$lib/utils/theme-applier';

	import {
		getServers, getChannels, getMessages, getMembers, getMe,
		createServer, deleteServer as apiDeleteServer,
		createChannel as apiCreateChannel, deleteChannel as apiDeleteChannel,
		updateServer as apiUpdateServer,
		createRole as apiCreateRole, updateRole as apiUpdateRole, deleteRole as apiDeleteRole,
		assignRole as apiAssignRole, removeRole as apiRemoveRole,
		reorderRoles as apiReorderRoles,
		listDms,
		acceptCall, joinCall, leaveCall, declineCall, getActiveCall,
	} from '$lib/services/api';
	import { gateway } from '$lib/services/gateway';
	// Lazy-load livekit-client (~50MB) — only fetched on first voice/call use
	const lk = () => import('$lib/services/livekit').then(m => m.livekit);

	let { children }: { children: Snippet } = $props();

	let showMembers = $state(true);
	let showCreateServer = $state(false);
	let showDeleteConfirm = $state(false);
	let showServerSettings = $state(false);
	let showCreateChannel = $state(false);
	let showInviteModal = $state(false);
	let showCreateGroupDm = $state(false);
	let createChannelCategory = $state<string | undefined>(undefined);
	let members = $state<ServerMember[]>([]);
	let loading = $state(true);
	let friendsInitialTab = $state<'all' | 'online' | 'pending' | 'add'>('all');

	// Compute current user's roles in the active server
	let myRoles = $derived.by(() => {
		const userId = authStore.user?.id;
		if (!userId) return [];
		const member = members.find((m) => m.user_id === userId);
		return member?.roles ?? [];
	});
	let isOwner = $derived(serversStore.activeServer?.owner_id === authStore.user?.id);
	let canManageServer = $derived(isOwner || hasPermission(myRoles, PERMISSIONS.MANAGE_SERVER));
	let canManageChannels = $derived(isOwner || hasPermission(myRoles, PERMISSIONS.MANAGE_CHANNELS));

	// Keep members store in sync with local state
	$effect(() => {
		membersStore.setMembers(members);
	});

	// Attempt session restore immediately (synchronous - reads localStorage)
	if (!authStore.isAuthenticated) {
		authStore.restoreSession();
	}

	// Auth guard: redirect to login if not authenticated
	$effect(() => {
		if (!authStore.isAuthenticated) {
			goto('/login', { replaceState: true });
		}
	});

	// --- Apply theme settings reactively ---
	$effect(() => {
		try {
			if (typeof document !== 'undefined') {
				applyTheme({
					theme: settingsStore.theme,
					accentColor: settingsStore.accentColor,
					chatFontFamily: settingsStore.chatFontFamily,
					chatFontSize: settingsStore.chatFontSize
				});
			}
		} catch (err) {
			console.error('[Theme] Failed to apply theme:', err);
		}
	});

	// --- Initialization: validate session, connect gateway, fetch servers ---
	$effect(() => {
		if (!authStore.isAuthenticated) return;

		untrack(() => {
			initializeApp();
		});
	});

	async function initializeApp() {
		try {
			loading = true;

			// Validate the stored token by fetching fresh user profile
			try {
				const me = await getMe();
				authStore.setUser(me);
			} catch {
				// Token expired or invalid - force re-login
				authStore.logout();
				return;
			}

			// Connect gateway
			gateway.connect();

			// Fetch user's servers
			const servers = await getServers();
			serversStore.setServers(servers);

			// Fetch user's DMs
			try {
				const dms = await listDms();
				dmsStore.setChannels(dms);
			} catch {
				console.warn('[App] Failed to fetch DMs');
			}

			// Don't auto-select a server - start on Home (friends/DMs)
		} catch (err) {
			console.error('[App] Failed to initialize:', err);
		} finally {
			loading = false;
		}
	}

	// --- When server changes: fetch channels + members ---
	$effect(() => {
		const serverId = serversStore.activeServerId;
		if (!serverId) return;

		untrack(() => {
			loadServerData(serverId);
		});
	});

	async function loadServerData(serverId: string) {
		try {
			// Fetch channels for this server
			const channels = await getChannels(serverId);
			channelsStore.setChannels(channels);

			// Auto-select first text channel (not voice or category)
			const firstText = channels.find((c) => c.channel_type === 'text');
			channelsStore.setActive(firstText?.id ?? null);

			// Fetch members (enriched with user details from backend JOIN)
			members = await getMembers(serverId);
		} catch (err) {
			console.error('[App] Failed to load server data:', err);
		}
	}

	// --- When channel changes: fetch messages + subscribe via gateway ---
	$effect(() => {
		const channelId = channelsStore.activeChannelId;
		if (!channelId) return;

		untrack(() => {
			loadChannelData(channelId);
		});
	});

	async function loadChannelData(channelId: string) {
		try {
			// Only load messages for text channels
			const channel = channelsStore.channels.find((c) => c.id === channelId);
			if (!channel || channel.channel_type !== 'text') return;

			// Unsubscribe from previous channel is handled server-side;
			// subscribing to a new set replaces the old subscription.
			gateway.subscribe([channelId]);

			// Fetch messages for this channel
			const msgs = await getMessages(channelId);
			messagesStore.setMessages(channelId, msgs);
			messagesStore.setActiveChannel(channelId);
		} catch (err) {
			console.error('[App] Failed to load channel data:', err);
		}
	}

	// --- Cleanup gateway on destroy ---
	$effect(() => {
		return () => {
			gateway.disconnect();
		};
	});

	// --- Handlers ---
	async function handleServerHome() {
		serversStore.setActive(null);
		channelsStore.setChannels([]);
		channelsStore.setActive(null);
		dmsStore.setActive(null);
		members = [];
		// Navigate to home route to unmount any stale DM/server page
		await goto('/');
	}

	async function handleServerSelect(serverId: string) {
		serversStore.setActive(serverId);
		dmsStore.setActive(null);
		// Navigate away from DM route to prevent stale DM content rendering
		await goto('/');
	}

	function handleServerAdd() {
		showCreateServer = true;
	}

	async function handleAddFriend() {
		// Navigate home and open the Add Friend tab
		serversStore.setActive(null);
		channelsStore.setChannels([]);
		channelsStore.setActive(null);
		dmsStore.setActive(null);
		members = [];
		friendsInitialTab = 'add';
		await goto('/');
	}

	async function handleCreateServer(name: string, isPublic: boolean) {
		const server = await createServer(name, isPublic);
		serversStore.addServer(server);
		serversStore.setActive(server.id);
		showCreateServer = false;
	}

	// --- Server management handlers ---
	async function handleDeleteServer() {
		const serverId = serversStore.activeServerId;
		if (!serverId) return;
		await apiDeleteServer(serverId);
		serversStore.removeServer(serverId);
		channelsStore.setChannels([]);
		channelsStore.setActive(null);
		members = [];
		showDeleteConfirm = false;
	}

	function handleInvite() {
		if (!serversStore.activeServerId) return;
		showInviteModal = true;
	}

	// --- Channel management handlers ---
	async function handleCreateChannel(name: string, type: 'text' | 'voice' | 'category', categoryId?: string) {
		const serverId = serversStore.activeServerId;
		if (!serverId) return;
		const channel = await apiCreateChannel(serverId, name, type, categoryId);
		channelsStore.addChannel(channel);
		// Auto-select newly created text channels
		if (type === 'text') {
			channelsStore.setActive(channel.id);
		}
		showCreateChannel = false;
	}

	async function handleDeleteChannel(channelId: string) {
		await apiDeleteChannel(channelId);
		channelsStore.removeChannel(channelId);
		// If we deleted the active channel, select another
		if (channelsStore.activeChannelId === channelId) {
			const firstText = channelsStore.channels.find((c) => c.channel_type === 'text');
			channelsStore.setActive(firstText?.id ?? null);
		}
	}

	// --- Server settings handlers ---
	async function handleUpdateServer(data: { name?: string; is_public?: boolean }) {
		const serverId = serversStore.activeServerId;
		if (!serverId) return;
		const updated = await apiUpdateServer(serverId, data);
		serversStore.updateServer(serverId, updated);
	}

	async function handleCreateRole(name: string, color?: string, permissions?: number) {
		const serverId = serversStore.activeServerId;
		if (!serverId) return;
		await apiCreateRole(serverId, name, color, permissions);
		// Refresh members to get updated roles
		members = await getMembers(serverId);
	}

	async function handleUpdateRole(roleId: string, data: { name?: string; color?: string; permissions?: number }) {
		await apiUpdateRole(roleId, data);
		const serverId = serversStore.activeServerId;
		if (serverId) members = await getMembers(serverId);
	}

	async function handleDeleteRole(roleId: string) {
		await apiDeleteRole(roleId);
		const serverId = serversStore.activeServerId;
		if (serverId) members = await getMembers(serverId);
	}

	async function handleReorderRoles(reordered: { id: string; position: number }[]) {
		const serverId = serversStore.activeServerId;
		if (!serverId) return;
		await apiReorderRoles(serverId, reordered);
		members = await getMembers(serverId);
		membersStore.setMembers(members);
	}

	async function handleAssignRole(userId: string, roleId: string) {
		const serverId = serversStore.activeServerId;
		if (!serverId) return;
		await apiAssignRole(serverId, userId, roleId);
		members = await getMembers(serverId);
	}

	async function handleRemoveRole(userId: string, roleId: string) {
		const serverId = serversStore.activeServerId;
		if (!serverId) return;
		await apiRemoveRole(serverId, userId, roleId);
		members = await getMembers(serverId);
	}

	async function handleVoiceJoin(channelId: string) {
		(await lk()).joinVoiceChannel(channelId);
	}

	async function handleVoiceDisconnect() {
		(await lk()).leaveVoiceChannel();
	}

	/** Fetch active call info and populate callsStore.participants */
	async function populateCallParticipants(dmChannelId: string) {
		try {
			const callInfo = await getActiveCall(dmChannelId);
			if (callInfo?.participants) {
				for (const p of callInfo.participants) {
					callsStore.addParticipant(p);
				}
			}
			// Always ensure local user is in the list
			const me = authStore.user;
			if (me) {
				callsStore.addParticipant({ user_id: me.id, username: me.username });
			}
		} catch (err) {
			console.error('[App] Failed to fetch call participants:', err);
			// At minimum add ourselves
			const me = authStore.user;
			if (me) {
				callsStore.addParticipant({ user_id: me.id, username: me.username });
			}
		}
	}

	// --- Call handlers ---
	async function handleAcceptCall() {
		const call = callsStore.incomingCall;
		if (!call) return;
		try {
			const { token, url } = await acceptCall(call.dm_channel_id);
			callsStore.setIncomingCall(null);
			// Set status to 'active' — don't use the old 'ringing' call object
			callsStore.setActiveCall({ ...call, status: 'active' });
			await (await lk()).joinCallRoom(url, token, call.dm_channel_id);
			await populateCallParticipants(call.dm_channel_id);
			// Navigate to the DM so the receiver sees the call UI
			serversStore.setActive(null);
			channelsStore.setChannels([]);
			channelsStore.setActive(null);
			dmsStore.setActive(call.dm_channel_id);
			await goto(`/dms/${call.dm_channel_id}`);
		} catch (err) {
			console.error('[App] Failed to accept call:', err);
			callsStore.setIncomingCall(null);
		}
	}

	// When the call becomes active and we're the initiator, join the LiveKit room
	let lastActiveCallId: string | null = null;
	$effect(() => {
		const call = callsStore.activeCall;
		const myId = authStore.user?.id;
		if (call && myId && call.initiator_id === myId && call.status === 'active' && call.id !== lastActiveCallId) {
			lastActiveCallId = call.id;
			untrack(() => {
				joinCallAsInitiator(call.dm_channel_id);
			});
		} else if (!call) {
			lastActiveCallId = null;
		}
	});

	async function joinCallAsInitiator(dmChannelId: string) {
		try {
			const { token, url } = await joinCall(dmChannelId);
			await (await lk()).joinCallRoom(url, token, dmChannelId);
			await populateCallParticipants(dmChannelId);
		} catch (err) {
			console.error('[App] Failed to join call as initiator:', err);
		}
	}

	async function handleEndCall() {
		const call = callsStore.activeCall;
		if (call) {
			try {
				await leaveCall(call.dm_channel_id);
			} catch (err) {
				console.error('[App] Failed to leave call:', err);
			}
		}
		lk().then(svc => svc.leaveCallRoom());
		callsStore.setActiveCall(null);
	}

	async function handleDeclineCall() {
		const call = callsStore.incomingCall;
		if (!call) return;
		try {
			await declineCall(call.dm_channel_id);
		} catch (err) {
			console.error('[App] Failed to decline call:', err);
		}
		callsStore.setIncomingCall(null);
	}
</script>

{#if authStore.isAuthenticated}
<div class="app-frame">
	<Titlebar />
	{#if updaterStore.available}
		<div class="update-bar">
			<span>A new version is available — <strong>v{updaterStore.version}</strong></span>
			<div class="update-actions">
				{#if updaterStore.downloading}
					<span class="update-downloading">Downloading...</span>
				{:else}
					<button class="update-btn" onclick={() => updaterStore.install()}>Update now</button>
					<button class="update-dismiss" onclick={() => updaterStore.dismiss()}>Later</button>
				{/if}
			</div>
		</div>
	{/if}
	<div id="app-window">
		<ServerRail
			onhome={handleServerHome}
			onselect={handleServerSelect}
			onadd={handleServerAdd}
			onjoin={handleServerSelect}
		/>
		<Sidebar
			onaddfriend={handleAddFriend}
			oninvite={handleInvite}
			onsettings={canManageServer ? () => showServerSettings = true : undefined}
			ondelete={isOwner ? () => showDeleteConfirm = true : undefined}
			oncreatechannel={canManageChannels ? (categoryId) => { createChannelCategory = categoryId; showCreateChannel = true; } : undefined}
			candeletechannel={canManageChannels}
			onchanneldelete={handleDeleteChannel}
			onvoicejoin={handleVoiceJoin}
			onvoicedisconnect={handleVoiceDisconnect}
			oncalldisconnect={handleEndCall}
			oncreategroupdm={() => showCreateGroupDm = true}
		/>
		<main class="main-content">
			{#if loading}
				<div class="loading-state">
					<p>Loading...</p>
				</div>
			{:else if !serversStore.activeServerId && dmsStore.activeChannelId}
				{@render children()}
			{:else if !serversStore.activeServerId}
				<FriendsPage initialTab={friendsInitialTab} />
			{:else}
				{@render children()}
			{/if}
		</main>
		{#if showMembers && serversStore.activeServerId && members.length > 0}
			<MembersSidebar
				{members}
				canmanageroles={canManageServer}
				onassignrole={handleAssignRole}
				onremoverole={handleRemoveRole}
			/>
		{/if}
	</div>
</div>

{#if showCreateServer}
	<CreateServerModal
		onclose={() => showCreateServer = false}
		oncreate={handleCreateServer}
	/>
{/if}

{#if showDeleteConfirm && serversStore.activeServer}
	<DeleteServerConfirmModal
		serverName={serversStore.activeServer.name}
		onclose={() => showDeleteConfirm = false}
		onconfirm={handleDeleteServer}
	/>
{/if}

{#if showCreateChannel && serversStore.activeServerId}
	<CreateChannelModal
		categories={channelsStore.categories.filter((c) => c.id !== '__uncategorized').map((c) => ({ id: c.id, name: c.name }))}
		defaultCategoryId={createChannelCategory}
		onclose={() => showCreateChannel = false}
		oncreate={handleCreateChannel}
	/>
{/if}

{#if showServerSettings && serversStore.activeServer}
	<ServerSettingsModal
		server={serversStore.activeServer}
		{members}
		onclose={() => showServerSettings = false}
		onupdateserver={handleUpdateServer}
		oncreaterole={handleCreateRole}
		onupdaterole={handleUpdateRole}
		ondeleterole={handleDeleteRole}
		onreorderroles={handleReorderRoles}
		onassignrole={handleAssignRole}
		onremoverole={handleRemoveRole}
	/>
{/if}

{#if showInviteModal && serversStore.activeServerId}
	<InviteModal
		serverId={serversStore.activeServerId}
		onclose={() => showInviteModal = false}
	/>
{/if}

{#if showCreateGroupDm}
	<CreateGroupDmModal
		onclose={() => showCreateGroupDm = false}
	/>
{/if}

{#if callsStore.incomingCall}
	<IncomingCallModal
		call={callsStore.incomingCall}
		onaccept={handleAcceptCall}
		ondecline={handleDeclineCall}
	/>
{/if}
{/if}

<style>
	.app-frame {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 0;
		background-color: var(--bg-app, #000000);
		background-image: radial-gradient(circle at 0% 0%, #2c1e4a 0%, transparent 50%),
			radial-gradient(circle at 100% 100%, #1a2a40 0%, transparent 50%);
		box-shadow:
			0 0 0 1px #000000,
			inset 0 0 0 1px rgba(255, 255, 255, 0.08);
		position: relative;
		isolation: isolate;
	}

	/* Frosted glass overlay -- same radius, clipped by parent overflow:hidden */
	.app-frame::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--bg-glass-heavy, rgba(28, 28, 30, 0.65));
		backdrop-filter: blur(40px);
		-webkit-backdrop-filter: blur(40px);
		z-index: 0;
		pointer-events: none;
	}

	/* All content sits above the glass */
	.app-frame > :global(*) {
		position: relative;
		z-index: 1;
	}

	#app-window {
		flex: 1;
		display: flex;
		overflow: hidden;
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.loading-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(255, 255, 255, 0.5);
		font-size: 1rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.update-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 16px;
		background: linear-gradient(135deg, rgba(10, 132, 255, 0.15), rgba(191, 90, 242, 0.15));
		border-bottom: 1px solid rgba(10, 132, 255, 0.2);
		font-size: 13px;
		color: rgba(255, 255, 255, 0.9);
		flex-shrink: 0;
	}

	.update-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.update-btn {
		padding: 3px 12px;
		border: none;
		border-radius: 4px;
		background: var(--accent-blue, #0a84ff);
		color: white;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.update-btn:hover {
		opacity: 0.85;
	}

	.update-dismiss {
		padding: 3px 8px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: rgba(255, 255, 255, 0.5);
		font-size: 12px;
		cursor: pointer;
	}

	.update-dismiss:hover {
		color: rgba(255, 255, 255, 0.8);
	}

	.update-downloading {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.6);
	}

</style>
