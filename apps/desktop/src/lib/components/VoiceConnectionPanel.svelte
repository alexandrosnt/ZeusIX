<script lang="ts">
	import { PhoneOff } from 'lucide-svelte';
	import { voiceStore } from '$lib/stores/voice.svelte';
	import { channelsStore } from '$lib/stores/channels.svelte';

	let { ondisconnect, label, showServer = true, onclick }: { ondisconnect: () => void; label?: string; showServer?: boolean; onclick?: () => void } = $props();

	let showStats = $state(false);
	let panelEl: HTMLDivElement | undefined = $state(undefined);

	let channelName = $derived(
		label ?? channelsStore.channels.find((c) => c.id === voiceStore.channelId)?.name ?? 'Voice Channel'
	);

	let statusConfig = $derived.by(() => {
		switch (voiceStore.rtcStatus) {
			case 'connected':
				return { dot: 'dot-green', label: 'Voice Connected', labelClass: 'label-green' };
			case 'connecting':
				return { dot: 'dot-yellow', label: 'RTC Connecting', labelClass: 'label-yellow' };
			case 'failed':
				return { dot: 'dot-red', label: 'Connection Failed', labelClass: 'label-red' };
			default:
				return { dot: 'dot-gray', label: 'Idle', labelClass: 'label-gray' };
		}
	});

	let latencyMs = $derived(voiceStore.stats.latencyMs);

	let signalInfo = $derived.by(() => {
		if (latencyMs === 0) {
			return { bars: 0, color: 'signal-gray', display: '' };
		}
		if (latencyMs < 100) {
			return { bars: 5, color: 'signal-green', display: `${latencyMs} ms` };
		}
		if (latencyMs < 200) {
			return { bars: 4, color: 'signal-green', display: `${latencyMs} ms` };
		}
		if (latencyMs < 300) {
			return { bars: 3, color: 'signal-yellow', display: `${latencyMs} ms` };
		}
		if (latencyMs < 500) {
			return { bars: 2, color: 'signal-orange', display: `${latencyMs} ms` };
		}
		return { bars: 1, color: 'signal-red', display: `${latencyMs} ms` };
	});

	function toggleStats() {
		showStats = !showStats;
	}

	function handleClickOutside(event: MouseEvent) {
		if (panelEl && !panelEl.contains(event.target as Node)) {
			showStats = false;
		}
	}

	$effect(() => {
		if (showStats) {
			document.addEventListener('click', handleClickOutside, true);
			return () => {
				document.removeEventListener('click', handleClickOutside, true);
			};
		}
	});
</script>

