<script lang="ts">
	interface Props {
		channelName: string;
		onclose: () => void;
		onconfirm: () => Promise<void>;
	}

	let { channelName, onclose, onconfirm }: Props = $props();

	let loading = $state(false);
	let visible = $state(false);

	$effect(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !loading) {
			onclose();
		}
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget && !loading) {
			onclose();
		}
	}

	async function handlePurge() {
		if (loading) return;

		loading = true;

		try {
			await onconfirm();
		} catch {
			loading = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" class:visible onclick={handleOverlayClick} onkeydown={handleKeydown} role="presentation">
	<div class="modal" class:visible role="alertdialog" aria-modal="true" aria-labelledby="purge-modal-title" aria-describedby="purge-modal-desc">
		<!-- Icon -->
		<div class="header">
			<div class="icon-wrapper">
				<svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path
						d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19ZM10 11V17M14 11V17"
						stroke="#ff453a"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</div>
			<h2 id="purge-modal-title">Purge Messages</h2>
		</div>

		<!-- Warning -->
		<p id="purge-modal-desc" class="warning">
			This will permanently delete all messages in <strong>#{channelName}</strong> for everyone. This cannot be undone.
		</p>

		<!-- Actions -->
		<div class="actions">
			<button class="btn btn-secondary" onclick={onclose} disabled={loading}>
				Cancel
			</button>
			<button class="btn btn-danger" onclick={handlePurge} disabled={loading}>
				{#if loading}
					<span class="spinner"></span>
					Purging...
				{:else}
					Purge All Messages
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
		margin-bottom: 20px;
	}

	.icon-wrapper {
		width: 56px;
		height: 56px;
		margin: 0 auto 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 69, 58, 0.1);
		border-radius: 16px;
		border: 1px solid rgba(255, 69, 58, 0.15);
	}

	.icon {
		width: 28px;
		height: 28px;
	}

	#purge-modal-title {
		font-size: 22px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		margin: 0;
		letter-spacing: -0.02em;
	}

	/* Warning */
	.warning {
		font-size: 15px;
		color: rgba(255, 255, 255, 0.6);
		line-height: 1.6;
		text-align: center;
		margin: 0 0 28px;
	}

	.warning strong {
		color: rgba(255, 255, 255, 0.95);
		font-weight: 600;
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

	.btn-danger {
		background: #ff453a;
		color: white;
	}

	.btn-danger:hover:not(:disabled) {
		background: #ff6961;
		box-shadow: 0 4px 16px rgba(255, 69, 58, 0.4);
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
