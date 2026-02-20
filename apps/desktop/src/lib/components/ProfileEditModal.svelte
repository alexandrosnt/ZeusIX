<script lang="ts">
	import { untrack } from 'svelte';
	import type { User } from '$lib/types';
	import { uploadFile } from '$lib/services/api';
	import { X, Camera } from 'lucide-svelte';
	import ImageCropModal from './ImageCropModal.svelte';

	interface Props {
		user: User;
		onclose: () => void;
		onsave: (data: {
			username?: string;
			avatar_url?: string | null;
			cover_url?: string | null;
			status?: string;
		}) => Promise<void>;
	}

	let { user, onclose, onsave }: Props = $props();

	let username = $state(untrack(() => user.username));
	let status = $state(untrack(() => user.status ?? ''));
	let avatarUrl: string | null = $state(untrack(() => user.avatar_url));
	let coverUrl: string | null = $state(untrack(() => user.cover_url));

	let saving = $state(false);
	let uploadingAvatar = $state(false);
	let uploadingCover = $state(false);
	let error = $state('');
	let visible = $state(false);

	let showCropModal = $state(false);
	let cropFile: File | null = $state(null);
	let cropTarget: 'avatar' | 'cover' = $state('avatar');

	let coverInputEl: HTMLInputElement | undefined = $state();
	let avatarInputEl: HTMLInputElement | undefined = $state();


	let initials = $derived(username.slice(0, 2).toUpperCase());
	let canSave = $derived(username.trim().length > 0 && !saving && !uploadingAvatar && !uploadingCover);

	$effect(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	function handleKeydown(e: KeyboardEvent) {
		if (showCropModal) return;
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

	function handleCoverKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			coverInputEl?.click();
		}
	}

	function handleAvatarKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			avatarInputEl?.click();
		}
	}

	// Local blob URLs for instant preview before server responds
	let avatarBlobUrl: string | null = $state(null);
	let coverBlobUrl: string | null = $state(null);

	let avatarPreview = $derived(avatarBlobUrl ?? avatarUrl);
	let coverPreview = $derived(coverBlobUrl ?? coverUrl);

	async function handleFileUpload(file: File, target: 'avatar' | 'cover') {
		if (target === 'avatar') {
			uploadingAvatar = true;
			// Show local preview immediately
			if (avatarBlobUrl) URL.revokeObjectURL(avatarBlobUrl);
			avatarBlobUrl = URL.createObjectURL(file);
		} else {
			uploadingCover = true;
			if (coverBlobUrl) URL.revokeObjectURL(coverBlobUrl);
			coverBlobUrl = URL.createObjectURL(file);
		}
		error = '';

		try {
			const result = await uploadFile(file);
			if (target === 'avatar') {
				avatarUrl = result.url;
			} else {
				coverUrl = result.url;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Upload failed. Please try again.';
			// Revert preview on failure
			if (target === 'avatar') {
				if (avatarBlobUrl) URL.revokeObjectURL(avatarBlobUrl);
				avatarBlobUrl = null;
			} else {
				if (coverBlobUrl) URL.revokeObjectURL(coverBlobUrl);
				coverBlobUrl = null;
			}
		} finally {
			if (target === 'avatar') {
				uploadingAvatar = false;
			} else {
				uploadingCover = false;
			}
		}
	}

	function handleCoverFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
			if (!validTypes.includes(file.type)) {
				error = 'Invalid file type. Please use PNG, JPEG, GIF, or WebP.';
			} else {
				cropFile = file;
				cropTarget = 'cover';
				showCropModal = true;
			}
		}
		input.value = '';
	}

	function handleAvatarFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
			if (!validTypes.includes(file.type)) {
				error = 'Invalid file type. Please use PNG, JPEG, GIF, or WebP.';
			} else {
				cropFile = file;
				cropTarget = 'avatar';
				showCropModal = true;
			}
		}
		input.value = '';
	}

	function handleCropConfirm(croppedFile: File) {
		showCropModal = false;
		cropFile = null;
		handleFileUpload(croppedFile, cropTarget);
	}

	function handleCropCancel() {
		showCropModal = false;
		cropFile = null;
	}

	async function handleSave() {
		if (!canSave) return;

		saving = true;
		error = '';

		try {
			await onsave({
				username: username.trim(),
				avatar_url: avatarUrl,
				cover_url: coverUrl,
				status: status.trim()
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save profile. Please try again.';
			saving = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" class:visible onclick={handleOverlayClick} onkeydown={handleKeydown} role="presentation">
	<div class="modal" class:visible role="dialog" aria-modal="true" aria-labelledby="modal-title">
		<!-- Header -->
		<div class="header">
			<h2 id="modal-title">Edit Profile</h2>
		</div>

		<!-- Cover Upload -->
		<input
			type="file"
			accept="image/png,image/jpeg,image/gif,image/webp"
			bind:this={coverInputEl}
			onchange={handleCoverFileChange}
			class="file-input-hidden"
		/>
		<div
			class="cover-upload"
			onclick={() => coverInputEl?.click()}
			onkeydown={handleCoverKeydown}
			role="button"
			tabindex="0"
			aria-label="Upload cover image"
		>
			{#if coverPreview}
				<img src={coverPreview} alt="Cover" class="cover-preview" />
			{:else}
				<div class="cover-placeholder"></div>
			{/if}

			<div class="upload-overlay">
				{#if uploadingCover}
					<span class="spinner spinner-large"></span>
				{:else}
					<Camera size={24} />
					<span class="upload-label">Change Cover</span>
				{/if}
			</div>

			{#if coverPreview}
				<button
					type="button"
					class="remove-btn cover-remove-btn"
					onclick={(e) => { e.stopPropagation(); coverUrl = null; if (coverBlobUrl) { URL.revokeObjectURL(coverBlobUrl); coverBlobUrl = null; } }}
					aria-label="Remove cover"
				>
					<X size={14} />
				</button>
			{/if}
		</div>

		<!-- Avatar Upload -->
		<input
			type="file"
			accept="image/png,image/jpeg,image/gif,image/webp"
			bind:this={avatarInputEl}
			onchange={handleAvatarFileChange}
			class="file-input-hidden"
		/>
		<div
			class="avatar-upload"
			onclick={() => avatarInputEl?.click()}
			onkeydown={handleAvatarKeydown}
			role="button"
			tabindex="0"
			aria-label="Upload avatar image"
		>
			{#if avatarPreview}
				<img src={avatarPreview} alt="Avatar" class="avatar-preview" />
			{:else}
				<div class="avatar-placeholder">
					<span class="avatar-initials">{initials}</span>
				</div>
			{/if}

			<div class="upload-overlay avatar-overlay">
				{#if uploadingAvatar}
					<span class="spinner"></span>
				{:else}
					<Camera size={18} />
				{/if}
			</div>

			{#if avatarPreview}
				<button
					type="button"
					class="remove-btn avatar-remove-btn"
					onclick={(e) => { e.stopPropagation(); avatarUrl = null; if (avatarBlobUrl) { URL.revokeObjectURL(avatarBlobUrl); avatarBlobUrl = null; } }}
					aria-label="Remove avatar"
				>
					<X size={12} />
				</button>
			{/if}
		</div>

		<!-- Form -->
		<div class="form">
			<div class="input-group">
				<label for="profile-username">Username</label>
				<input
					id="profile-username"
					type="text"
					placeholder="Username"
					autocomplete="off"
					spellcheck="false"
					bind:value={username}
				/>
			</div>

			<div class="input-group">
				<label for="profile-status">Custom Status</label>
				<input
					id="profile-status"
					type="text"
					placeholder="What are you up to?"
					autocomplete="off"
					spellcheck="false"
					bind:value={status}
				/>
			</div>

			{#if error}
				<p class="error-message">{error}</p>
			{/if}
		</div>

		<!-- Actions -->
		<div class="actions">
			<button class="btn btn-secondary" onclick={onclose} disabled={saving}>
				Cancel
			</button>
			<button class="btn btn-primary" onclick={handleSave} disabled={!canSave}>
				{#if saving}
					<span class="spinner"></span>
					Saving...
				{:else}
					Save
				{/if}
			</button>
		</div>
	</div>
</div>

{#if showCropModal && cropFile}
	<ImageCropModal
		file={cropFile}
		mode={cropTarget}
		onconfirm={handleCropConfirm}
		oncancel={handleCropCancel}
	/>
{/if}

<style>
	.file-input-hidden {
		display: none;
	}

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
		font-family: inherit;
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
		width: 480px;
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
		margin-bottom: 20px;
	}

	#modal-title {
		font-size: 22px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		margin: 0;
		letter-spacing: -0.02em;
	}

	/* Cover Upload */
	.cover-upload {
		position: relative;
		width: 100%;
		height: 120px;
		border-radius: 12px;
		overflow: hidden;
		cursor: pointer;
		margin-bottom: 0;
	}

	.cover-preview {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.cover-placeholder {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
	}

	.cover-upload .upload-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		opacity: 0;
		transition: opacity 0.2s ease;
		color: rgba(255, 255, 255, 0.9);
	}

	.cover-upload:hover .upload-overlay {
		opacity: 1;
	}

	.upload-label {
		font-size: 13px;
		font-weight: 500;
	}

	/* Avatar Upload */
	.avatar-upload {
		position: relative;
		width: 80px;
		height: 80px;
		border-radius: 50%;
		overflow: hidden;
		cursor: pointer;
		margin-top: -40px;
		margin-left: 20px;
		margin-bottom: 16px;
		border: 4px solid rgba(var(--glass-heavy-rgb, 28, 28, 30), 0.75);
		box-sizing: content-box;
	}

	.avatar-preview {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #ff9f0a, #ff375f);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.avatar-initials {
		font-size: 24px;
		font-weight: 700;
		color: white;
		user-select: none;
	}

	.avatar-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s ease;
		color: rgba(255, 255, 255, 0.9);
	}

	.avatar-upload:hover .avatar-overlay {
		opacity: 1;
	}

	/* Remove Buttons */
	.remove-btn {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 50%;
		color: rgba(255, 255, 255, 0.9);
		cursor: pointer;
		padding: 0;
		transition: background 0.2s ease;
		z-index: 2;
	}

	.remove-btn:hover {
		background: rgba(255, 69, 58, 0.8);
	}

	.cover-remove-btn {
		top: 8px;
		right: 8px;
		width: 26px;
		height: 26px;
	}

	.avatar-remove-btn {
		top: 0;
		right: 0;
		width: 22px;
		height: 22px;
	}

	/* Form */
	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-bottom: 24px;
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

	.error-message {
		font-size: 13px;
		color: #ff453a;
		margin: 0;
		line-height: 1.4;
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

	.spinner-large {
		width: 24px;
		height: 24px;
		border-width: 3px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
