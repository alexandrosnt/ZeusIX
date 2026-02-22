<script lang="ts">
	import { X, Megaphone } from 'lucide-svelte';
	import { channelsStore } from '$lib/stores/channels.svelte';
	import { whisperStore } from '$lib/stores/whisper.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';

	interface Props {
		serverId: string;
		onclose: () => void;
	}

	let { serverId, onclose }: Props = $props();

	let visible = $state(false);

	$effect(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	let voiceChannels = $derived(
		channelsStore.channels.filter((c) => c.channel_type === 'voice')
	);

	let selectedCount = $derived(
		voiceChannels.filter((c) => whisperStore.isTarget(serverId, c.id)).length
	);

	function codeToLabel(code: string): string {
		if (code.startsWith('Key')) return code.slice(3);
		if (code.startsWith('Digit')) return code.slice(5);
		const map: Record<string, string> = {
			Space: 'Space', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift',
			ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl',
			AltLeft: 'Left Alt', AltRight: 'Right Alt',
			Tab: 'Tab', CapsLock: 'Caps Lock', Backspace: 'Backspace',
			Enter: 'Enter', Backquote: '`', Minus: '-', Equal: '=',
			BracketLeft: '[', BracketRight: ']', Backslash: '\\',
			Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/'
		};
		return map[code] ?? code;
	}

	function selectAll() {
		whisperStore.setTargets(serverId, voiceChannels.map((c) => c.id));
	}

	function clearAll() {
		whisperStore.setTargets(serverId, []);
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" class:visible role="presentation" onclick={handleOverlayClick}>
	<div class="modal" class:visible role="dialog" aria-modal="true" aria-labelledby="whisper-title">
		<button class="close-btn" onclick={onclose} aria-label="Close">
			<X size={18} />
		</button>

		<div class="header">
			<div class="header-icon">
				<Megaphone size={24} />
			</div>
			<div>
				<h2 id="whisper-title">Whisper Broadcast</h2>
				<p class="subtitle">Select channels to broadcast your voice into</p>
			</div>
		</div>

		<div class="body">
			<div class="actions-row">
				<button class="action-btn" onclick={selectAll}>Select All</button>
				<button class="action-btn" onclick={clearAll}>Clear All</button>
				<span class="count">{selectedCount}/{voiceChannels.length} selected</span>
			</div>

			{#if voiceChannels.length === 0}
				<p class="empty">No voice channels in this server.</p>
			{:else}
				<div class="channel-list">
					{#each voiceChannels as channel (channel.id)}
						{@const checked = whisperStore.isTarget(serverId, channel.id)}
						<label class="channel-row" class:checked>
							<input
								type="checkbox"
								{checked}
								onchange={() => whisperStore.toggleTarget(serverId, channel.id)}
							/>
							<span class="channel-name">{channel.name}</span>
						</label>
					{/each}
				</div>
			{/if}

			<div class="keybind-note">
				<span class="keybind-label">Whisper Key:</span>
				<span class="keybind-value">{codeToLabel(settingsStore.whisperKeybind)}</span>
				<span class="keybind-hint">(change in User Settings)</span>
			</div>
		</div>

		<div class="footer">
			<button class="done-btn" onclick={onclose}>Done</button>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		opacity: 0;
		transition: opacity 0.2s ease;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, sans-serif;
	}

	.overlay.visible {
		opacity: 1;
	}

	.modal {
		width: 440px;
		max-height: 80vh;
		background: rgba(30, 30, 34, 0.95);
		backdrop-filter: blur(40px);
		-webkit-backdrop-filter: blur(40px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
		transform: scale(0.95) translateY(10px);
		opacity: 0;
		transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
	}

	.modal.visible {
		transform: scale(1) translateY(0);
		opacity: 1;
	}

	.close-btn {
		position: absolute;
		top: 16px;
		right: 16px;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.5);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s ease, color 0.15s ease;
		z-index: 10;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		color: rgba(255, 255, 255, 0.9);
	}

	.header {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 24px 24px 0;
	}

	.header-icon {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.15);
		color: var(--accent-blue, #0a84ff);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.header h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
	}

	.subtitle {
		margin: 2px 0 0;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.4);
	}

	.body {
		padding: 20px 24px;
		overflow-y: auto;
		flex: 1;
	}

	.actions-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}

	.action-btn {
		padding: 5px 12px;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.04);
		color: rgba(255, 255, 255, 0.7);
		font-size: 12px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.action-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.9);
	}

	.count {
		margin-left: auto;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.35);
	}

	.empty {
		color: rgba(255, 255, 255, 0.3);
		font-size: 14px;
		text-align: center;
		padding: 20px 0;
	}

	.channel-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.channel-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 8px;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.channel-row:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.channel-row.checked {
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.08);
	}

	.channel-row input[type='checkbox'] {
		width: 18px;
		height: 18px;
		accent-color: var(--accent-blue, #0a84ff);
		cursor: pointer;
		flex-shrink: 0;
	}

	.channel-name {
		font-size: 14px;
		color: rgba(255, 255, 255, 0.85);
		font-weight: 500;
	}

	.keybind-note {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 16px;
		padding: 10px 12px;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.keybind-label {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.5);
		font-weight: 600;
	}

	.keybind-value {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.9);
		font-weight: 600;
		padding: 2px 8px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 4px;
	}

	.keybind-hint {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.3);
	}

	.footer {
		padding: 16px 24px;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		justify-content: flex-end;
	}

	.done-btn {
		padding: 8px 24px;
		border-radius: 8px;
		border: none;
		background: var(--accent-blue, #0a84ff);
		color: white;
		font-size: 14px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.done-btn:hover {
		opacity: 0.85;
	}

	.body::-webkit-scrollbar {
		width: 6px;
	}

	.body::-webkit-scrollbar-track {
		background: transparent;
	}

	.body::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}
</style>
