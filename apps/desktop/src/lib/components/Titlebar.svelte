<script lang="ts">
	let isMaximized = $state(false);

	async function getWindow() {
		try {
			const { getCurrentWindow } = await import('@tauri-apps/api/window');
			return getCurrentWindow();
		} catch {
			return null;
		}
	}

	// Track maximize state
	async function checkMaximized() {
		try {
			const win = await getWindow();
			if (win) isMaximized = await win.isMaximized();
		} catch {}
	}

	// Listen for resize events to update the icon
	$effect(() => {
		let unlisten = () => {};
		getWindow().then((win) => {
			if (!win) return;
			win.onResized(() => checkMaximized())
				.then((fn) => (unlisten = fn))
				.catch(() => {});
		});
		return () => unlisten();
	});

	// Initial check
	checkMaximized();

	async function handleClose() {
		try {
			const win = await getWindow();
			if (win) await win.close();
		} catch {}
	}

	async function handleMinimize() {
		try {
			const win = await getWindow();
			if (win) await win.minimize();
		} catch {}
	}

	async function handleMaximize() {
		try {
			const win = await getWindow();
			if (win) await win.toggleMaximize();
		} catch {}
	}

	async function handleTitlebarMousedown(e: MouseEvent) {
		// Double-click to toggle maximize
		if (e.detail === 2) {
			handleMaximize();
			return;
		}
		try {
			const win = await getWindow();
			if (win) await win.startDragging();
		} catch {}
	}
</script>

<div class="titlebar" onmousedown={handleTitlebarMousedown} role="toolbar" tabindex="-1">
	<span class="titlebar-title">ZeusIX</span>
	<div class="window-controls" onmousedown={(e) => e.stopPropagation()} role="toolbar" tabindex="-1">
		<button class="control minimize" onclick={handleMinimize} aria-label="Minimize">
			<svg width="10" height="1" viewBox="0 0 10 1">
				<rect width="10" height="1" fill="currentColor" />
			</svg>
		</button>
		<button class="control maximize" onclick={handleMaximize} aria-label={isMaximized ? 'Restore' : 'Maximize'}>
			{#if isMaximized}
				<!-- Restore icon: two overlapping rectangles -->
				<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
					<rect x="2.5" y="0.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1" />
					<rect x="0.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1" fill="rgba(28, 28, 30, 0.85)" />
				</svg>
			{:else}
				<!-- Maximize icon: single rectangle -->
				<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
					<rect x="0.5" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1" />
				</svg>
			{/if}
		</button>
		<button class="control close" onclick={handleClose} aria-label="Close">
			<svg width="10" height="10" viewBox="0 0 10 10">
				<path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
			</svg>
		</button>
	</div>
</div>

<style>
	.titlebar {
		height: 38px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0 0 16px;
		background: transparent;
		user-select: none;
		-webkit-user-select: none;
		position: relative;
		z-index: 100;
		flex-shrink: 0;
		cursor: default;
	}

	.titlebar-title {
		font-size: 13px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.5);
		pointer-events: none;
	}

	.window-controls {
		display: flex;
		align-items: stretch;
		height: 100%;
	}

	.control {
		width: 46px;
		height: 100%;
		border: none;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(255, 255, 255, 0.7);
		transition: background 0.15s ease, color 0.15s ease;
		padding: 0;
	}

	.control:hover {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.95);
	}

.control.close:hover {
		background: #e81123;
		color: white;
	}

	.control:active {
		background: rgba(255, 255, 255, 0.04);
	}

	.control.close:active {
		background: #bf0f1d;
	}
</style>
