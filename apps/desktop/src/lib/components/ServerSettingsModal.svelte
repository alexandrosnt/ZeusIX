<script lang="ts">
	import { X } from 'lucide-svelte';
	import { PERMISSIONS } from '$lib/utils/permissions';
	import { getRoles } from '$lib/services/api';
	import type { Role, ServerMember } from '$lib/types';

	interface Props {
		server: { id: string; name: string; owner_id: string; is_public: boolean };
		members: ServerMember[];
		onclose: () => void;
		onupdateserver: (data: { name?: string; is_public?: boolean }) => Promise<void>;
		oncreaterole: (name: string, color?: string, permissions?: number) => Promise<void>;
		onupdaterole: (roleId: string, data: { name?: string; color?: string; permissions?: number }) => Promise<void>;
		ondeleterole: (roleId: string) => Promise<void>;
		onreorderroles: (roles: { id: string; position: number }[]) => Promise<void>;
		onassignrole: (userId: string, roleId: string) => Promise<void>;
		onremoverole: (userId: string, roleId: string) => Promise<void>;
	}

	let {
		server,
		members,
		onclose,
		onupdateserver,
		oncreaterole,
		onupdaterole,
		ondeleterole,
		onreorderroles,
		onassignrole,
		onremoverole
	}: Props = $props();

	// --- Shared State ---
	let visible = $state(false);
	type Tab = 'overview' | 'roles' | 'members';
	let activeTab: Tab = $state('overview');
	let roles: Role[] = $state([]);
	let saving = $state(false);

	// --- Overview Tab State ---
	let editName = $state('');
	let editPublic = $state(false);
	let overviewInitialized = false;
	let overviewHasChanges = $derived(editName !== server.name || editPublic !== server.is_public);

	$effect(() => {
		if (!overviewInitialized) {
			overviewInitialized = true;
			editName = server.name;
			editPublic = server.is_public;
		}
	});

	// --- Roles Tab State ---
	let selectedRoleId: string | null = $state(null);
	let roleEditName = $state('');
	let roleEditColor: string | null = $state(null);
	let roleEditPermissions = $state(0);
	let creatingRole = $state(false);

	const COLOR_SWATCHES = [
		'#F47067', '#E0AF68', '#73DACA', '#7AA2F7',
		'#BB9AF7', '#FF9E64', '#2AC3DE', '#9ECE6A',
		'#30D158', '#FF453A', '#0A84FF', '#BF5AF2'
	];

	const PERMISSION_LABELS: { key: string; bit: number; label: string }[] = [
		{ key: 'ADMIN', bit: PERMISSIONS.ADMIN, label: 'Admin' },
		{ key: 'MANAGE_SERVER', bit: PERMISSIONS.MANAGE_SERVER, label: 'Manage Server' },
		{ key: 'MANAGE_CHANNELS', bit: PERMISSIONS.MANAGE_CHANNELS, label: 'Manage Channels' },
		{ key: 'MANAGE_MESSAGES', bit: PERMISSIONS.MANAGE_MESSAGES, label: 'Manage Messages' },
		{ key: 'SEND_MESSAGES', bit: PERMISSIONS.SEND_MESSAGES, label: 'Send Messages' },
		{ key: 'READ_MESSAGES', bit: PERMISSIONS.READ_MESSAGES, label: 'Read Messages' },
		{ key: 'CONNECT_VOICE', bit: PERMISSIONS.CONNECT_VOICE, label: 'Connect Voice' },
		{ key: 'SPEAK', bit: PERMISSIONS.SPEAK, label: 'Speak' },
		{ key: 'CREATE_INVITE', bit: PERMISSIONS.CREATE_INVITE, label: 'Create Invite' }
	];

	let sortedRoles = $derived([...roles].sort((a, b) => b.position - a.position));
	// Draggable roles: only position > 0 (excludes @everyone)
	let draggableRoles = $derived(sortedRoles.filter((r) => r.position > 0));
	let everyoneRole = $derived(sortedRoles.find((r) => r.position === 0) ?? null);

	let selectedRole = $derived(roles.find((r) => r.id === selectedRoleId) ?? null);
	let isEveryone = $derived(selectedRole?.position === 0);

	// --- Drag-to-Reorder State ---
	// Local mutable copy used during drag so Svelte can re-render the list order
	let localRoles: Role[] = $state([]);
	let isDragging = $state(false);
	let dragPending = false; // pointer is down but hasn't moved past threshold yet
	let dragIdx = $state<number>(-1);
	let pointerStartY = 0;
	let itemRects: DOMRect[] = [];
	let dragTranslateY = $state(0);
	const DRAG_THRESHOLD = 4; // px of movement before drag activates
	// Track which items have shifted: Map<index, direction*height>
	let itemShifts: Map<number, number> = $state(new Map());
	let roleListEl: HTMLDivElement | undefined = $state();

	// Sync local copy from derived when NOT dragging
	$effect(() => {
		if (!isDragging) {
			localRoles = [...draggableRoles];
		}
	});

	// --- Members Tab State ---
	let addRoleOpenForUser: string | null = $state(null);

	const avatarColors = [
		'#F47067', '#E0AF68', '#73DACA', '#7AA2F7',
		'#BB9AF7', '#FF9E64', '#2AC3DE', '#9ECE6A',
		'#E06C75', '#C678DD', '#56B6C2', '#D19A66'
	];

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

	// --- Entrance Animation ---
	$effect(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	// --- Fetch Roles on Mount ---
	$effect(() => {
		fetchRoles();
	});

	async function fetchRoles() {
		try {
			roles = await getRoles(server.id);
		} catch {
			roles = [];
		}
	}

	// --- Role Selection ---
	function selectRole(role: Role) {
		selectedRoleId = role.id;
		roleEditName = role.name;
		roleEditColor = role.color;
		roleEditPermissions = role.permissions;
	}

	function hasPermBit(perms: number, bit: number): boolean {
		return (perms & bit) === bit;
	}

	function togglePermBit(bit: number) {
		if (hasPermBit(roleEditPermissions, bit)) {
			roleEditPermissions = roleEditPermissions & ~bit;
		} else {
			roleEditPermissions = roleEditPermissions | bit;
		}
	}

	// --- Drag-to-Reorder Handlers (PointerEvent-based) ---
	function handleDragPointerDown(e: PointerEvent, index: number) {
		// Any mouse button except left → ignore
		if (e.button !== 0) return;

		e.preventDefault();

		// Enter "pending" state — we don't commit to dragging until the
		// pointer moves past DRAG_THRESHOLD.  This lets plain clicks through.
		dragPending = true;
		dragIdx = index;
		pointerStartY = e.clientY;
		dragTranslateY = 0;
		itemShifts = new Map();

		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function activateDrag() {
		// Snapshot item rects at the moment dragging actually begins
		const items = roleListEl?.querySelectorAll<HTMLElement>('.role-list-item:not(.everyone)');
		if (!items || items.length === 0) return;
		itemRects = Array.from(items).map((el) => el.getBoundingClientRect());

		isDragging = true;
		dragPending = false;
		document.body.style.userSelect = 'none';
	}

	function handleDragPointerMove(e: PointerEvent) {
		if (dragIdx < 0) return;

		const offsetY = e.clientY - pointerStartY;

		// Still in pending state — check if we passed threshold
		if (dragPending) {
			if (Math.abs(offsetY) < DRAG_THRESHOLD) return;
			activateDrag();
		}

		if (!isDragging) return;

		dragTranslateY = offsetY;

		// Where the dragged item's center currently sits
		const draggedRect = itemRects[dragIdx];
		if (!draggedRect) return;
		const draggedCenterY = draggedRect.top + draggedRect.height / 2 + offsetY;
		const itemH = draggedRect.height + 2; // height + gap

		const newShifts = new Map<number, number>();

		for (let i = 0; i < localRoles.length; i++) {
			if (i === dragIdx) continue;

			const rect = itemRects[i];
			if (!rect) continue;
			const midY = rect.top + rect.height / 2;

			if (dragIdx < i && draggedCenterY > midY) {
				newShifts.set(i, -itemH);
			} else if (dragIdx > i && draggedCenterY < midY) {
				newShifts.set(i, itemH);
			}
		}

		itemShifts = newShifts;
	}

	async function handleDragPointerUp() {
		// If still pending (no threshold crossed) → treat as a click
		if (dragPending) {
			const clickedRole = localRoles[dragIdx];
			dragPending = false;
			dragIdx = -1;
			if (clickedRole) selectRole(clickedRole);
			return;
		}

		if (!isDragging || dragIdx < 0) return;

		// Calculate final drop index from item shifts
		let dropIdx = dragIdx;
		let shiftedAbove = 0;
		let shiftedBelow = 0;

		for (const [i, shift] of itemShifts) {
			if (i < dragIdx && shift > 0) shiftedAbove++;
			if (i > dragIdx && shift < 0) shiftedBelow++;
		}

		if (shiftedBelow > 0) {
			dropIdx = dragIdx + shiftedBelow;
		} else if (shiftedAbove > 0) {
			dropIdx = dragIdx - shiftedAbove;
		}

		// Clean up
		const fromIdx = dragIdx;
		isDragging = false;
		dragIdx = -1;
		dragTranslateY = 0;
		itemShifts = new Map();
		document.body.style.userSelect = '';

		if (fromIdx === dropIdx) return;

		// Reorder locally
		const reordered = [...localRoles];
		const [moved] = reordered.splice(fromIdx, 1);
		reordered.splice(dropIdx, 0, moved);
		localRoles = reordered;

		// Persist new positions: top of list (index 0) = highest position, descending
		const positions = reordered.map((role, i) => ({
			id: role.id,
			position: reordered.length - i
		}));

		try {
			await onreorderroles(positions);
			await fetchRoles();
		} catch {
			await fetchRoles();
		}
	}

	// --- Handlers ---
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	async function handleSaveOverview() {
		if (!overviewHasChanges || saving) return;
		saving = true;
		try {
			await onupdateserver({ name: editName.trim(), is_public: editPublic });
		} finally {
			saving = false;
		}
	}

	async function handleCreateRole() {
		if (creatingRole) return;
		creatingRole = true;
		try {
			await oncreaterole('New Role', undefined, 0);
			await fetchRoles();
		} finally {
			creatingRole = false;
		}
	}

	async function handleSaveRole() {
		if (!selectedRole || saving) return;
		saving = true;
		try {
			await onupdaterole(selectedRole.id, {
				name: roleEditName,
				color: roleEditColor ?? undefined,
				permissions: roleEditPermissions
			});
			await fetchRoles();
		} finally {
			saving = false;
		}
	}

	async function handleDeleteRole() {
		if (!selectedRole || isEveryone || saving) return;
		saving = true;
		try {
			await ondeleterole(selectedRole.id);
			selectedRoleId = null;
			await fetchRoles();
		} finally {
			saving = false;
		}
	}

	async function handleAssignRole(userId: string, roleId: string) {
		await onassignrole(userId, roleId);
		addRoleOpenForUser = null;
	}

	async function handleRemoveRole(userId: string, roleId: string) {
		await onremoverole(userId, roleId);
	}

	function getAssignableRoles(member: ServerMember): Role[] {
		const memberRoleIds = new Set(member.roles?.map((r) => r.id) ?? []);
		return roles.filter((r) => r.position > 0 && !memberRoleIds.has(r.id));
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" class:visible role="presentation">
	<div class="modal" class:visible role="dialog" aria-modal="true" aria-labelledby="settings-title">
		<!-- Close Button -->
		<button class="close-btn" onclick={onclose} aria-label="Close settings">
			<X size={18} />
		</button>

		<div class="layout">
			<!-- Sidebar -->
			<nav class="sidebar">
				<h2 id="settings-title" class="sidebar-title">{server.name}</h2>
				<span class="sidebar-subtitle">Server Settings</span>

				<div class="sidebar-tabs">
					<button
						class="tab-item"
						class:active={activeTab === 'overview'}
						onclick={() => (activeTab = 'overview')}
					>
						Overview
					</button>
					<button
						class="tab-item"
						class:active={activeTab === 'roles'}
						onclick={() => (activeTab = 'roles')}
					>
						Roles
					</button>
					<button
						class="tab-item"
						class:active={activeTab === 'members'}
						onclick={() => (activeTab = 'members')}
					>
						Members
					</button>
				</div>
			</nav>

			<!-- Content -->
			<div class="content">
				{#if activeTab === 'overview'}
					<!-- OVERVIEW TAB -->
					<div class="content-header">
						<h3 class="content-title">Overview</h3>
					</div>

					<div class="content-body">
						<div class="input-group">
							<label for="server-name-input">Server Name</label>
							<input
								id="server-name-input"
								type="text"
								bind:value={editName}
								autocomplete="off"
								spellcheck="false"
							/>
						</div>

						<div class="toggle-group">
							<div class="toggle-info">
								<span class="toggle-label">Public Server</span>
								<span class="toggle-description">Anyone can find and join this server</span>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={editPublic}
								aria-label="Toggle public server"
								class="toggle"
								class:active={editPublic}
								onclick={() => (editPublic = !editPublic)}
							>
								<span class="toggle-knob"></span>
							</button>
						</div>

						<div class="actions-bar">
							<button
								class="btn btn-primary"
								disabled={!overviewHasChanges || saving}
								onclick={handleSaveOverview}
							>
								{#if saving}
									<span class="spinner"></span>
									Saving...
								{:else}
									Save Changes
								{/if}
							</button>
						</div>
					</div>
				{:else if activeTab === 'roles'}
					<!-- ROLES TAB -->
					<div class="content-header">
						<h3 class="content-title">Roles</h3>
					</div>

					<div class="content-body roles-layout">
						<!-- Role List -->
						<div class="role-list" bind:this={roleListEl}>
							{#each localRoles as role, i (role.id)}
								{@const isBeingDragged = isDragging && dragIdx === i}
								{@const shiftY = isDragging && dragIdx !== i ? (itemShifts.get(i) ?? 0) : 0}
								<button
									class="role-list-item draggable"
									class:selected={selectedRoleId === role.id}
									class:is-dragging={isBeingDragged}
									style:transform={isBeingDragged ? `translateY(${dragTranslateY}px)` : shiftY !== 0 ? `translateY(${shiftY}px)` : ''}
									style:z-index={isBeingDragged ? '10' : ''}
									style:transition={isBeingDragged ? 'none' : isDragging ? 'transform 0.2s ease' : ''}
									onpointerdown={(e) => handleDragPointerDown(e, i)}
									onpointermove={handleDragPointerMove}
									onpointerup={handleDragPointerUp}
								>
									<span class="drag-handle" aria-hidden="true">⠿</span>
									<span
										class="role-color-dot"
										style:background={role.color ?? 'rgba(255,255,255,0.3)'}
									></span>
									<span class="role-item-name">{role.name}</span>
								</button>
							{/each}

							{#if everyoneRole}
								<button
									class="role-list-item everyone"
									class:selected={selectedRoleId === everyoneRole.id}
									onclick={() => selectRole(everyoneRole)}
								>
									<span
										class="role-color-dot"
										style:background={everyoneRole.color ?? 'rgba(255,255,255,0.3)'}
									></span>
									<span class="role-item-name">{everyoneRole.name}</span>
								</button>
							{/if}

							<button class="btn btn-create-role" onclick={handleCreateRole} disabled={creatingRole}>
								{#if creatingRole}
									<span class="spinner small"></span>
								{:else}
									+ Create Role
								{/if}
							</button>
						</div>

						<!-- Role Edit Panel -->
						{#if selectedRole}
							<div class="role-edit-panel">
								<div class="input-group">
									<label for="role-name-input">Role Name</label>
									<input
										id="role-name-input"
										type="text"
										bind:value={roleEditName}
										disabled={isEveryone}
										autocomplete="off"
										spellcheck="false"
									/>
								</div>

								<div class="field-group">
									<span class="field-label">Color</span>
									<div class="color-swatches">
										{#each COLOR_SWATCHES as color (color)}
											<button
												class="color-swatch"
												class:selected={roleEditColor === color}
												style:background={color}
												onclick={() => (roleEditColor = color)}
												aria-label="Select color {color}"
											></button>
										{/each}
									</div>
								</div>

								<div class="field-group">
									<span class="field-label">Permissions</span>
									<div class="permissions-list">
										{#each PERMISSION_LABELS as perm (perm.key)}
											<label class="perm-checkbox">
												<input
													type="checkbox"
													checked={hasPermBit(roleEditPermissions, perm.bit)}
													onchange={() => togglePermBit(perm.bit)}
												/>
												<span class="perm-check-visual"></span>
												<span class="perm-label-text">{perm.label}</span>
											</label>
										{/each}
									</div>
								</div>

								<div class="role-actions">
									<button class="btn btn-primary" onclick={handleSaveRole} disabled={saving}>
										{#if saving}
											<span class="spinner small"></span>
											Saving...
										{:else}
											Save
										{/if}
									</button>
									<button
										class="btn btn-danger"
										onclick={handleDeleteRole}
										disabled={isEveryone || saving}
									>
										Delete
									</button>
								</div>
							</div>
						{:else}
							<div class="role-edit-placeholder">
								<p>Select a role to edit its settings</p>
							</div>
						{/if}
					</div>
				{:else if activeTab === 'members'}
					<!-- MEMBERS TAB -->
					<div class="content-header">
						<h3 class="content-title">Members &mdash; {members.length}</h3>
					</div>

					<div class="content-body members-list">
						{#each members as member (member.user_id)}
							{@const username = member.nickname ?? member.user?.username ?? 'Unknown'}
							<div class="member-row">
								<div class="member-info">
									<div class="member-avatar" style:background-color={getUserColor(username)}>
										{#if member.user?.avatar_url}
											<img src={member.user.avatar_url} alt={username} class="member-avatar-img" />
										{:else}
											{getInitials(username)}
										{/if}
									</div>
									<div class="member-text">
										<span class="member-name">{username}</span>
										{#if member.user?.discriminator}
											<span class="member-discrim">#{member.user.discriminator}</span>
										{/if}
									</div>
								</div>

								<div class="member-roles">
									{#if member.roles && member.roles.length > 0}
										{#each member.roles as role (role.id)}
											{#if role.position > 0}
												<span
													class="role-badge"
													style:border-color={role.color ?? 'rgba(255,255,255,0.15)'}
												>
													{#if role.color}
														<span class="role-badge-dot" style:background={role.color}></span>
													{/if}
													{role.name}
													<button
														class="role-badge-remove"
														onclick={() => handleRemoveRole(member.user_id, role.id)}
														aria-label="Remove role {role.name}"
													>
														&times;
													</button>
												</span>
											{/if}
										{/each}
									{/if}

									<div class="add-role-wrapper">
										<button
											class="btn-add-role"
											onclick={() =>
												(addRoleOpenForUser =
													addRoleOpenForUser === member.user_id ? null : member.user_id)}
										>
											+
										</button>

										{#if addRoleOpenForUser === member.user_id}
											{@const assignable = getAssignableRoles(member)}
											<div class="add-role-dropdown">
												{#if assignable.length === 0}
													<div class="dropdown-empty">No roles available</div>
												{:else}
													{#each assignable as role (role.id)}
														<button
															class="dropdown-role-item"
															onclick={() => handleAssignRole(member.user_id, role.id)}
														>
															<span
																class="role-color-dot small"
																style:background={role.color ?? 'rgba(255,255,255,0.3)'}
															></span>
															{role.name}
														</button>
													{/each}
												{/if}
											</div>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	/* ===== Overlay & Modal ===== */
	.overlay {
		position: fixed;
		top: 32px;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(20, 20, 22, 0.97);
		display: flex;
		z-index: 1000;
		opacity: 0;
		transition: opacity 0.2s ease;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica,
			sans-serif;
	}

	.overlay.visible {
		opacity: 1;
	}

	.modal {
		position: relative;
		width: 100%;
		height: 100%;
		background: transparent;
		backdrop-filter: none;
		border: none;
		border-radius: 0;
		box-shadow: none;
		padding: 0;
		overflow: hidden;
		opacity: 0;
		transform: translateY(8px);
		transition:
			transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
			opacity 0.2s ease;
	}

	.modal.visible {
		transform: translateY(0);
		opacity: 1;
	}

	/* ===== Close Button ===== */
	.close-btn {
		position: absolute;
		top: 20px;
		right: 20px;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.2);
		background: transparent;
		color: rgba(255, 255, 255, 0.5);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			border-color 0.15s ease;
		z-index: 10;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.9);
		border-color: rgba(255, 255, 255, 0.4);
	}

	/* ===== Two-Column Layout ===== */
	.layout {
		display: flex;
		height: 100%;
	}

	/* ===== Sidebar ===== */
	.sidebar {
		width: 240px;
		min-width: 240px;
		padding: 40px 20px;
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: rgba(0, 0, 0, 0.15);
	}

	.sidebar-title {
		font-size: 15px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sidebar-subtitle {
		font-size: 11px;
		font-weight: 600;
		color: rgba(235, 235, 245, 0.4);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 16px;
	}

	.sidebar-tabs {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.tab-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 8px 12px;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: rgba(235, 235, 245, 0.6);
		font-size: 14px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}

	.tab-item:hover {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.9);
	}

	.tab-item.active {
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.15);
		color: var(--accent-blue, #0a84ff);
	}

	/* ===== Content Area ===== */
	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.content-header {
		padding: 40px 40px 0;
	}

	.content-title {
		font-size: 20px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		margin: 0 0 20px;
	}

	.content-body {
		flex: 1;
		padding: 0 40px 40px;
		overflow-y: auto;
	}

	/* ===== Shared: Input Group ===== */
	.input-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	.input-group label {
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.input-group input {
		width: 100%;
		padding: 10px 14px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		color: rgba(255, 255, 255, 0.95);
		font-size: 14px;
		font-family: inherit;
		outline: none;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		box-sizing: border-box;
	}

	.input-group input::placeholder {
		color: rgba(255, 255, 255, 0.25);
	}

	.input-group input:focus {
		border-color: var(--accent-blue, #0a84ff);
		box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 10, 132, 255), 0.25);
	}

	.input-group input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ===== Shared: Toggle ===== */
	.toggle-group {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.06);
		margin-bottom: 16px;
	}

	.toggle-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.toggle-label {
		font-size: 15px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.9);
	}

	.toggle-description {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
	}

	.toggle {
		position: relative;
		width: 44px;
		height: 26px;
		background: rgba(120, 120, 128, 0.32);
		border-radius: 13px;
		border: none;
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
		transition: background 0.25s ease;
	}

	.toggle.active {
		background: #30d158;
	}

	.toggle-knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 20px;
		height: 20px;
		background: white;
		border-radius: 50%;
		transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.toggle.active .toggle-knob {
		transform: translateX(18px);
	}

	/* ===== Shared: Buttons ===== */
	.btn {
		padding: 8px 20px;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		border: none;
		transition: all 0.2s ease;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--accent-blue, #0a84ff);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-blue-hover, #2e96ff);
		box-shadow: 0 4px 16px rgba(var(--accent-rgb, 10, 132, 255), 0.4);
	}

	.btn-danger {
		background: rgba(255, 69, 58, 0.15);
		color: #ff453a;
	}

	.btn-danger:hover:not(:disabled) {
		background: rgba(255, 69, 58, 0.25);
	}

	.actions-bar {
		display: flex;
		justify-content: flex-end;
		padding-top: 8px;
	}

	/* ===== Spinner ===== */
	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	.spinner.small {
		width: 12px;
		height: 12px;
		border-width: 1.5px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ===== Roles Tab Layout ===== */
	.roles-layout {
		display: flex;
		gap: 16px;
		height: 100%;
		min-height: 0;
	}

	/* Role List */
	.role-list {
		width: 160px;
		min-width: 160px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
	}

	.role-list-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: rgba(235, 235, 245, 0.8);
		font-size: 13px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease;
		text-align: left;
		width: 100%;
	}

	.role-list-item:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.role-list-item.selected {
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.15);
		color: var(--accent-blue, #0a84ff);
	}

	.role-list-item.draggable {
		cursor: grab;
		touch-action: none;
	}

	.role-list-item.is-dragging {
		position: relative;
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.2);
		border: 1px solid rgba(var(--accent-rgb, 10, 132, 255), 0.4);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
		cursor: grabbing;
	}

	.role-list-item.everyone {
		opacity: 0.5;
		cursor: default;
		margin-top: 4px;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		padding-top: 12px;
	}

	.drag-handle {
		color: rgba(255, 255, 255, 0.2);
		cursor: grab;
		font-size: 11px;
		line-height: 1;
		flex-shrink: 0;
		user-select: none;
		touch-action: none;
		transition: color 0.15s ease;
	}

	.role-list-item:hover .drag-handle {
		color: rgba(255, 255, 255, 0.5);
	}

	.role-color-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.role-color-dot.small {
		width: 8px;
		height: 8px;
	}

	.role-item-name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.btn-create-role {
		margin-top: 8px;
		padding: 8px 10px;
		border-radius: 8px;
		border: 1px dashed rgba(255, 255, 255, 0.15);
		background: transparent;
		color: rgba(235, 235, 245, 0.5);
		font-size: 13px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			border-color 0.15s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}

	.btn-create-role:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.8);
		border-color: rgba(255, 255, 255, 0.25);
	}

	.btn-create-role:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Role Edit Panel */
	.role-edit-panel {
		flex: 1;
		overflow-y: auto;
		min-width: 0;
	}

	.role-edit-placeholder {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.role-edit-placeholder p {
		color: rgba(235, 235, 245, 0.3);
		font-size: 14px;
	}

	.field-group {
		margin-bottom: 16px;
	}

	.field-label {
		display: block;
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 8px;
	}

	/* Color Swatches */
	.color-swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.color-swatch {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			transform 0.15s ease;
		padding: 0;
	}

	.color-swatch:hover {
		transform: scale(1.15);
	}

	.color-swatch.selected {
		border-color: rgba(255, 255, 255, 0.9);
		transform: scale(1.1);
	}

	/* Permission Checkboxes */
	.permissions-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.perm-checkbox {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		padding: 4px 0;
	}

	.perm-checkbox input[type='checkbox'] {
		display: none;
	}

	.perm-check-visual {
		width: 18px;
		height: 18px;
		border-radius: 5px;
		border: 1.5px solid rgba(255, 255, 255, 0.2);
		background: rgba(0, 0, 0, 0.3);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.15s ease,
			border-color 0.15s ease;
	}

	.perm-checkbox input[type='checkbox']:checked + .perm-check-visual {
		background: var(--accent-blue, #0a84ff);
		border-color: var(--accent-blue, #0a84ff);
	}

	.perm-checkbox input[type='checkbox']:checked + .perm-check-visual::after {
		content: '';
		display: block;
		width: 5px;
		height: 9px;
		border: 2px solid white;
		border-top: none;
		border-left: none;
		transform: rotate(45deg) translateY(-1px);
	}

	.perm-label-text {
		font-size: 13px;
		color: rgba(235, 235, 245, 0.8);
	}

	.role-actions {
		display: flex;
		gap: 8px;
		margin-top: 16px;
	}

	/* ===== Members Tab ===== */
	.members-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.member-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		border-radius: 10px;
		transition: background 0.15s ease;
		gap: 12px;
	}

	.member-row:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.member-info {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		flex-shrink: 0;
	}

	.member-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 700;
		color: white;
		overflow: hidden;
		flex-shrink: 0;
	}

	.member-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.member-text {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.member-name {
		font-size: 14px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.95);
		white-space: nowrap;
	}

	.member-discrim {
		font-size: 12px;
		color: rgba(235, 235, 245, 0.3);
	}

	.member-roles {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}

	.role-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 4px;
		font-size: 11px;
		color: rgba(235, 235, 245, 0.8);
		white-space: nowrap;
	}

	.role-badge-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.role-badge-remove {
		background: none;
		border: none;
		color: rgba(235, 235, 245, 0.4);
		cursor: pointer;
		padding: 0;
		margin-left: 2px;
		font-size: 14px;
		line-height: 1;
		transition: color 0.15s ease;
		font-family: inherit;
	}

	.role-badge-remove:hover {
		color: #ff453a;
	}

	.add-role-wrapper {
		position: relative;
	}

	.btn-add-role {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1px dashed rgba(255, 255, 255, 0.2);
		background: transparent;
		color: rgba(235, 235, 245, 0.4);
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			border-color 0.15s ease;
		padding: 0;
	}

	.btn-add-role:hover {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.8);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.add-role-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 4px;
		min-width: 160px;
		background: rgba(40, 40, 40, 0.95);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		padding: 4px;
		z-index: 20;
	}

	.dropdown-empty {
		padding: 8px 12px;
		font-size: 12px;
		color: rgba(235, 235, 245, 0.4);
	}

	.dropdown-role-item {
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

	.dropdown-role-item:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	/* ===== Scrollbar ===== */
	.content-body::-webkit-scrollbar,
	.role-list::-webkit-scrollbar,
	.role-edit-panel::-webkit-scrollbar {
		width: 6px;
	}

	.content-body::-webkit-scrollbar-track,
	.role-list::-webkit-scrollbar-track,
	.role-edit-panel::-webkit-scrollbar-track {
		background: transparent;
	}

	.content-body::-webkit-scrollbar-thumb,
	.role-list::-webkit-scrollbar-thumb,
	.role-edit-panel::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}

	.content-body::-webkit-scrollbar-thumb:hover,
	.role-list::-webkit-scrollbar-thumb:hover,
	.role-edit-panel::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.2);
	}
</style>