<div class="voice-panel" bind:this={panelEl}>
	{#if showStats}
		<div class="stats-popup">
			<div class="stats-header">
				<span class="stats-title">Connection Info</span>
				<button class="stats-close" onclick={() => (showStats = false)} aria-label="Close stats">
					&times;
				</button>
			</div>
			<div class="stats-grid">
				<span class="stats-label">Ping</span>
				<span class="stats-value">{voiceStore.stats.latencyMs} ms</span>

				<span class="stats-label">Codec</span>
				<span class="stats-value">{voiceStore.stats.codec}</span>

				<span class="stats-label">Packet Loss</span>
				<span class="stats-value">{voiceStore.stats.packetLoss}%</span>

				<span class="stats-label">Jitter</span>
				<span class="stats-value">{voiceStore.stats.jitter} ms</span>

				<span class="stats-label">Bitrate</span>
				<span class="stats-value">{voiceStore.stats.bitrate} kbps</span>

					{#if showServer}
					<span class="stats-label">Server</span>
					<span class="stats-value">{voiceStore.stats.server}</span>
				{/if}
			</div>
		</div>
	{/if}

	<button class="voice-info" onclick={toggleStats} aria-label="Toggle connection stats">
		<!-- Line 1: Status -->
		<div class="voice-status">
			<span class="status-dot {statusConfig.dot}"></span>
			<span class="status-label {statusConfig.labelClass}">{statusConfig.label}</span>
		</div>

		<!-- Line 2: Channel name -->
		<span class="channel-name">{channelName}</span>

		<!-- Line 3: Latency + signal bars -->
		<div class="latency-row">
			<div class="signal-bars {signalInfo.color}">
				{#each { length: 5 } as _, i (i)}
					<div
						class="signal-bar"
						class:active={signalInfo.bars > 0 && i < signalInfo.bars}
						style:height="{6 + i * 3}px"
					></div>
				{/each}
			</div>
			{#if signalInfo.display}
				<span class="latency-text">{signalInfo.display}</span>
			{/if}
		</div>
	</button>

	{#if onclick}
		<button class="goto-btn" onclick={onclick} aria-label="Go to call">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
			</svg>
		</button>
	{/if}

	<button class="disconnect-btn" onclick={ondisconnect} aria-label="Disconnect from voice channel">
		<PhoneOff size={18} />
	</button>
</div>

<style>
	.voice-panel {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		gap: 8px;
		background: rgba(0, 0, 0, 0.25);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'SF Pro Display',
			'Segoe UI',
			Roboto,
			Oxygen,
			Ubuntu,
			sans-serif;
	}

	/* ---- Stats popup ---- */
	.stats-popup {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 8px;
		right: 8px;
		background: rgba(18, 18, 22, 0.92);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		padding: 14px 16px;
		z-index: 100;
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.05) inset;
	}

	.stats-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.stats-title {
		font-size: 12px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.7);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stats-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 6px;
		border: none;
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.5);
		font-size: 16px;
		cursor: pointer;
		line-height: 1;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.stats-close:hover {
		background: rgba(255, 255, 255, 0.12);
		color: rgba(255, 255, 255, 0.8);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 6px 16px;
		align-items: baseline;
	}

	.stats-label {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
		font-weight: 500;
	}

	.stats-value {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.85);
		font-weight: 500;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	/* ---- Voice info button ---- */
	.voice-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
		background: none;
		border: none;
		padding: 2px 4px;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s ease;
	}

	.voice-info:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	/* ---- Status line ---- */
	.voice-status {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dot-green {
		background: #30d158;
		box-shadow: 0 0 6px rgba(48, 209, 88, 0.4);
	}

	.dot-yellow {
		background: #ffd60a;
		box-shadow: 0 0 6px rgba(255, 214, 10, 0.4);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.dot-red {
		background: #ff453a;
		box-shadow: 0 0 6px rgba(255, 69, 58, 0.4);
	}

	.dot-gray {
		background: rgba(255, 255, 255, 0.3);
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.status-label {
		font-size: 13px;
		font-weight: 600;
		line-height: 1;
	}

	.label-green {
		color: #30d158;
	}

	.label-yellow {
		color: #ffd60a;
	}

	.label-red {
		color: #ff453a;
	}

	.label-gray {
		color: rgba(255, 255, 255, 0.4);
	}

	/* ---- Channel name ---- */
	.channel-name {
		color: rgba(255, 255, 255, 0.4);
		font-size: 11px;
		padding-left: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1.2;
	}


	/* ---- Latency row ---- */
	.latency-row {
		display: flex;
		align-items: flex-end;
		gap: 6px;
		padding-left: 14px;
		margin-top: 1px;
	}

	.signal-bars {
		display: flex;
		align-items: flex-end;
		gap: 1.5px;
	}

	.signal-bar {
		width: 3px;
		border-radius: 1px;
		background: rgba(255, 255, 255, 0.12);
		transition: background 0.2s ease;
	}

	.signal-green .signal-bar.active {
		background: #30d158;
	}

	.signal-yellow .signal-bar.active {
		background: #ffd60a;
	}

	.signal-orange .signal-bar.active {
		background: #ff9f0a;
	}

	.signal-red .signal-bar.active {
		background: #ff453a;
	}

	.signal-gray .signal-bar {
		background: rgba(255, 255, 255, 0.12);
	}

	.latency-text {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.45);
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	/* ---- Go-to-call button ---- */
	.goto-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.5);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.goto-btn:hover {
		background: rgba(48, 209, 88, 0.15);
		color: #30d158;
	}

	/* ---- Disconnect button ---- */
	.disconnect-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.5);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.disconnect-btn:hover {
		background: rgba(255, 69, 58, 0.15);
		color: #ff453a;
	}
</style>
