<script lang="ts">
	interface Props {
		onclose: () => void;
		oncreate: (name: string, isPublic: boolean) => Promise<void>;
	}

	let { onclose, oncreate }: Props = $props();

	let serverName = $state('');
	let isPublic = $state(false);
	let loading = $state(false);
	let error = $state('');
	let visible = $state(false);

	let canCreate = $derived(serverName.trim().length > 0 && !loading);

	function autofocus(node: HTMLInputElement) {
		node.focus();
	}

	$effect(() => {
		// Trigger entrance animation on next frame
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
		if (e.key === 'Enter' && canCreate) {
			handleCreate();
		}
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onclose();
		}
	}

	async function handleCreate() {
		if (!canCreate) return;

		loading = true;
		error = '';

		try {
			await oncreate(serverName.trim(), isPublic);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create server. Please try again.';
			loading = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" class:visible onclick={handleOverlayClick} onkeydown={handleKeydown} role="presentation">
	<div class="modal" class:visible role="dialog" aria-modal="true" aria-labelledby="modal-title">
		<!-- Header -->
		<div class="header">
			<div class="icon-wrapper">
				<svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path
						d="M13 2L4.09 12.11C3.68 12.59 3.46 12.83 3.45 13.04C3.44 13.22 3.52 13.4 3.66 13.51C3.82 13.64 4.14 13.64 4.78 13.64H12L11 22L19.91 11.89C20.32 11.41 20.54 11.17 20.55 10.96C20.56 10.78 20.48 10.6 20.34 10.49C20.18 10.36 19.86 10.36 19.22 10.36H12L13 2Z"
						stroke="url(#bolt-gradient)"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<defs>
						<linearGradient id="bolt-gradient" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
							<stop stop-color="#0A84FF" />
							<stop offset="0.5" stop-color="#BF5AF2" />
							<stop offset="1" stop-color="#30D158" />
						</linearGradient>
					</defs>
				</svg>
			</div>
			<h2 id="modal-title">Create a Server</h2>
			<p class="subtitle">Give your server a name. You can always change it later.</p>
		</div>

		<!-- Form -->
		<div class="form">
			<div class="input-group">
				<label for="server-name">Server Name</label>
				<input
					id="server-name"
					type="text"
					placeholder="My Awesome Server"
					autocomplete="off"
					spellcheck="false"
					use:autofocus
					bind:value={serverName}
					class:has-error={error.length > 0}
				/>
				{#if error}
					<p class="error-message">{error}</p>
				{/if}
			</div>

			<div class="toggle-group">
				<div class="toggle-info">
					<span class="toggle-label">Public Server</span>
					<span class="toggle-description">Anyone can find and join this server</span>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={isPublic}
					aria-label="Toggle public server"
					class="toggle"
					class:active={isPublic}
					onclick={() => (isPublic = !isPublic)}
				>
					<span class="toggle-knob"></span>
				</button>
			</div>
		</div>

		<!-- Actions -->
		<div class="actions">
			<button class="btn btn-secondary" onclick={onclose} disabled={loading}>
				Cancel
			</button>
			<button class="btn btn-primary" onclick={handleCreate} disabled={!canCreate}>
				{#if loading}
					<span class="spinner"></span>
					Creating...
				{:else}
					Create
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.overlay {
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

	.overlay.visible {
		opacity: 1;
	}

	.modal {
		background: rgba(var(--glass-heavy-rgb, 28, 28, 30), 0.75);
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

	.modal.visible {
		transform: scale(1);
		opacity: 1;
	}

	/* Header */
	.header {
		text-align: center;
		margin-bottom: 28px;
	}

	.icon-wrapper {
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

	.icon {
		width: 28px;
		height: 28px;
	}

	#modal-title {
		font-size: 22px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		margin: 0 0 8px;
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 14px;
		color: rgba(255, 255, 255, 0.5);
		margin: 0;
		line-height: 1.5;
	}

	/* Form */
	.form {
		display: flex;
		flex-direction: column;
		gap: 20px;
		margin-bottom: 28px;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
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
		padding: 14px 16px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		color: rgba(255, 255, 255, 0.95);
		font-size: 16px;
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

	.input-group input.has-error {
		border-color: #ff453a;
		box-shadow: 0 0 0 3px rgba(255, 69, 58, 0.2);
	}

	.error-message {
		font-size: 13px;
		color: #ff453a;
		margin: 0;
		line-height: 1.4;
	}

	/* Toggle */
	.toggle-group {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.06);
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

	/* Actions */
	.actions {
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

	/* Spinner */
	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
