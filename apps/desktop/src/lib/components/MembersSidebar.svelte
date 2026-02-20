<script lang="ts">
	import { Crown, Plus, X } from 'lucide-svelte';
	import { presenceStore } from '$lib/stores/presence.svelte';
	import { serversStore } from '$lib/stores/servers.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getRoles } from '$lib/services/api';
	import type { ServerMember, Role } from '$lib/types';

	interface Props {
		members: ServerMember[];
		canmanageroles?: boolean;
		onassignrole?: (userId: string, roleId: string) => Promise<void>;
		onremoverole?: (userId: string, roleId: string) => Promise<void>;
	}

	let { members, canmanageroles = false, onassignrole, onremoverole }: Props = $props();

	let selectedMemberId: string | null = $state(null);
	let selectedMemberRaw = $derived(selectedMemberId ? members.find(m => m.user_id === selectedMemberId) ?? null : null);
	// Use authStore.user for current user's profile (always up-to-date after edits)
	let selectedMember = $derived.by(() => {
		if (!selectedMemberRaw) return null;
		const currentUser = authStore.user;
		if (currentUser && selectedMemberRaw.user_id === currentUser.id) {
			return { ...selectedMemberRaw, user: currentUser };
		}
		return selectedMemberRaw;
	});
	let cardY = $state(0);
	let cardEl: HTMLDivElement | undefined = $state(undefined);

	const avatarColors = [
		'#F47067', '#E0AF68', '#73DACA', '#7AA2F7',
		'#BB9AF7', '#FF9E64', '#2AC3DE', '#9ECE6A',
		'#E06C75', '#C678DD', '#56B6C2', '#D19A66'
	];

	const statusColors: Record<string, string> = {
		online: '#30D158',
		idle: '#FF9F0A',
		dnd: '#FF453A',
		offline: '#636366'
	};

	function getUserColor(username: string): string {
		let hash = 0;
		for (let i = 0; i < username.length; i++) {
			hash = username.charCodeAt(i) + ((hash << 5) - hash);
		}
		return avatarColors[Math.abs(hash) % avatarColors.length];
	}

	function getInitials(username: string): string {
		return username.slice(0, 2).toUpperCase();
	}

	function getTopRoleColor(member: ServerMember): string | null {
		if (!member.roles || member.roles.length === 0) return null;
		const sorted = [...member.roles].sort((a, b) => b.position - a.position);
		return sorted[0].color ?? null;
	}

	function getTopRoles(member: ServerMember): import('$lib/types').Role[] {
		if (!member.roles || member.roles.length === 0) return [];
		return [...member.roles]
			.filter(r => r.position > 0)
			.sort((a, b) => b.position - a.position)
			.slice(0, 2);
	}

	function handleMemberClick(member: ServerMember, e: MouseEvent) {
		if (selectedMemberId === member.user_id) {
			selectedMemberId = null;
			return;
		}
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		// Position card vertically centered on the clicked member, clamped to viewport
		cardY = Math.max(52, Math.min(rect.top, window.innerHeight - 360));
		selectedMemberId = member.user_id;
	}

	function closeCard() {
		selectedMemberId = null;
		showAddRole = false;
	}

	function handleCardClickOutside(e: MouseEvent) {
		if (cardEl && !cardEl.contains(e.target as Node)) {
			closeCard();
		}
	}

	function handleCardKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeCard();
	}

	$effect(() => {
		if (!selectedMember) return;
		document.addEventListener('mousedown', handleCardClickOutside);
		document.addEventListener('keydown', handleCardKeydown);
		return () => {
			document.removeEventListener('mousedown', handleCardClickOutside);
			document.removeEventListener('keydown', handleCardKeydown);
		};
	});

	// Role management state
	let showAddRole = $state(false);
	let serverRoles: Role[] = $state([]);
	let loadingRoles = $state(false);

	async function openAddRoleDropdown() {
		showAddRole = true;
		if (serverRoles.length === 0) {
			const serverId = serversStore.activeServerId;
			if (!serverId) return;
			loadingRoles = true;
			try {
				serverRoles = await getRoles(serverId);
			} catch {
				serverRoles = [];
			} finally {
				loadingRoles = false;
			}
		}
	}

	function getAssignableRoles(member: ServerMember): Role[] {
		const memberRoleIds = new Set(member.roles?.map((r) => r.id) ?? []);
		return serverRoles.filter((r) => r.position > 0 && !memberRoleIds.has(r.id));
	}

	async function handleAssign(userId: string, roleId: string) {
		await onassignrole?.(userId, roleId);
		showAddRole = false;
		// Refresh roles cache
		const serverId = serversStore.activeServerId;
		if (serverId) {
			try { serverRoles = await getRoles(serverId); } catch { /* noop */ }
		}
	}

	async function handleRemove(userId: string, roleId: string) {
		await onremoverole?.(userId, roleId);
	}

	let ownerId = $derived(serversStore.activeServer?.owner_id ?? null);

	function getMemberDisplayName(m: ServerMember): string {
		return (m.nickname ?? m.user?.username ?? 'Unknown').toLowerCase();
	}

	function getHighestPosition(m: ServerMember): number {
		if (!m.roles || m.roles.length === 0) return 0;
		return Math.max(...m.roles.map((r) => r.position));
	}

	interface RoleGroup {
		name: string;
		color: string | null;
		position: number;
		online: ServerMember[];
		offline: ServerMember[];
	}

	let roleGroups = $derived.by((): RoleGroup[] => {
		// Build a map of role position -> { name, color, online[], offline[] }
		const groupMap = new Map<number, RoleGroup>();

		for (const member of members) {
			const isOnline = presenceStore.getStatus(member.user_id) !== 'offline';
			const highestPos = getHighestPosition(member);

			// Find the actual role info for the highest position
			let roleName = 'Online';
			let roleColor: string | null = null;
			if (highestPos > 0 && member.roles) {
				const topRole = member.roles.find((r) => r.position === highestPos);
				if (topRole) {
					roleName = topRole.name;
					roleColor = topRole.color;
				}
			}

			if (!groupMap.has(highestPos)) {
				groupMap.set(highestPos, {
					name: highestPos === 0 ? 'Online' : roleName,
					color: roleColor,
					position: highestPos,
					online: [],
					offline: []
				});
			}

			const group = groupMap.get(highestPos)!;
			if (isOnline) {
				group.online.push(member);
			} else {
				group.offline.push(member);
			}
		}

		// Sort groups by position descending (highest role first)
		const groups = [...groupMap.values()].sort((a, b) => b.position - a.position);

		// Sort members alphabetically within each group
		for (const group of groups) {
			group.online.sort((a, b) => getMemberDisplayName(a).localeCompare(getMemberDisplayName(b)));
			group.offline.sort((a, b) => getMemberDisplayName(a).localeCompare(getMemberDisplayName(b)));
		}

		return groups;
	});

	// Collect all offline members across groups for the single "Offline" section
	let allOffline = $derived.by(() => {
		const offline: ServerMember[] = [];
		for (const group of roleGroups) {
			offline.push(...group.offline);
		}
		offline.sort((a, b) => getMemberDisplayName(a).localeCompare(getMemberDisplayName(b)));
		return offline;
	});

	// Count total online
	let totalOnline = $derived(roleGroups.reduce((sum, g) => sum + g.online.length, 0));
