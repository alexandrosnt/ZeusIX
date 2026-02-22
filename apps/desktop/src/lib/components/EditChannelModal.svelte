<script lang="ts">
	import { Settings, Hash, Volume2 } from 'lucide-svelte';
	import { updateChannel } from '$lib/services/api';
	import { channelsStore } from '$lib/stores/channels.svelte';
	import type { Channel } from '$lib/types';

	interface Props {
		channel: Channel;
		categories: { id: string; name: string }[];
		onclose: () => void;
	}

	let { channel, categories, onclose }: Props = $props();

	let name = $state('');
	let topic = $state('');
	let categoryId = $state('');
	let userLimitStr = $state('');
	let loading = $state(false);
	let error = $state('');
	let visible = $state(false);

	let canSave = $derived(name.trim().length > 0 && !loading);

	function autofocus(node: HTMLInputElement) {
		node.focus();
	}

	// Initialize form from channel prop + entrance animation
	$effect(() => {
		name = channel.name;
		topic = channel.topic ?? '';
		categoryId = channel.category_id ?? '';
		userLimitStr = channel.user_limit ? String(channel.user_limit) : '';
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
		if (e.key === 'Enter' && canSave) {
			handleSave();
		}
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onclose();
		}
	}

	async function handleSave() {
		if (!canSave) return;

		loading = true;
		error = '';

		try {
			// Build delta — only include fields that actually changed
			const delta: Record<string, unknown> = {};

			const trimmedName = name.trim();
			if (trimmedName !== channel.name) {
				delta.name = trimmedName;
			}

			if (channel.channel_type === 'text') {
				const trimmedTopic = topic.trim();
				if (trimmedTopic !== (channel.topic ?? '')) {
					delta.topic = trimmedTopic || undefined;
				}
			}

			const newCategoryId = categoryId || null;
			if (newCategoryId !== (channel.category_id ?? null)) {
				delta.category_id = newCategoryId ?? undefined;
			}

			if (channel.channel_type === 'voice') {
				const parsed = userLimitStr ? parseInt(userLimitStr, 10) : 0;
				const newLimit = parsed > 0 ? parsed : null;
				if (newLimit !== (channel.user_limit ?? null)) {
					delta.user_limit = newLimit;
				}
			}

			// Nothing changed
			if (Object.keys(delta).length === 0) {
				onclose();
				return;
			}

			const updated = await updateChannel(channel.id, delta);
			channelsStore.addChannel(updated);
			onclose();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update channel. Please try again.';
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
				<Settings size={28} color="url(#edit-gradient)" />
				<svg width="0" height="0" aria-hidden="true">
					<defs>
						<linearGradient id="edit-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="#0A84FF" />
							<stop offset="50%" stop-color="#BF5AF2" />
							<stop offset="100%" stop-color="#30D158" />
						</linearGradient>
					</defs>
				</svg>
			</div>
			<div class="title-row">
				<h2 id="modal-title">Edit Channel</h2>
				<span class="type-badge" class:voice={channel.channel_type === 'voice'}>
					{#if channel.channel_type === 'voice'}
						<Volume2 size={12} />
						Voice
					{:else}
						<Hash size={12} />
						Text
					{/if}
				</span>
			</div>
		</div>

		<!-- Form -->
		<div class="form">
			<!-- Channel Name -->
			<div class="input-group">
				<label for="edit-channel-name">Channel Name</label>
				<div class="name-input-wrapper">
					<span class="name-prefix">
						{#if channel.channel_type === 'voice'}
							<Volume2 size={16} />
						{:else}
							<Hash size={16} />
						{/if}
					</span>
					<input
						id="edit-channel-name"
						type="text"
						placeholder="channel-name"
						autocomplete="off"
						spellcheck="false"
						use:autofocus
						bind:value={name}
						class:has-error={error.length > 0}
					/>
				</div>
				{#if error}
					<p class="error-message">{error}</p>
				{/if}
			</div>

			<!-- Topic (text channels only) -->
			{#if channel.channel_type === 'text'}
			<div class="input-group">
				<label for="edit-channel-topic">Topic</label>
				<input
					id="edit-channel-topic"
					type="text"
					placeholder="What's this channel about?"
					autocomplete="off"
					spellcheck="false"
					bind:value={topic}
					class="topic-input"
				/>
			</div>
			{/if}

			<!-- Category -->
			<div class="input-group">
				<label for="edit-channel-category">Category</label>
				<div class="select-wrapper">
					<select id="edit-channel-category" bind:value={categoryId}>
						<option value="">No Category</option>
						{#each categories as cat (cat.id)}
							<option value={cat.id}>{cat.name}</option>
						{/each}
					</select>
					<span class="select-arrow">
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
							<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</span>
				</div>
			</div>

			<!-- User Limit (voice channels only) -->
			{#if channel.channel_type === 'voice'}
			<div class="input-group">
				<label for="edit-channel-user-limit">User Limit</label>
				<input
					id="edit-channel-user-limit"
					type="number"
					min="0"
					placeholder="No limit"
					bind:value={userLimitStr}
					class="limit-input"
				/>
				<p class="field-hint">Leave empty or 0 for unlimited.</p>
			</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="actions">
			<button class="btn btn-secondary" onclick={onclose} disabled={loading}>
				Cancel
			</button>
			<button class="btn btn-primary" onclick={handleSave} disabled={!canSave}>
				{#if loading}
					<span class="spinner"></span>
					Saving...
				{:else}
					Save Changes
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

	.icon-wrapper :global(svg) {
		stroke: url(#edit-gradient);
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
	}

	#modal-title {
		font-size: 22px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		margin: 0;
		letter-spacing: -0.02em;
	}

	.type-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 600;
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.5);
	}

	.type-badge.voice {
		background: rgba(48, 209, 88, 0.12);
		color: #30D158;
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

	.topic-input {
		width: 100%;
		padding: 14px 16px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		color: rgba(255, 255, 255, 0.95);
		font-size: 16px;
		font-family: inherit;
		outline: none;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
		box-sizing: border-box;
	}

	.topic-input::placeholder {
		color: rgba(255, 255, 255, 0.25);
	}

	.topic-input:focus {
		border-color: var(--accent-blue, #0a84ff);
		box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 10, 132, 255), 0.25);
	}

	.limit-input {
		width: 100%;
		padding: 14px 16px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 14px;
		color: rgba(255, 255, 255, 0.95);
		font-size: 16px;
		font-family: inherit;
		outline: none;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
		box-sizing: border-box;
	}

	.limit-input::placeholder {
		color: rgba(255, 255, 255, 0.25);
	}

	.limit-input:focus {
		border-color: var(--accent-blue, #0a84ff);
		box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 10, 132, 255), 0.25);
	}

	.field-hint {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.35);
		margin: 0;
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
