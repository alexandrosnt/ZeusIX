<script lang="ts">
	import { Hash, Volume2, FolderOpen } from 'lucide-svelte';

	interface Props {
		categories: { id: string; name: string }[];
		defaultCategoryId?: string;
		onclose: () => void;
		oncreate: (name: string, type: 'text' | 'voice' | 'category', categoryId?: string) => Promise<void>;
	}

	let { categories, defaultCategoryId, onclose, oncreate }: Props = $props();

	let channelName = $state('');
	let channelType = $state<'text' | 'voice' | 'category'>('text');
	let categoryId = $state('');
	let loading = $state(false);
	let error = $state('');
	let visible = $state(false);

	let canCreate = $derived(channelName.trim().length > 0 && !loading);

	function autofocus(node: HTMLInputElement) {
		node.focus();
	}

	// Initialize category from prop and trigger entrance animation
	$effect(() => {
		const initial = defaultCategoryId;
		if (initial) {
			categoryId = initial;
		}
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
			await oncreate(
				channelName.trim(),
				channelType,
				categoryId || undefined
			);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create channel. Please try again.';
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
				<Hash size={28} color="url(#channel-gradient)" />
				<svg width="0" height="0" aria-hidden="true">
					<defs>
						<linearGradient id="channel-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="#0A84FF" />
							<stop offset="50%" stop-color="#BF5AF2" />
							<stop offset="100%" stop-color="#30D158" />
						</linearGradient>
					</defs>
				</svg>
			</div>
			<h2 id="modal-title">Create Channel</h2>
			<p class="subtitle">Add a new channel to your server for your community to chat in.</p>
		</div>

		<!-- Form -->
		<div class="form">
			<!-- Channel Type -->
			<div class="input-group">
				<span class="field-label" id="channel-type-label">Channel Type</span>
				<div class="type-selector" role="radiogroup" aria-labelledby="channel-type-label">
					<button
						type="button"
						role="radio"
						aria-checked={channelType === 'text'}
						class="type-card"
						class:selected={channelType === 'text'}
						onclick={() => (channelType = 'text')}
					>
						<Hash size={20} />
						<span class="type-label">Text</span>
					</button>
					<button
						type="button"
						role="radio"
						aria-checked={channelType === 'voice'}
						class="type-card"
						class:selected={channelType === 'voice'}
						onclick={() => (channelType = 'voice')}
					>
						<Volume2 size={20} />
						<span class="type-label">Voice</span>
					</button>
					<button
						type="button"
						role="radio"
						aria-checked={channelType === 'category'}
						class="type-card"
						class:selected={channelType === 'category'}
						onclick={() => (channelType = 'category')}
					>
						<FolderOpen size={20} />
						<span class="type-label">Category</span>
					</button>
				</div>
			</div>

			<!-- Channel Name -->
			<div class="input-group">
				<label for="channel-name">Channel Name</label>
				<div class="name-input-wrapper">
					<span class="name-prefix">
						{#if channelType === 'text'}
							<Hash size={16} />
						{:else if channelType === 'voice'}
							<Volume2 size={16} />
						{:else}
							<FolderOpen size={16} />
						{/if}
					</span>
					<input
						id="channel-name"
						type="text"
						placeholder="new-channel"
						autocomplete="off"
						spellcheck="false"
						use:autofocus
						bind:value={channelName}
						class:has-error={error.length > 0}
					/>
				</div>
				{#if error}
					<p class="error-message">{error}</p>
				{/if}
			</div>

			<!-- Category (hidden for category type — categories can't nest) -->
			{#if channelType !== 'category'}
			<div class="input-group">
				<label for="channel-category">Category</label>
				<div class="select-wrapper">
					<select id="channel-category" bind:value={categoryId}>
						<option value="">No Category</option>
						{#each categories as category (category.id)}
							<option value={category.id}>{category.name}</option>
						{/each}
					</select>
					<span class="select-arrow">
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
							<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</span>
				</div>
			</div>
			{/if}
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
					Create Channel
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
		position: relative;
	}

	.icon-wrapper :global(svg) {
		stroke: url(#channel-gradient);
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

	.input-group label,
	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Type Selector */
	.type-selector {
		display: flex;
		gap: 10px;
	}

	.type-card {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px 16px;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 14px;
		color: rgba(255, 255, 255, 0.5);
		font-size: 15px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.type-card:hover {
		background: rgba(0, 0, 0, 0.4);
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.7);
	}

	.type-card.selected {
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.15);
		border-color: rgba(var(--accent-rgb, 10, 132, 255), 0.5);
		color: var(--accent-blue, #0a84ff);
	}

	.type-card.selected :global(svg) {
		color: var(--accent-blue, #0a84ff);
	}

	/* Channel Name Input */
	.name-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.name-prefix {
		position: absolute;
		left: 14px;
		display: flex;
		align-items: center;
		color: rgba(255, 255, 255, 0.3);
		pointer-events: none;
		z-index: 1;
	}

	.name-input-wrapper input {
		width: 100%;
		padding: 14px 16px 14px 38px;
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

	.name-input-wrapper input::placeholder {
		color: rgba(255, 255, 255, 0.25);
	}

	.name-input-wrapper input:focus {
		border-color: var(--accent-blue, #0a84ff);
		box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 10, 132, 255), 0.25);
	}

	.name-input-wrapper input.has-error {
		border-color: #ff453a;
		box-shadow: 0 0 0 3px rgba(255, 69, 58, 0.2);
	}

	.error-message {
		font-size: 13px;
		color: #ff453a;
		margin: 0;
		line-height: 1.4;
	}

	/* Select Dropdown */
	.select-wrapper {
		position: relative;
	}

	.select-wrapper select {
		width: 100%;
		padding: 14px 40px 14px 16px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		color: rgba(255, 255, 255, 0.95);
		font-size: 16px;
		font-family: inherit;
		outline: none;
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
		box-sizing: border-box;
	}

	.select-wrapper select:focus {
		border-color: var(--accent-blue, #0a84ff);
		box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 10, 132, 255), 0.25);
	}

	.select-wrapper select option {
		background: #2a2a2a;
		color: rgba(255, 255, 255, 0.95);
	}

	.select-arrow {
		position: absolute;
		right: 14px;
		top: 50%;
		transform: translateY(-50%);
		color: rgba(255, 255, 255, 0.4);
		pointer-events: none;
		display: flex;
		align-items: center;
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