</script>

<aside class="members-sidebar">
	{#each roleGroups as group (group.position)}
		{#if group.online.length > 0}
			<div class="member-group" style:color={group.color ?? undefined}>
				{group.name} — {group.online.length}
			</div>
			{#each group.online as member (member.user_id)}
				{@const username = member.nickname ?? member.user?.username ?? 'Unknown'}
				{@const status = presenceStore.getStatus(member.user_id)}
				{@const roleColor = getTopRoleColor(member)}
				{@const topRoles = getTopRoles(member)}
				<button class="member-item" class:selected={selectedMember?.user_id === member.user_id} onclick={(e) => handleMemberClick(member, e)}>
					<div class="member-avatar-container">
						<div class="member-avatar" style:background-color={getUserColor(username)}>
							{#if member.user?.avatar_url}
								<img src={member.user.avatar_url} alt={username} class="member-avatar-img" />
							{:else}
								{getInitials(username)}
							{/if}
						</div>
						<span class="status-dot" style:background-color={statusColors[status]}></span>
					</div>
					<div class="member-info">
						<span class="member-name" style:color={roleColor ?? 'inherit'}>
							{username}
							{#if member.user_id === ownerId}
								<Crown size={14} color="#FF9F0A" style="display:inline;vertical-align:middle;margin-left:4px;" />
							{/if}
						</span>
						{#if topRoles.length > 0}
							<div class="member-roles">
								{#each topRoles as role (role.id)}
									<span class="role-badge" style:border-color={role.color ?? 'rgba(255,255,255,0.15)'}>
										{#if role.color}<span class="role-dot" style:background={role.color}></span>{/if}
										{role.name}
									</span>
								{/each}
							</div>
						{/if}
					</div>
					{#if member.user?.username?.toLowerCase().includes('bot')}
						<span class="bot-tag">BOT</span>
					{/if}
				</button>
			{/each}
		{/if}
	{/each}

	{#if allOffline.length > 0}
		<div class="member-group" style:margin-top={totalOnline > 0 ? '20px' : '0'}>
			Offline — {allOffline.length}
		</div>
		{#each allOffline as member (member.user_id)}
			{@const username = member.nickname ?? member.user?.username ?? 'Unknown'}
			{@const status = presenceStore.getStatus(member.user_id)}
			{@const roleColor = getTopRoleColor(member)}
			{@const topRoles = getTopRoles(member)}
			<button class="member-item offline" onclick={(e) => handleMemberClick(member, e)}>
				<div class="member-avatar-container">
					<div class="member-avatar" style:background-color={getUserColor(username)}>
						{#if member.user?.avatar_url}
							<img src={member.user.avatar_url} alt={username} class="member-avatar-img" />
						{:else}
							{getInitials(username)}
						{/if}
					</div>
					<span class="status-dot" style:background-color={statusColors[status]}></span>
				</div>
				<div class="member-info">
					<span class="member-name" style:color={roleColor ?? 'inherit'}>
						{username}
						{#if member.user_id === ownerId}
							<Crown size={14} color="#FF9F0A" style="display:inline;vertical-align:middle;margin-left:4px;" />
						{/if}
					</span>
					{#if topRoles.length > 0}
						<div class="member-roles">
							{#each topRoles as role (role.id)}
								<span class="role-badge" style:border-color={role.color ?? 'rgba(255,255,255,0.15)'}>
									{#if role.color}<span class="role-dot" style:background={role.color}></span>{/if}
									{role.name}
								</span>
							{/each}
						</div>
					{/if}
				</div>
				{#if member.user?.username?.toLowerCase().includes('bot')}
					<span class="bot-tag">BOT</span>
				{/if}
			</button>
		{/each}
	{/if}
</aside>

{#if selectedMember}
	{@const sm = selectedMember}
	{@const smUsername = sm.nickname ?? sm.user?.username ?? 'Unknown'}
	{@const smStatus = presenceStore.getStatus(sm.user_id)}
	<div class="member-card" style:top="{cardY}px" bind:this={cardEl} role="dialog" aria-label="Member profile">
		<div class="card-cover">
			{#if sm.user?.cover_url}
				<img src={sm.user.cover_url} alt="" class="card-cover-img" />
			{/if}
		</div>
		<div class="card-avatar-wrapper">
			<div class="card-avatar" style:background-color={getUserColor(smUsername)}>
				{#if sm.user?.avatar_url}
					<img src={sm.user.avatar_url} alt={smUsername} class="card-avatar-img" />
				{:else}
					{getInitials(smUsername)}
				{/if}
			</div>
			<span class="card-status-dot" style:background-color={statusColors[smStatus]}></span>
		</div>
		<div class="card-body">
			<div class="card-username">{smUsername}<span class="card-discrim">#{sm.user?.discriminator ?? '0000'}</span></div>
			{#if sm.user?.status && sm.user.status !== 'online' && sm.user.status !== 'offline' && sm.user.status !== 'idle' && sm.user.status !== 'dnd'}
				<div class="card-custom-status">{sm.user.status}</div>
			{/if}
			<div class="card-divider"></div>
			<div class="card-section-label">Member Since</div>
			<div class="card-date">{new Date(sm.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
			{#if (sm.roles && sm.roles.length > 0) || canmanageroles}
				<div class="card-divider"></div>
				<div class="card-section-label">Roles</div>
				<div class="card-roles">
					{#if sm.roles}
						{#each sm.roles as role (role.id)}
							<span class="card-role" style:border-color={role.color ?? 'rgba(255,255,255,0.15)'}>
								{#if role.color}<span class="role-dot" style:background={role.color}></span>{/if}
								{role.name}
								{#if canmanageroles && role.position > 0}
									<button
										class="card-role-remove"
										onclick={() => handleRemove(sm.user_id, role.id)}
										aria-label="Remove role {role.name}"
									>
										<X size={10} />
									</button>
								{/if}
							</span>
						{/each}
					{/if}
					{#if canmanageroles}
						<div class="card-add-role-wrapper">
							<button class="card-add-role-btn" onclick={openAddRoleDropdown} aria-label="Add role">
								<Plus size={12} />
							</button>
							{#if showAddRole}
								{@const assignable = getAssignableRoles(sm)}
								<div class="card-role-dropdown">
									{#if loadingRoles}
										<div class="card-dropdown-empty">Loading...</div>
									{:else if assignable.length === 0}
										<div class="card-dropdown-empty">No roles to add</div>
									{:else}
										{#each assignable as role (role.id)}
											<button
												class="card-dropdown-item"
												onclick={() => handleAssign(sm.user_id, role.id)}
											>
												<span class="role-dot" style:background={role.color ?? 'rgba(255,255,255,0.3)'}></span>
												{role.name}
											</button>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
			{#if sm.user_id === ownerId}
				<div class="card-owner-badge">
					<Crown size={12} color="#FF9F0A" />
					<span>Server Owner</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.members-sidebar {
		width: 240px;
		background: rgba(0, 0, 0, 0.05);
		border-left: 1px solid rgba(255, 255, 255, 0.08);
		padding: 24px 16px;
		overflow-y: auto;
	}

	.member-group {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: rgba(235, 235, 245, 0.6);
		margin-bottom: 12px;
		letter-spacing: 0.5px;
	}

	.member-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 8px;
		border-radius: 6px;
		margin-bottom: 4px;
		cursor: pointer;
		opacity: 0.8;
		transition: opacity 0.2s, background 0.15s;
		width: 100%;
		background: none;
		border: none;
		color: inherit;
		font-family: inherit;
		font-size: inherit;
		text-align: left;
	}

	.member-item.selected {
		opacity: 1;
		background: rgba(88, 101, 242, 0.2);
	}

	.member-item:hover {
		opacity: 1;
		background: var(--bg-glass-lighter, rgba(58, 58, 60, 0.3));
	}

	.member-item.offline {
		opacity: 0.4;
	}

	.member-item.offline:hover {
		opacity: 0.6;
	}

	.member-avatar-container {
		position: relative;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
	}

	.member-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		font-weight: 600;
		color: white;
		overflow: hidden;
	}

	.member-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.member-name {
		font-size: 14px;
		font-weight: 500;
		display: flex;
		align-items: center;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status-dot {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 12px;
		height: 12px;
		border: 2px solid var(--bg-glass-heavy, rgba(28, 28, 30, 0.65));
		border-radius: 50%;
	}

	.bot-tag {
		background: #5865f2;
		font-size: 9px;
		padding: 1px 4px;
		border-radius: 4px;
		margin-left: 6px;
		color: white;
		flex-shrink: 0;
	}

	/* Member profile card */
	.member-card {
		position: fixed;
		right: 256px;
		width: 300px;
		background: rgba(30, 30, 30, 0.92);
		backdrop-filter: blur(40px);
		-webkit-backdrop-filter: blur(40px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
		overflow: hidden;
		z-index: 1000;
		animation: card-in 0.15s cubic-bezier(0.2, 0, 0, 1);
	}

	@keyframes card-in {
		from { opacity: 0; transform: translateX(8px) scale(0.97); }
		to { opacity: 1; transform: translateX(0) scale(1); }
	}

	.card-cover {
		width: 100%;
		height: 90px;
		background: linear-gradient(135deg, #2c1e4a, #1a2a40);
		overflow: hidden;
	}

	.card-cover-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card-avatar-wrapper {
		position: relative;
		width: 64px;
		height: 64px;
		margin-top: -32px;
		margin-left: 16px;
	}

	.card-avatar {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		border: 4px solid rgba(30, 30, 30, 0.92);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
		font-weight: 700;
		color: white;
		overflow: hidden;
	}

	.card-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card-status-dot {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 14px;
		height: 14px;
		border: 3px solid rgba(30, 30, 30, 0.92);
		border-radius: 50%;
	}

	.card-body {
		padding: 8px 16px 16px;
	}

	.card-username {
		font-size: 18px;
		font-weight: 700;
		color: #fff;
	}

	.card-discrim {
		font-weight: 400;
		color: rgba(235, 235, 245, 0.3);
	}

	.card-custom-status {
		font-size: 13px;
		color: rgba(235, 235, 245, 0.5);
		margin-top: 2px;
	}

	.card-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.08);
		margin: 10px 0;
	}

	.card-section-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: rgba(235, 235, 245, 0.4);
		letter-spacing: 0.5px;
		margin-bottom: 4px;
	}

	.card-date {
		font-size: 13px;
		color: rgba(235, 235, 245, 0.7);
	}

	.card-roles {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.card-role {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 4px;
		font-size: 12px;
		color: rgba(235, 235, 245, 0.8);
	}

	.card-role-remove {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: rgba(235, 235, 245, 0.3);
		cursor: pointer;
		padding: 0;
		margin-left: 2px;
		transition: color 0.15s ease;
		line-height: 1;
	}

	.card-role-remove:hover {
		color: #ff453a;
	}

	.card-add-role-wrapper {
		position: relative;
	}

	.card-add-role-btn {
		width: 22px;
		height: 22px;
		border-radius: 4px;
		border: 1px dashed rgba(255, 255, 255, 0.2);
		background: transparent;
		color: rgba(235, 235, 245, 0.4);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
	}

	.card-add-role-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.8);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.card-role-dropdown {
		position: absolute;
		bottom: 100%;
		left: 0;
		margin-bottom: 4px;
		min-width: 160px;
		background: rgba(40, 40, 40, 0.95);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		padding: 4px;
		z-index: 30;
		animation: dropdown-in 0.12s ease;
	}

	@keyframes dropdown-in {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.card-dropdown-empty {
		padding: 8px 12px;
		font-size: 12px;
		color: rgba(235, 235, 245, 0.4);
	}

	.card-dropdown-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 10px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: rgba(235, 235, 245, 0.8);
		font-size: 13px;
		font-family: inherit;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s ease;
	}

	.card-dropdown-item:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.role-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.card-owner-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 10px;
		font-size: 12px;
		font-weight: 600;
		color: #FF9F0A;
	}

	.member-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 2px;
		flex: 1;
	}

	.member-roles {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}

	.role-badge {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 0px 5px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 3px;
		font-size: 9px;
		color: rgba(235, 235, 245, 0.6);
		white-space: nowrap;
		line-height: 1.4;
	}

	.role-badge .role-dot {
		width: 6px;
		height: 6px;
	}
</style>
