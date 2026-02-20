<script lang="ts">
	import { Command, Plus, LogIn, X } from 'lucide-svelte';
	import { useInvite, getServer } from '$lib/services/api';
	import { serversStore } from '$lib/stores/servers.svelte';
	import type { Server } from '$lib/types';

	interface Props {
		onselect?: (serverId: string) => void;
		onhome?: () => void;
		onadd?: () => void;
		onjoin?: (serverId: string) => void;
	}

	let { onselect, onhome, onadd, onjoin }: Props = $props();

	let servers = $derived(serversStore.servers);
	let activeServerId = $derived(serversStore.activeServerId);

	function getInitials(name: string): string {
		return name
			.split(/\s+/)
			.map((word) => word[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	let showJoinModal = $state(false);
	let joinModalVisible = $state(false);
	let inviteCode = $state('');
	let joining = $state(false);
	let joinError = $state('');

	function openJoinModal() {
		showJoinModal = true;
		requestAnimationFrame(() => { joinModalVisible = true; });
	}

	function closeJoinModal() {
		joinModalVisible = false;
		setTimeout(() => {
			showJoinModal = false;
			inviteCode = '';
			joinError = '';
		}, 250);
	}

	async function handleJoin() {
		if (!inviteCode.trim() || joining) return;
		joining = true;
		joinError = '';
		try {
			const result = await useInvite(inviteCode.trim());
			const server = await getServer(result.server_id);
			serversStore.addServer(server);
			onjoin?.(server.id);
			closeJoinModal();
		} catch (err) {
			joinError = err instanceof Error ? err.message : 'Invalid invite code';
		} finally {
			joining = false;
		}
	}
</script>

<nav class="server-rail">
	<!-- Home button -->
	<button
		class="server-icon"
		class:active={activeServerId === null}
		onclick={onhome}
		aria-label="Home"
	>
		<Command size={24} />
	</button>

	<!-- Separator -->
	<div class="separator"></div>

	<!-- Server list -->
	{#each servers as server (server.id)}
		<button
			class="server-icon"
			class:active={activeServerId === server.id}
			onclick={() => onselect?.(server.id)}
			aria-label={server.name}
			title={server.name}
		>
			{#if server.icon_url}
				<img src={server.icon_url} alt={server.name} class="server-img" />
			{:else}
				<span class="server-initials">{getInitials(server.name)}</span>
			{/if}
		</button>
	{/each}

	<!-- Add server button -->
	<button class="server-icon add-server" onclick={onadd} aria-label="Add Server">
		<Plus size={20} />
	</button>

	<!-- Join server button -->
	<button class="server-icon join-server" onclick={openJoinModal} aria-label="Join Server" title="Join Server">
		<LogIn size={20} />
	</button>
</nav>

{#if showJoinModal}
	<div
		class="join-overlay"
		class:visible={joinModalVisible}
		onclick={(e) => { if (e.target === e.currentTarget) closeJoinModal(); }}
		onkeydown={(e) => { if (e.key === 'Escape') closeJoinModal(); }}
		role="presentation"
	>
		<div class="join-modal" class:visible={joinModalVisible} role="dialog" aria-modal="true">
			<button class="join-close-btn" onclick={closeJoinModal} aria-label="Close">
				<X size={18} />
			</button>

			<div class="join-modal-header">
				<div class="join-icon-wrapper">
					<LogIn size={28} color="#0a84ff" />
				</div>
				<h2 class="join-modal-title">Join a Server</h2>
				<p class="join-modal-subtitle">Enter an invite code to join an existing server.</p>
			</div>

			<div class="join-modal-form">
				<div class="join-input-group">
					<label for="join-invite-code">Invite Code</label>
					<input
						id="join-invite-code"
						class="join-input"
						type="text"
						placeholder="e.g. abc123"
						bind:value={inviteCode}
						onkeydown={(e) => { if (e.key === 'Enter') handleJoin(); }}
						autocomplete="off"
						spellcheck="false"
					/>
				</div>
				{#if joinError}
					<div class="join-error">{joinError}</div>
				{/if}
			</div>

			<div class="join-modal-actions">
				<button class="btn btn-secondary" onclick={closeJoinModal}>Cancel</button>
				<button class="btn btn-primary" onclick={handleJoin} disabled={!inviteCode.trim() || joining}>
					{#if joining}
						<span class="spinner"></span>
						Joining...
					{:else}
						Join Server
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.server-rail {
		width: 72px;
		padding: 12px 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		background: rgba(0, 0, 0, 0.2);
		border-right: 1px solid rgba(255, 255, 255, 0.08);
		z-index: 20;
	}

	.server-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--bg-glass-light, rgba(44, 44, 46, 0.4));
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
		position: relative;
		color: rgba(255, 255, 255, 0.95);
		border: none;
		padding: 0;
		font-family: inherit;
		font-size: 14px;
		font-weight: 600;
		overflow: hidden;
	}

	.server-icon:hover,
	.server-icon.active {
		border-radius: 16px;
		background: var(--accent-blue, #0a84ff);
	}

	/* White pill indicator */
	.server-icon::before {
		content: '';
		position: absolute;
		left: -14px;
		width: 4px;
		height: 0%;
		background: white;
		border-radius: 0 4px 4px 0;
		transition: height 0.2s ease;
	}

	.server-icon:hover::before {
		height: 20px;
	}

	.server-icon.active::before {
		height: 32px;
	}

	.separator {
		width: 32px;
		height: 2px;
		background: var(--bg-glass-light, rgba(44, 44, 46, 0.4));
		margin: 4px 0;
		border-radius: 1px;
	}

	.server-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: inherit;
	}

	.server-initials {
		user-select: none;
		letter-spacing: 0.02em;
	}

	.add-server {
		background: transparent;
		border: 2px dashed rgba(48, 209, 88, 0.5);
		color: #30d158;
	}

	.add-server:hover {
		background: rgba(48, 209, 88, 0.15);
		border-color: #30d158;
		border-radius: 16px;
		border-style: dashed;
	}

	.join-server {
		background: transparent;
		border: 2px dashed rgba(var(--accent-rgb, 10, 132, 255), 0.5);
		color: var(--accent-blue, #0a84ff);
	}

	.join-server:hover {
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.15);
		border-color: var(--accent-blue, #0a84ff);
		border-radius: 16px;
		border-style: dashed;
	}

	/* ===== Join Modal ===== */
	.join-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		opacity: 0;
		transition: opacity 0.25s ease;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, sans-serif;
	}

	.join-overlay.visible {
		opacity: 1;
	}

	.join-modal {
		position: relative;
		background: rgba(30, 30, 30, 0.75);
		backdrop-filter: blur(50px) saturate(180%);
		-webkit-backdrop-filter: blur(50px) saturate(180%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 20px;
		box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6);
		width: 440px;
		max-width: calc(100vw - 40px);
		padding: 36px;
		transform: scale(0.92);
		opacity: 0;
		transition:
			transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
			opacity 0.25s ease;
	}

	.join-modal.visible {
		transform: scale(1);
		opacity: 1;
	}

	.join-close-btn {
		position: absolute;
		top: 16px;
		right: 16px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		color: rgba(255, 255, 255, 0.5);
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
	}

	.join-close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.8);
	}

	.join-modal-header {
		text-align: center;
		margin-bottom: 28px;
	}

	.join-icon-wrapper {
		width: 56px;
		height: 56px;
		margin: 0 auto 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.join-modal-title {
		font-size: 22px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		margin: 0 0 8px;
		letter-spacing: -0.02em;
	}

	.join-modal-subtitle {
		font-size: 14px;
		color: rgba(255, 255, 255, 0.5);
		margin: 0;
		line-height: 1.5;
	}

	.join-modal-form {
		margin-bottom: 28px;
	}

	.join-input-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.join-input-group label {
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.join-input {
		width: 100%;
		padding: 14px 16px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		color: rgba(255, 255, 255, 0.95);
		font-size: 16px;
		font-family: inherit;
		outline: none;
		box-sizing: border-box;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.join-input:focus {
		border-color: var(--accent-blue, #0a84ff);
		box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 10, 132, 255), 0.25);
	}

	.join-input::placeholder {
		color: rgba(255, 255, 255, 0.25);
	}

	.join-error {
		font-size: 13px;
		color: #ff453a;
		margin-top: 8px;
	}

	.join-modal-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
	}

	.btn {
		padding: 10px 24px;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		border: none;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.8);
	}

	.btn-secondary:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.12);
	}

	.btn-primary {
		background: var(--accent-blue, #0a84ff);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-blue-hover, #2e96ff);
		box-shadow: 0 4px 16px rgba(var(--accent-rgb, 10, 132, 255), 0.4);
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
