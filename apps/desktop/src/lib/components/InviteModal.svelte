<script lang="ts">
	import { createInvite } from '$lib/services/api';
	import { Copy, Check, X } from 'lucide-svelte';

	interface Props {
		serverId: string;
		onclose: () => void;
	}

	let { serverId, onclose }: Props = $props();

	let visible = $state(false);
	let loading = $state(true);
	let error = $state('');
	let inviteCode = $state('');
	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

	$effect(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	// Generate invite on mount
	$effect(() => {
		generateInvite();
	});

	// Clean up copy timeout on destroy
	$effect(() => {
		return () => {
			if (copyTimeout) clearTimeout(copyTimeout);
		};
	});

	async function generateInvite() {
		loading = true;
		error = '';
		inviteCode = '';

		try {
			const invite = await createInvite(serverId);
			inviteCode = invite.code;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to generate invite. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleCopy() {
		if (!inviteCode) return;

		try {
			await navigator.clipboard.writeText(inviteCode);
			copied = true;

			if (copyTimeout) clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			// Fallback: select the text in the input
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" class:visible onclick={handleOverlayClick} onkeydown={handleKeydown} role="presentation">
	<div class="modal" class:visible role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
		<!-- Close button -->
		<button class="close-btn" onclick={onclose} aria-label="Close">
			<X size={18} />
		</button>

		<!-- Header -->
		<div class="header">
			<div class="icon-wrapper">
				<svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path
						d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"
						stroke="url(#invite-gradient)"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M8.5 11C10.7091 11 12.5 9.20914 12.5 7C12.5 4.79086 10.7091 3 8.5 3C6.29086 3 4.5 4.79086 4.5 7C4.5 9.20914 6.29086 11 8.5 11Z"
						stroke="url(#invite-gradient)"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M20 8V14"
						stroke="url(#invite-gradient)"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M23 11H17"
						stroke="url(#invite-gradient)"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<defs>
						<linearGradient id="invite-gradient" x1="1" y1="3" x2="23" y2="21" gradientUnits="userSpaceOnUse">
							<stop stop-color="#0A84FF" />
							<stop offset="0.5" stop-color="#BF5AF2" />
							<stop offset="1" stop-color="#30D158" />
						</linearGradient>
					</defs>
				</svg>
			</div>
			<h2 id="invite-modal-title">Invite People</h2>
			<p class="subtitle">Share this invite code with others to let them join your server.</p>
		</div>

		<!-- Content -->
		<div class="content">
			{#if loading}
				<div class="loading-state">
					<span class="spinner"></span>
					<p class="loading-text">Generating invite code...</p>
				</div>
			{:else if error}
				<div class="error-state">
					<p class="error-message">{error}</p>
					<button class="btn btn-primary" onclick={generateInvite}>
						Try Again
					</button>
				</div>
			{:else}
				<div class="invite-group">
					<label for="invite-code">Invite Code</label>
					<div class="invite-row">
						<input
							id="invite-code"
							type="text"
							readonly
							value={inviteCode}
						/>
						<button
							class="btn btn-copy"
							class:copied
							onclick={handleCopy}
							aria-label={copied ? 'Copied' : 'Copy invite code'}
						>
							{#if copied}
								<Check size={18} />
								<span>Copied!</span>
							{:else}
								<Copy size={18} />
								<span>Copy</span>
							{/if}
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="actions">
			<button class="btn btn-secondary" onclick={onclose}>
				Done
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
		position: relative;
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

	/* Close button */
	.close-btn {
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

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.8);
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

	#invite-modal-title {
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

	/* Content */
	.content {
		margin-bottom: 28px;
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 24px 0;
	}

	.loading-text {
		font-size: 14px;
		color: rgba(255, 255, 255, 0.5);
		margin: 0;
	}

	/* Error State */
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 16px 0;
	}

	.error-message {
		font-size: 14px;
		color: #ff453a;
		margin: 0;
		text-align: center;
		line-height: 1.5;
	}

	/* Invite Code Group */
	.invite-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.invite-group label {
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.invite-row {
		display: flex;
		gap: 10px;
	}

	.invite-row input {
		flex: 1;
		padding: 14px 16px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		color: rgba(255, 255, 255, 0.95);
		font-size: 16px;
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
		letter-spacing: 0.05em;
		outline: none;
		cursor: default;
		box-sizing: border-box;
		min-width: 0;
	}

	.invite-row input:focus {
		border-color: var(--accent-blue, #0a84ff);
		box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 10, 132, 255), 0.25);
	}

	/* Buttons */
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

	.btn-copy {
		background: var(--accent-blue, #0a84ff);
		color: white;
		padding: 14px 20px;
		border-radius: 14px;
		flex-shrink: 0;
		font-size: 14px;
	}

	.btn-copy:hover:not(:disabled) {
		background: var(--accent-blue-hover, #2e96ff);
		box-shadow: 0 4px 16px rgba(var(--accent-rgb, 10, 132, 255), 0.4);
	}

	.btn-copy.copied {
		background: #30d158;
	}

	.btn-copy.copied:hover:not(:disabled) {
		background: #34d65c;
		box-shadow: 0 4px 16px rgba(48, 209, 88, 0.4);
	}

	/* Actions */
	.actions {
		display: flex;
		justify-content: flex-end;
	}

	/* Spinner */
	.spinner {
		width: 24px;
		height: 24px;
		border: 2.5px solid rgba(255, 255, 255, 0.15);
		border-top-color: var(--accent-blue, #0a84ff);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
