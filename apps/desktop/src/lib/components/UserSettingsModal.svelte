<script lang="ts">
	import { X } from 'lucide-svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import type { UserSettings } from '$lib/stores/settings.svelte';
	const lk = () => import('$lib/services/livekit').then(m => m.livekit);

	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	// --- Local UI State ---
	let visible = $state(false);
	type Tab = 'appearance' | 'voice' | 'text' | 'privacy';
	let activeTab: Tab = $state('appearance');
	let listeningForKey = $state(false);
	let mediaDevices = $state<MediaDeviceInfo[]>([]);

	// --- Derived ---
	let inputDevices = $derived(mediaDevices.filter((d) => d.kind === 'audioinput'));
	let outputDevices = $derived(mediaDevices.filter((d) => d.kind === 'audiooutput'));
	let videoDevices = $derived(mediaDevices.filter((d) => d.kind === 'videoinput'));

	// --- Constants ---
	const ACCENT_COLORS = [
		{ label: 'Blue', value: '#0a84ff' },
		{ label: 'Purple', value: '#bf5af2' },
		{ label: 'Green', value: '#30d158' },
		{ label: 'Orange', value: '#ff9f0a' },
		{ label: 'Pink', value: '#ff375f' },
		{ label: 'Red', value: '#ff453a' }
	];

	const THEME_PREVIEWS: { key: UserSettings['theme']; label: string; bg: string; sidebar: string; content: string }[] = [
		{ key: 'dark', label: 'Dark', bg: '#1e1e22', sidebar: '#16161a', content: '#2a2a2e' },
		{ key: 'midnight', label: 'Midnight', bg: '#0d1117', sidebar: '#010409', content: '#161b22' },
		{ key: 'amoled', label: 'AMOLED', bg: '#000000', sidebar: '#000000', content: '#0a0a0a' }
	];

	const FONT_FAMILIES: { key: UserSettings['chatFontFamily']; label: string; stack: string }[] = [
		{
			key: 'system',
			label: 'System',
			stack: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, sans-serif"
		},
		{
			key: 'mono',
			label: 'Monospace',
			stack: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace"
		},
		{
			key: 'serif',
			label: 'Serif',
			stack: "Georgia, 'Times New Roman', serif"
		}
	];

	const AUTO_DELETE_OPTIONS: { value: UserSettings['autoDeleteMessages']; label: string }[] = [
		{ value: 'never', label: 'Never' },
		{ value: '24h', label: '24 Hours' },
		{ value: '7d', label: '7 Days' },
		{ value: '30d', label: '30 Days' }
	];

	// --- Font stack helper ---
	function getFontStack(family: UserSettings['chatFontFamily']): string {
		return FONT_FAMILIES.find((f) => f.key === family)?.stack ?? FONT_FAMILIES[0].stack;
	}

	// --- Key code label helper ---
	function codeToLabel(code: string): string {
		if (code.startsWith('Key')) return code.slice(3);
		if (code.startsWith('Digit')) return code.slice(5);
		if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
		if (code.startsWith('Arrow')) return code.slice(5) + ' Arrow';
		const map: Record<string, string> = {
			Space: 'Space',
			ShiftLeft: 'Left Shift',
			ShiftRight: 'Right Shift',
			ControlLeft: 'Left Ctrl',
			ControlRight: 'Right Ctrl',
			AltLeft: 'Left Alt',
			AltRight: 'Right Alt',
			MetaLeft: 'Left Meta',
			MetaRight: 'Right Meta',
			Tab: 'Tab',
			CapsLock: 'Caps Lock',
			Backspace: 'Backspace',
			Enter: 'Enter',
			Backquote: '`',
			Minus: '-',
			Equal: '=',
			BracketLeft: '[',
			BracketRight: ']',
			Backslash: '\\',
			Semicolon: ';',
			Quote: "'",
			Comma: ',',
			Period: '.',
			Slash: '/'
		};
		return map[code] ?? code;
	}

	// --- Entrance Animation ---
	$effect(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	// --- Enumerate Media Devices (audio + video) ---
	$effect(() => {
		async function enumerate() {
			try {
				// Request permissions so device labels are populated
				try {
					const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
					stream.getTracks().forEach((t) => t.stop());
				} catch {
					// Permission denied or no devices — still enumerate what we can
				}
				const devices = await navigator.mediaDevices.enumerateDevices();
				mediaDevices = devices;
			} catch {
				mediaDevices = [];
			}
		}
		enumerate();
	});

	// --- Event Handlers ---
	function handleKeydown(e: KeyboardEvent) {
		if (listeningForKey) {
			e.preventDefault();
			e.stopPropagation();
			if (e.code === 'Escape') {
				listeningForKey = false;
				return;
			}
			settingsStore.update({ pttKeybind: e.code });
			listeningForKey = false;
			return;
		}
		if (e.key === 'Escape') onclose();
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" class:visible role="presentation" onclick={handleOverlayClick}>
	<div class="modal" class:visible role="dialog" aria-modal="true" aria-labelledby="user-settings-title">
		<!-- Close Button -->
		<button class="close-btn" onclick={onclose} aria-label="Close settings">
			<X size={18} />
		</button>

		<div class="layout">
			<!-- Sidebar -->
			<nav class="sidebar">
				<h2 id="user-settings-title" class="sidebar-title">User Settings</h2>
				<span class="sidebar-subtitle">Preferences</span>

				<div class="sidebar-tabs">
					<button
						class="tab-item"
						class:active={activeTab === 'appearance'}
						onclick={() => (activeTab = 'appearance')}
					>
						Appearance
					</button>
					<button
						class="tab-item"
						class:active={activeTab === 'voice'}
						onclick={() => (activeTab = 'voice')}
					>
						Voice & Video
					</button>
					<button
						class="tab-item"
						class:active={activeTab === 'text'}
						onclick={() => (activeTab = 'text')}
					>
						Text & Display
					</button>
					<button
						class="tab-item"
						class:active={activeTab === 'privacy'}
						onclick={() => (activeTab = 'privacy')}
					>
						Privacy & Security
					</button>
				</div>

				<div class="sidebar-footer">
					<button class="btn-danger-outline" onclick={() => settingsStore.reset()}>
						Reset All Settings
					</button>
				</div>
			</nav>

			<!-- Content -->
			<div class="content">
				{#if activeTab === 'appearance'}
					<!-- APPEARANCE TAB -->
					<div class="content-header">
						<h3 class="content-title">Appearance</h3>
					</div>

					<div class="content-body">
						<!-- Theme -->
						<div class="field-group">
							<span class="field-label">Theme</span>
							<div class="theme-cards">
								{#each THEME_PREVIEWS as theme (theme.key)}
									<button
										class="theme-card"
										class:selected={settingsStore.theme === theme.key}
										style:--accent={settingsStore.accentColor}
										onclick={() => settingsStore.update({ theme: theme.key })}
									>
										<div class="theme-preview">
											<div class="theme-preview-sidebar" style:background={theme.sidebar}></div>
											<div class="theme-preview-content" style:background={theme.content}>
												<div class="theme-preview-line"></div>
												<div class="theme-preview-line short"></div>
											</div>
										</div>
										<span class="theme-card-label">{theme.label}</span>
									</button>
								{/each}
							</div>
						</div>

						<!-- Accent Color -->
						<div class="field-group">
							<span class="field-label">Accent Color</span>
							<div class="color-swatches">
								{#each ACCENT_COLORS as color (color.value)}
									<button
										class="color-swatch"
										class:selected={settingsStore.accentColor === color.value}
										style:background={color.value}
										onclick={() => settingsStore.update({ accentColor: color.value })}
										aria-label="Select {color.label}"
									></button>
								{/each}
							</div>
						</div>

						<!-- Minimize to Tray -->
						<div class="toggle-group">
							<div class="toggle-info">
								<span class="toggle-label">Minimize to Tray</span>
								<span class="toggle-description">Close button minimizes to system tray instead of quitting</span>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={settingsStore.minimizeToTray}
								aria-label="Toggle minimize to tray"
								class="toggle"
								class:active={settingsStore.minimizeToTray}
								onclick={() => settingsStore.update({ minimizeToTray: !settingsStore.minimizeToTray })}
							>
								<span class="toggle-knob"></span>
							</button>
						</div>
					</div>

				{:else if activeTab === 'voice'}
					<!-- VOICE & VIDEO TAB -->
					<div class="content-header">
						<h3 class="content-title">Voice & Video</h3>
					</div>

					<div class="content-body">
						<!-- Input Mode -->
						<div class="field-group">
							<span class="field-label">Input Mode</span>
							<div class="radio-cards">
								<button
									class="radio-card"
									class:selected={settingsStore.inputMode === 'voice_activity'}
									onclick={() => { settingsStore.update({ inputMode: 'voice_activity' }); lk().then(s => s.switchInputMode()); }}
								>
									<span class="radio-card-title">Voice Activity</span>
									<span class="radio-card-desc">Automatically transmit when you speak</span>
								</button>
								<button
									class="radio-card"
									class:selected={settingsStore.inputMode === 'push_to_talk'}
									onclick={() => { settingsStore.update({ inputMode: 'push_to_talk' }); lk().then(s => s.switchInputMode()); }}
								>
									<span class="radio-card-title">Push to Talk</span>
									<span class="radio-card-desc">Hold a key to transmit</span>
								</button>
							</div>
						</div>

						<!-- Voice Activity: Sensitivity Slider -->
						{#if settingsStore.inputMode === 'voice_activity'}
							<div class="range-group">
								<div class="range-header">
									<span class="range-label">Sensitivity</span>
									<span class="range-value">{settingsStore.voiceActivityThreshold}%</span>
								</div>
								<input
									type="range"
									min="0"
									max="100"
									step="1"
									value={settingsStore.voiceActivityThreshold}
									oninput={(e) => settingsStore.update({ voiceActivityThreshold: Number(e.currentTarget.value) })}
									style:--accent={settingsStore.accentColor}
								/>
							</div>
						{/if}

						<!-- Push to Talk: Keybind -->
						{#if settingsStore.inputMode === 'push_to_talk'}
							<div class="field-group">
								<span class="field-label">Keybind</span>
								<button
									class="keybind-btn"
									class:listening={listeningForKey}
									onclick={() => (listeningForKey = true)}
								>
									{#if listeningForKey}
										Press a key...
									{:else}
										{codeToLabel(settingsStore.pttKeybind)}
									{/if}
								</button>
							</div>
						{/if}

						<!-- Input Device -->
						<div class="select-group">
							<label for="input-device-select">Input Device</label>
							<select
								id="input-device-select"
								value={settingsStore.inputDevice}
								onchange={(e) => {
									const deviceId = e.currentTarget.value;
									settingsStore.update({ inputDevice: deviceId });
									lk().then(s => s.switchInputDevice(deviceId));
								}}
							>
								<option value="default">Default</option>
								{#each inputDevices as device (device.deviceId)}
									<option value={device.deviceId}>
										{device.label || `Microphone (${device.deviceId.slice(0, 8)})`}
									</option>
								{/each}
							</select>
						</div>

						<!-- Output Device -->
						<div class="select-group">
							<label for="output-device-select">Output Device</label>
							<select
								id="output-device-select"
								value={settingsStore.outputDevice}
								onchange={(e) => {
									const deviceId = e.currentTarget.value;
									settingsStore.update({ outputDevice: deviceId });
									lk().then(s => s.switchOutputDevice(deviceId));
								}}
							>
								<option value="default">Default</option>
								{#each outputDevices as device (device.deviceId)}
									<option value={device.deviceId}>
										{device.label || `Speaker (${device.deviceId.slice(0, 8)})`}
									</option>
								{/each}
							</select>
						</div>

						<!-- Input Volume -->
						<div class="range-group">
							<div class="range-header">
								<span class="range-label">Input Volume</span>
								<span class="range-value">{settingsStore.inputVolume}%</span>
							</div>
							<input
								type="range"
								min="0"
								max="200"
								step="1"
								value={settingsStore.inputVolume}
								oninput={(e) => settingsStore.update({ inputVolume: Number(e.currentTarget.value) })}
								style:--accent={settingsStore.accentColor}
							/>
						</div>

						<!-- Output Volume -->
						<div class="range-group">
							<div class="range-header">
								<span class="range-label">Output Volume</span>
								<span class="range-value">{settingsStore.outputVolume}%</span>
							</div>
							<input
								type="range"
								min="0"
								max="200"
								step="1"
								value={settingsStore.outputVolume}
								oninput={(e) => settingsStore.update({ outputVolume: Number(e.currentTarget.value) })}
								style:--accent={settingsStore.accentColor}
							/>
						</div>

						<!-- Camera -->
						<div class="select-group">
							<label for="camera-device-select">Camera</label>
							<select id="camera-device-select">
								<option value="default">Default</option>
								{#each videoDevices as device (device.deviceId)}
									<option value={device.deviceId}>
										{device.label || `Camera (${device.deviceId.slice(0, 8)})`}
									</option>
								{/each}
							</select>
						</div>
					</div>

				{:else if activeTab === 'text'}
					<!-- TEXT & DISPLAY TAB -->
					<div class="content-header">
						<h3 class="content-title">Text & Display</h3>
					</div>

					<div class="content-body">
						<!-- Chat Font Size -->
						<div class="range-group">
							<div class="range-header">
								<span class="range-label">Chat Font Size</span>
								<span class="range-value">{settingsStore.chatFontSize}px</span>
							</div>
							<input
								type="range"
								min="12"
								max="24"
								step="1"
								value={settingsStore.chatFontSize}
								oninput={(e) => settingsStore.update({ chatFontSize: Number(e.currentTarget.value) })}
								style:--accent={settingsStore.accentColor}
							/>
							<p
								class="font-preview"
								style:font-size="{settingsStore.chatFontSize}px"
								style:font-family={getFontStack(settingsStore.chatFontFamily)}
							>
								The quick brown fox jumps over the lazy dog.
							</p>
						</div>

						<!-- Chat Font Family -->
						<div class="field-group">
							<span class="field-label">Chat Font Family</span>
							<div class="radio-cards">
								{#each FONT_FAMILIES as font (font.key)}
									<button
										class="radio-card"
										class:selected={settingsStore.chatFontFamily === font.key}
										onclick={() => settingsStore.update({ chatFontFamily: font.key })}
									>
										<span class="radio-card-title">{font.label}</span>
										<span class="radio-card-font-preview" style:font-family={font.stack}>
											Aa Bb Cc 123
										</span>
									</button>
								{/each}
							</div>
						</div>

							<!-- Compact Mode -->
						<div class="toggle-group">
							<div class="toggle-info">
								<span class="toggle-label">Compact Mode</span>
								<span class="toggle-description">Reduce spacing between messages</span>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={settingsStore.compactMode}
								aria-label="Toggle compact mode"
								class="toggle"
								class:active={settingsStore.compactMode}
								onclick={() => settingsStore.update({ compactMode: !settingsStore.compactMode })}
							>
								<span class="toggle-knob"></span>
							</button>
						</div>
					</div>

				{:else if activeTab === 'privacy'}
					<!-- PRIVACY & SECURITY TAB -->
					<div class="content-header">
						<h3 class="content-title">Privacy & Security</h3>
					</div>

					<div class="content-body">
						<!-- Show Online Status -->
						<div class="toggle-group">
							<div class="toggle-info">
								<span class="toggle-label">Show Online Status</span>
								<span class="toggle-description">Let others see when you're online</span>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={settingsStore.showOnlineStatus}
								aria-label="Toggle show online status"
								class="toggle"
								class:active={settingsStore.showOnlineStatus}
								onclick={() => settingsStore.update({ showOnlineStatus: !settingsStore.showOnlineStatus })}
							>
								<span class="toggle-knob"></span>
							</button>
						</div>

						<!-- Show Read Receipts -->
						<div class="toggle-group">
							<div class="toggle-info">
								<span class="toggle-label">Show Read Receipts</span>
								<span class="toggle-description">Show when you've read messages</span>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={settingsStore.showReadReceipts}
								aria-label="Toggle read receipts"
								class="toggle"
								class:active={settingsStore.showReadReceipts}
								onclick={() => settingsStore.update({ showReadReceipts: !settingsStore.showReadReceipts })}
							>
								<span class="toggle-knob"></span>
							</button>
						</div>

						<!-- Allow DMs from Server Members -->
						<div class="toggle-group">
							<div class="toggle-info">
								<span class="toggle-label">Allow DMs from Server Members</span>
								<span class="toggle-description">Allow strangers to message you</span>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={settingsStore.allowDmFromServerMembers}
								aria-label="Toggle allow DMs from server members"
								class="toggle"
								class:active={settingsStore.allowDmFromServerMembers}
								onclick={() => settingsStore.update({ allowDmFromServerMembers: !settingsStore.allowDmFromServerMembers })}
							>
								<span class="toggle-knob"></span>
							</button>
						</div>

						<!-- Hide Typing Indicator -->
						<div class="toggle-group">
							<div class="toggle-info">
								<span class="toggle-label">Hide Typing Indicator</span>
								<span class="toggle-description">Don't broadcast when you're typing</span>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={settingsStore.hideTypingIndicator}
								aria-label="Toggle hide typing indicator"
								class="toggle"
								class:active={settingsStore.hideTypingIndicator}
								onclick={() => settingsStore.update({ hideTypingIndicator: !settingsStore.hideTypingIndicator })}
							>
								<span class="toggle-knob"></span>
							</button>
						</div>

						<!-- Auto-Delete Local Messages -->
						<div class="select-group">
							<label for="auto-delete-select">Auto-Delete Local Messages</label>
							<select
								id="auto-delete-select"
								value={settingsStore.autoDeleteMessages}
								onchange={(e) => settingsStore.update({ autoDeleteMessages: e.currentTarget.value as UserSettings['autoDeleteMessages'] })}
							>
								{#each AUTO_DELETE_OPTIONS as opt (opt.value)}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</div>

						<!-- Block Server Invites -->
						<div class="toggle-group">
							<div class="toggle-info">
								<span class="toggle-label">Block Server Invites</span>
								<span class="toggle-description">Automatically block server invites</span>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={settingsStore.blockInvites}
								aria-label="Toggle block server invites"
								class="toggle"
								class:active={settingsStore.blockInvites}
								onclick={() => settingsStore.update({ blockInvites: !settingsStore.blockInvites })}
							>
								<span class="toggle-knob"></span>
							</button>
						</div>
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

	.sidebar-footer {
		margin-top: auto;
		padding-top: 16px;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
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
		background: rgba(var(--accent-rgb), 0.15);
		color: var(--accent-blue);
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

	/* ===== Field Group ===== */
	.field-group {
		margin-bottom: 24px;
	}

	.field-label {
		display: block;
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 10px;
	}

	/* ===== Theme Cards ===== */
	.theme-cards {
		display: flex;
		gap: 12px;
	}

	.theme-card {
		flex: 1;
		padding: 0;
		border: 2px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.2);
		cursor: pointer;
		overflow: hidden;
		transition:
			border-color 0.2s ease,
			transform 0.15s ease;
		font-family: inherit;
		color: rgba(235, 235, 245, 0.8);
	}

	.theme-card:hover {
		border-color: rgba(255, 255, 255, 0.15);
		transform: translateY(-1px);
	}

	.theme-card.selected {
		border-color: var(--accent, #0a84ff);
	}

	.theme-preview {
		display: flex;
		height: 64px;
		margin: 8px;
		border-radius: 6px;
		overflow: hidden;
	}

	.theme-preview-sidebar {
		width: 24px;
		flex-shrink: 0;
	}

	.theme-preview-content {
		flex: 1;
		padding: 10px 8px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.theme-preview-line {
		height: 4px;
		background: rgba(255, 255, 255, 0.12);
		border-radius: 2px;
		width: 100%;
	}

	.theme-preview-line.short {
		width: 60%;
	}

	.theme-card-label {
		display: block;
		padding: 8px 0 10px;
		font-size: 13px;
		font-weight: 600;
		text-align: center;
	}

	/* ===== Color Swatches ===== */
	.color-swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.color-swatch {
		width: 32px;
		height: 32px;
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

	/* ===== Toggle ===== */
	.toggle-group {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 14px;
		border: 1px solid rgba(255, 255, 255, 0.06);
		margin-bottom: 8px;
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

	/* ===== Radio Cards ===== */
	.radio-cards {
		display: flex;
		gap: 10px;
	}

	.radio-card {
		flex: 1;
		padding: 14px 16px;
		border: 2px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.2);
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			background 0.15s ease;
		text-align: left;
		font-family: inherit;
		color: inherit;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.radio-card:hover {
		background: rgba(0, 0, 0, 0.3);
		border-color: rgba(255, 255, 255, 0.15);
	}

	.radio-card.selected {
		border-color: var(--accent-blue);
		background: rgba(var(--accent-rgb), 0.08);
	}

	.radio-card-title {
		font-size: 14px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.9);
	}

	.radio-card-desc {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
	}

	.radio-card-font-preview {
		font-size: 16px;
		color: rgba(255, 255, 255, 0.5);
		margin-top: 4px;
	}

	/* ===== Range Sliders ===== */
	.range-group {
		margin-bottom: 20px;
	}

	.range-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.range-label {
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.range-value {
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.9);
		font-variant-numeric: tabular-nums;
	}

	.range-group input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 6px;
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.1);
		outline: none;
		cursor: pointer;
	}

	.range-group input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent, #0a84ff);
		cursor: pointer;
		border: 2px solid rgba(255, 255, 255, 0.9);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
		transition: transform 0.1s ease;
	}

	.range-group input[type='range']::-webkit-slider-thumb:hover {
		transform: scale(1.15);
	}

	.range-group input[type='range']::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent, #0a84ff);
		cursor: pointer;
		border: 2px solid rgba(255, 255, 255, 0.9);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
	}

	/* ===== Select Dropdowns ===== */
	.select-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 20px;
	}

	.select-group label {
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.select-group select {
		width: 100%;
		padding: 10px 14px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		color: rgba(255, 255, 255, 0.95);
		font-size: 14px;
		font-family: inherit;
		outline: none;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 14px center;
		padding-right: 36px;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.select-group select:focus {
		border-color: var(--accent-blue);
		box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.25);
	}

	.select-group select option {
		background: #1e1e22;
		color: rgba(255, 255, 255, 0.95);
	}

	/* ===== Keybind Button ===== */
	.keybind-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 10px 20px;
		min-width: 140px;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		color: rgba(255, 255, 255, 0.9);
		font-size: 14px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			box-shadow 0.2s ease;
	}

	.keybind-btn:hover {
		border-color: rgba(255, 255, 255, 0.2);
		background: rgba(0, 0, 0, 0.5);
	}

	.keybind-btn.listening {
		border-color: var(--accent-blue);
		box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.25);
		color: var(--accent-blue);
		animation: keybind-pulse 1.5s ease-in-out infinite;
	}

	@keyframes keybind-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.25);
		}
		50% {
			box-shadow: 0 0 0 6px rgba(var(--accent-rgb), 0.15);
		}
	}

	/* ===== Font Preview ===== */
	.font-preview {
		margin-top: 10px;
		color: rgba(255, 255, 255, 0.6);
		line-height: 1.5;
	}

	/* ===== Danger Outline Button ===== */
	.btn-danger-outline {
		width: 100%;
		padding: 8px 16px;
		border-radius: 10px;
		border: 1px solid rgba(255, 69, 58, 0.4);
		background: transparent;
		color: #ff453a;
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease;
	}

	.btn-danger-outline:hover {
		background: rgba(255, 69, 58, 0.1);
		border-color: rgba(255, 69, 58, 0.6);
	}

	/* ===== Scrollbar ===== */
	.content-body::-webkit-scrollbar {
		width: 6px;
	}

	.content-body::-webkit-scrollbar-track {
		background: transparent;
	}

	.content-body::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}

	.content-body::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.2);
	}
</style>
