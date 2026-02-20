<script lang="ts">
	import { onMount } from 'svelte';
	import { MonitorUp, Monitor, AppWindow, Loader2, AlertCircle } from 'lucide-svelte';

	type MonitorSource = {
		type: 'Monitor';
		index: number;
		name: string;
		device_name: string;
		width: number;
		height: number;
		refresh_rate: number;
	};

	type WindowSource = {
		type: 'Window';
		index: number;
		title: string;
		process_name: string;
	};

	type CaptureSource = MonitorSource | WindowSource;

	interface ShareOptions {
		sourceType: 'monitor' | 'window';
		sourceIndex: number;
		resolution?: { width: number; height: number };
		frameRate?: number;
		audio?: boolean;
		jpegQuality?: number;
	}

	interface Props {
		onclose: () => void;
		onshare: (options: ShareOptions) => void;
	}

	let { onclose, onshare }: Props = $props();

	type SourceTab = 'screens' | 'windows';
	type Resolution = '720p' | '1080p' | 'source';
	type FPS = 15 | 24 | 30 | 60;

	const resolutions: { id: Resolution; label: string; size?: { width: number; height: number } }[] = [
		{ id: '720p', label: '720p', size: { width: 1280, height: 720 } },
		{ id: '1080p', label: '1080p', size: { width: 1920, height: 1080 } },
		{ id: 'source', label: 'Source' }
	];

	const fpsOptions: { value: FPS; label: string }[] = [
		{ value: 15, label: '15' },
		{ value: 24, label: '24' },
		{ value: 30, label: '30' },
		{ value: 60, label: '60' }
	];

	let selectedResolution = $state<Resolution>('1080p');
	let selectedFps = $state<FPS>(30);
	let shareAudio = $state(false);
	let visible = $state(false);
	let activeTab = $state<SourceTab>('screens');
	let sources = $state<CaptureSource[]>([]);
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let selectedSourceIndex = $state<number | null>(null);
	let selectedSourceType = $state<'monitor' | 'window' | null>(null);

	let monitors = $derived(sources.filter((s): s is MonitorSource => s.type === 'Monitor'));
	let windows = $derived(sources.filter((s): s is WindowSource => s.type === 'Window'));

	let canShare = $derived(selectedSourceIndex !== null && selectedSourceType !== null);

	let activeSources = $derived(activeTab === 'screens' ? monitors : windows);

	onMount(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
		loadCaptureSources();
	});

	async function loadCaptureSources() {
		loading = true;
		loadError = null;

		try {
			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke<CaptureSource[]>('enumerate_capture_sources');
			sources = result;

			// Auto-select the first monitor if available
			const firstMonitor = result.find((s): s is MonitorSource => s.type === 'Monitor');
			if (firstMonitor) {
				selectedSourceIndex = firstMonitor.index;
				selectedSourceType = 'monitor';
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (message.includes('not a function') || message.includes('Cannot find module')) {
				loadError = 'Source enumeration is only available in the desktop app.';
			} else {
				loadError = `Failed to enumerate sources: ${message}`;
			}
		} finally {
			loading = false;
		}
	}

	function selectSource(source: CaptureSource) {
		selectedSourceIndex = source.index;
		selectedSourceType = source.type === 'Monitor' ? 'monitor' : 'window';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleShare() {
		if (!canShare) return;

		const res = resolutions.find((r) => r.id === selectedResolution);
		onshare({
			sourceType: selectedSourceType!,
			sourceIndex: selectedSourceIndex!,
			resolution: res?.size,
			frameRate: selectedFps,
			audio: shareAudio
		});
	}

	function switchTab(tab: SourceTab) {
		activeTab = tab;
		// Reset selection when switching tabs unless current selection matches the new tab
		if (
			(tab === 'screens' && selectedSourceType !== 'monitor') ||
			(tab === 'windows' && selectedSourceType !== 'window')
		) {
			selectedSourceIndex = null;
			selectedSourceType = null;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" class:visible onclick={handleOverlayClick} role="presentation">
	<div class="modal" class:visible role="dialog" aria-modal="true" aria-labelledby="ss-modal-title">
		<div class="header">
			<div class="icon-wrapper">
				<MonitorUp size={28} />
			</div>
			<h2 id="ss-modal-title">Screen Share</h2>
			<p class="subtitle">Select a source, resolution, and frame rate.</p>
		</div>

		<div class="form">
			<!-- Source Tabs -->
			<div class="input-group">
				<span class="field-label">Capture Source</span>

				<div class="tab-bar">
					<button
						type="button"
						class="tab-btn"
						class:active={activeTab === 'screens'}
						onclick={() => switchTab('screens')}
					>
						<Monitor size={16} />
						<span>Screens</span>
						{#if !loading}
							<span class="tab-count">{monitors.length}</span>
						{/if}
					</button>
					<button
						type="button"
						class="tab-btn"
						class:active={activeTab === 'windows'}
						onclick={() => switchTab('windows')}
					>
						<AppWindow size={16} />
						<span>Windows</span>
						{#if !loading}
							<span class="tab-count">{windows.length}</span>
						{/if}
					</button>
				</div>

				<div class="source-list">
					{#if loading}
						<div class="source-placeholder">
							<Loader2 size={24} class="spinner" />
							<span>Enumerating capture sources...</span>
						</div>
					{:else if loadError}
						<div class="source-placeholder error">
							<AlertCircle size={24} />
							<span>{loadError}</span>
						</div>
					{:else if activeSources.length === 0}
						<div class="source-placeholder">
							<span>No {activeTab === 'screens' ? 'screens' : 'windows'} found.</span>
						</div>
					{:else}
						{#each activeSources as source (source.index)}
							<button
								type="button"
								class="source-card"
								class:selected={selectedSourceIndex === source.index &&
									selectedSourceType === (source.type === 'Monitor' ? 'monitor' : 'window')}
								onclick={() => selectSource(source)}
							>
								<div class="source-icon">
									{#if source.type === 'Monitor'}
										<Monitor size={20} />
									{:else}
										<AppWindow size={20} />
									{/if}
								</div>
								<div class="source-info">
									<span class="source-name">
										{#if source.type === 'Monitor'}
											{source.name || `Display ${source.index + 1}`}
										{:else}
											{source.title || 'Untitled Window'}
										{/if}
									</span>
									<span class="source-meta">
										{#if source.type === 'Monitor'}
											{source.width}&times;{source.height} &middot; {source.refresh_rate} Hz
										{:else}
											{source.process_name}
										{/if}
									</span>
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</div>

			<!-- Resolution -->
			<div class="input-group">
				<span class="field-label">Resolution</span>
				<div class="btn-group">
					{#each resolutions as res (res.id)}
						<button
							type="button"
							class="seg-btn"
							class:selected={selectedResolution === res.id}
							onclick={() => (selectedResolution = res.id)}
						>
							{res.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Frame Rate -->
			<div class="input-group">
				<span class="field-label">Frame Rate</span>
				<div class="btn-group">
					{#each fpsOptions as opt (opt.value)}
						<button
							type="button"
							class="seg-btn"
							class:selected={selectedFps === opt.value}
							onclick={() => (selectedFps = opt.value)}
						>
							{opt.label} fps
						</button>
					{/each}
				</div>
			</div>

			<label class="audio-toggle">
				<input type="checkbox" bind:checked={shareAudio} />
				<span class="toggle-label">Share Audio</span>
			</label>
		</div>

		<div class="actions">
			<button class="btn btn-secondary" onclick={onclose}>Cancel</button>
			<button class="btn btn-primary" disabled={!canShare} onclick={handleShare}>
				Share Screen
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
		background: rgba(28, 28, 30, 0.75);
		backdrop-filter: blur(50px) saturate(180%);
		-webkit-backdrop-filter: blur(50px) saturate(180%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 20px;
		box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6);
		width: 560px;
		max-width: calc(100vw - 40px);
		max-height: calc(100vh - 40px);
		padding: 36px;
		transform: scale(0.92);
		opacity: 0;
		transition:
			transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
			opacity 0.25s ease;
		overflow-y: auto;
	}
	.modal.visible {
		transform: scale(1);
		opacity: 1;
	}

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
		color: var(--accent-blue, #0a84ff);
	}

	#ss-modal-title {
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

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Tab bar */
	.tab-bar {
		display: flex;
		gap: 4px;
		background: rgba(0, 0, 0, 0.25);
		border-radius: 12px;
		padding: 4px;
	}

	.tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 16px;
		border-radius: 10px;
		border: none;
		background: transparent;
		color: rgba(255, 255, 255, 0.5);
		font-size: 14px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.tab-btn:hover {
		color: rgba(255, 255, 255, 0.7);
		background: rgba(255, 255, 255, 0.04);
	}
	.tab-btn.active {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.95);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.tab-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		height: 20px;
		padding: 0 6px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.08);
		font-size: 11px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.5);
	}
	.tab-btn.active .tab-count {
		background: rgba(10, 132, 255, 0.2);
		color: var(--accent-blue, #0a84ff);
	}

	/* Source list */
	.source-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 200px;
		overflow-y: auto;
		padding: 2px;
	}
	.source-list::-webkit-scrollbar {
		width: 6px;
	}
	.source-list::-webkit-scrollbar-track {
		background: transparent;
	}
	.source-list::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}
	.source-list::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.source-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 32px 16px;
		color: rgba(255, 255, 255, 0.4);
		font-size: 13px;
		text-align: center;
	}
	.source-placeholder.error {
		color: rgba(255, 100, 100, 0.7);
	}

	/* Spinner animation for the loading icon */
	.source-placeholder :global(.spinner) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.source-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.15s ease;
		font-family: inherit;
		text-align: left;
		width: 100%;
	}
	.source-card:hover {
		background: rgba(0, 0, 0, 0.35);
		border-color: rgba(255, 255, 255, 0.12);
	}
	.source-card.selected {
		background: rgba(10, 132, 255, 0.12);
		border-color: rgba(10, 132, 255, 0.45);
	}

	.source-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.05);
		color: rgba(255, 255, 255, 0.5);
		flex-shrink: 0;
	}
	.source-card.selected .source-icon {
		background: rgba(10, 132, 255, 0.15);
		color: var(--accent-blue, #0a84ff);
	}

	.source-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.source-name {
		font-size: 14px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.85);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.source-card.selected .source-name {
		color: rgba(255, 255, 255, 0.95);
	}

	.source-meta {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.35);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.source-card.selected .source-meta {
		color: rgba(10, 132, 255, 0.65);
	}

	/* Segmented button group */
	.btn-group {
		display: flex;
		gap: 0;
		background: rgba(0, 0, 0, 0.25);
		border-radius: 12px;
		padding: 4px;
	}

	.seg-btn {
		flex: 1;
		padding: 10px 12px;
		border-radius: 10px;
		border: none;
		background: transparent;
		color: rgba(255, 255, 255, 0.5);
		font-size: 14px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}
	.seg-btn:hover {
		color: rgba(255, 255, 255, 0.7);
		background: rgba(255, 255, 255, 0.04);
	}
	.seg-btn.selected {
		background: rgba(10, 132, 255, 0.15);
		color: var(--accent-blue, #0a84ff);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	/* Audio toggle */
	.audio-toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		padding: 4px 0;
	}
	.audio-toggle input[type='checkbox'] {
		width: 18px;
		height: 18px;
		accent-color: var(--accent-blue, #0a84ff);
		cursor: pointer;
	}
	.toggle-label {
		font-size: 14px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.8);
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
	}
	.btn-secondary {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.8);
	}
	.btn-secondary:hover {
		background: rgba(255, 255, 255, 0.12);
	}
	.btn-primary {
		background: var(--accent-blue, #0a84ff);
		color: white;
	}
	.btn-primary:hover:not(:disabled) {
		background: var(--accent-blue-hover, #2e96ff);
		box-shadow: 0 4px 16px rgba(10, 132, 255, 0.4);
	}
	.btn-primary:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
