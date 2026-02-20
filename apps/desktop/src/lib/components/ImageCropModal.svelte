<script lang="ts">
	interface Props {
		file: File;
		mode: 'avatar' | 'cover';
		onconfirm: (croppedFile: File) => void;
		oncancel: () => void;
	}

	let { file, mode, onconfirm, oncancel }: Props = $props();

	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let dragging = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let panStartX = $state(0);
	let panStartY = $state(0);
	let naturalWidth = $state(0);
	let naturalHeight = $state(0);
	let imgSrc = $state('');
	let visible = $state(false);
	let imgLoaded = $state(false);

	let viewportEl: HTMLDivElement | undefined = $state();
	let imgEl: HTMLImageElement | undefined = $state();

	let viewportW = $derived(mode === 'avatar' ? 280 : 420);
	let viewportH = $derived(mode === 'avatar' ? 280 : 105);

	let baseScale = $derived(
		naturalWidth > 0 && naturalHeight > 0
			? Math.max(viewportW / naturalWidth, viewportH / naturalHeight)
			: 1
	);

	let renderedW = $derived(naturalWidth * baseScale * zoom);
	let renderedH = $derived(naturalHeight * baseScale * zoom);

	let maxPanX = $derived((renderedW - viewportW) / 2);
	let maxPanY = $derived((renderedH - viewportH) / 2);

	let imgLeft = $derived((viewportW - renderedW) / 2 + panX);
	let imgTop = $derived((viewportH - renderedH) / 2 + panY);

	// Create object URL and trigger entrance animation
	$effect(() => {
		const url = URL.createObjectURL(file);
		imgSrc = url;

		requestAnimationFrame(() => {
			visible = true;
		});

		return () => {
			URL.revokeObjectURL(url);
		};
	});

	// Load natural dimensions when image source changes
	$effect(() => {
		if (!imgEl || !imgSrc) return;

		const img = imgEl;

		function handleLoad() {
			naturalWidth = img.naturalWidth;
			naturalHeight = img.naturalHeight;
			imgLoaded = true;
		}

		if (img.complete && img.naturalWidth > 0) {
			handleLoad();
		} else {
			img.addEventListener('load', handleLoad);
			return () => {
				img.removeEventListener('load', handleLoad);
			};
		}
	});

	function clampPan(px: number, py: number): { x: number; y: number } {
		const mpx = (renderedW - viewportW) / 2;
		const mpy = (renderedH - viewportH) / 2;
		return {
			x: Math.max(-mpx, Math.min(mpx, px)),
			y: Math.max(-mpy, Math.min(mpy, py))
		};
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			oncancel();
		}
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			oncancel();
		}
	}

	function handlePointerDown(e: PointerEvent) {
		dragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		panStartX = panX;
		panStartY = panY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging) return;

		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;
		const clamped = clampPan(panStartX + dx, panStartY + dy);
		panX = clamped.x;
		panY = clamped.y;
	}

	function handlePointerUp() {
		dragging = false;
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();

		const oldZoom = zoom;
		const step = 0.1;
		const newZoom = Math.max(1, Math.min(5, oldZoom + (e.deltaY < 0 ? step : -step)));

		if (newZoom === oldZoom) return;

		// Adjust pan to keep the point under the cursor stable
		const rect = viewportEl?.getBoundingClientRect();
		if (rect) {
			const cursorX = e.clientX - rect.left - viewportW / 2;
			const cursorY = e.clientY - rect.top - viewportH / 2;

			const scale = newZoom / oldZoom;
			const newPanX = cursorX - scale * (cursorX - panX);
			const newPanY = cursorY - scale * (cursorY - panY);

			zoom = newZoom;

			// Recalculate max pan with new zoom
			const newRenderedW = naturalWidth * baseScale * newZoom;
			const newRenderedH = naturalHeight * baseScale * newZoom;
			const newMaxPanX = (newRenderedW - viewportW) / 2;
			const newMaxPanY = (newRenderedH - viewportH) / 2;

			panX = Math.max(-newMaxPanX, Math.min(newMaxPanX, newPanX));
			panY = Math.max(-newMaxPanY, Math.min(newMaxPanY, newPanY));
		} else {
			zoom = newZoom;
		}
	}

	function handleZoomInput() {
		// Clamp pan after zoom slider changes
		const clamped = clampPan(panX, panY);
		panX = clamped.x;
		panY = clamped.y;
	}

	function handleApply() {
		if (!imgEl || !imgLoaded) return;

		const outputW = mode === 'avatar' ? 512 : 960;
		const outputH = mode === 'avatar' ? 512 : 240;
		const canvas = document.createElement('canvas');
		canvas.width = outputW;
		canvas.height = outputH;
		const ctx = canvas.getContext('2d')!;

		const scale = baseScale * zoom;

		// Image top-left in viewport coords
		const iLeft = (viewportW - renderedW) / 2 + panX;
		const iTop = (viewportH - renderedH) / 2 + panY;

		// Source rect in natural image coords
		const sx = -iLeft / scale;
		const sy = -iTop / scale;
		const sw = viewportW / scale;
		const sh = viewportH / scale;

		ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, outputW, outputH);

		canvas.toBlob(
			(blob) => {
				if (!blob) return;
				const croppedFile = new File([blob], file.name, { type: 'image/png' });
				onconfirm(croppedFile);
			},
			'image/png'
		);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" class:visible onclick={handleOverlayClick} role="presentation">
	<div class="modal" class:visible role="dialog" aria-modal="true" aria-labelledby="crop-modal-title">
		<h2 id="crop-modal-title">{mode === 'avatar' ? 'Crop Avatar' : 'Crop Cover'}</h2>

		<div class="viewport-container" class:avatar-mode={mode === 'avatar'} class:cover-mode={mode === 'cover'}>
			<div
				class="viewport"
				class:grabbing={dragging}
				bind:this={viewportEl}
				style="width:{viewportW}px;height:{viewportH}px"
				onpointerdown={handlePointerDown}
				onpointermove={handlePointerMove}
				onpointerup={handlePointerUp}
				onpointerleave={handlePointerUp}
				onwheel={handleWheel}
				role="application"
				aria-label="Drag to reposition image"
			>
				<img
					bind:this={imgEl}
					src={imgSrc}
					alt="Crop preview"
					class="crop-image"
					style="width:{renderedW}px;height:{renderedH}px;transform:translate({imgLeft}px,{imgTop}px)"
					draggable="false"
				/>
				{#if mode === 'avatar'}
					<div class="circle-mask"></div>
				{/if}
				{#if mode === 'cover'}
					<div class="cover-edge-overlay"></div>
				{/if}
			</div>
		</div>

		<div class="zoom-row">
			<span class="zoom-label">Zoom</span>
			<input
				type="range"
				min="1"
				max="5"
				step="0.01"
				bind:value={zoom}
				oninput={handleZoomInput}
				class="zoom-slider"
			/>
		</div>

		<div class="actions">
			<button class="btn btn-secondary" onclick={oncancel}>Cancel</button>
			<button class="btn btn-primary" onclick={handleApply}>Apply</button>
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
		z-index: 1100;
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
		padding: 32px;
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

	#crop-modal-title {
		font-size: 20px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		margin: 0 0 24px 0;
		letter-spacing: -0.02em;
	}

	/* Viewport container */
	.viewport-container {
		display: flex;
		justify-content: center;
		margin-bottom: 20px;
	}

	.viewport {
		position: relative;
		overflow: hidden;
		cursor: grab;
		touch-action: none;
		background: rgba(0, 0, 0, 0.3);
	}

	.viewport.grabbing {
		cursor: grabbing;
	}

	.avatar-mode .viewport {
		border-radius: 12px;
	}

	.cover-mode .viewport {
		border-radius: 12px;
	}

	.crop-image {
		position: absolute;
		top: 0;
		left: 0;
		user-select: none;
		pointer-events: none;
		-webkit-user-drag: none;
	}

	/* Avatar circular mask cutout */
	.circle-mask {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
		pointer-events: none;
		z-index: 1;
	}

	/* Cover mode edge overlay */
	.cover-edge-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
		border-radius: 12px;
	}

	/* Zoom row */
	.zoom-row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 24px;
		padding: 0 4px;
	}

	.zoom-label {
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		flex-shrink: 0;
	}

	.zoom-slider {
		flex: 1;
		height: 4px;
		-webkit-appearance: none;
		appearance: none;
		background: rgba(255, 255, 255, 0.15);
		border-radius: 2px;
		outline: none;
	}

	.zoom-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent-blue, #0a84ff);
		cursor: pointer;
		border: 2px solid rgba(255, 255, 255, 0.2);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		transition: transform 0.15s ease;
	}

	.zoom-slider::-webkit-slider-thumb:hover {
		transform: scale(1.15);
	}

	.zoom-slider::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--accent-blue, #0a84ff);
		cursor: pointer;
		border: 2px solid rgba(255, 255, 255, 0.2);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
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
</style>
