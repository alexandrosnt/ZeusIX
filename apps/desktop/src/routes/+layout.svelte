<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import { updaterStore } from '$lib/stores/updater.svelte';

	let { children }: { children: Snippet } = $props();

	let phase = $state<'electric' | 'dematerialize' | 'black' | 'materialize' | 'done'>('electric');
	let splashEl = $state<HTMLDivElement | undefined>();
	let appRootEl = $state<HTMLDivElement | undefined>();
	let dematGridEl = $state<HTMLDivElement | undefined>();
	let matGridEl = $state<HTMLDivElement | undefined>();

	// Shared tile generator
	function makeTiles(cols: number, rows: number) {
		return Array.from({ length: cols * rows }, (_, i) => {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const angle = Math.random() * Math.PI * 2;
			const distance = 250 + Math.random() * 500;
			return {
				col, row,
				delay: Math.random() * 0.7,
				tx: Math.cos(angle) * distance,
				ty: Math.sin(angle) * distance,
				rot: (Math.random() - 0.5) * 180,
				clipTop: row * 100 / rows,
				clipRight: (cols - col - 1) * 100 / cols,
				clipBottom: (rows - row - 1) * 100 / rows,
				clipLeft: col * 100 / cols,
				originX: (col + 0.5) * 100 / cols,
				originY: (row + 0.5) * 100 / rows,
			};
		});
	}

	const splatTiles = makeTiles(6, 4);
	const matTiles = makeTiles(6, 4);

	// Clone splash DOM into demat tiles
	$effect(() => {
		if (phase === 'dematerialize') {
			tick().then(() => {
				if (!splashEl || !dematGridEl) return;
				const splash = splashEl;
				const frames = dematGridEl.querySelectorAll('.tile-frame');
				frames.forEach((frame) => {
					if (frame.children.length > 0) return;
					const clone = splash.cloneNode(true) as HTMLElement;
					clone.style.opacity = '1';
					clone.style.transition = 'none';
					clone.style.pointerEvents = 'none';
					frame.appendChild(clone);
				});
			});
		}
	});

	// Clone login DOM into materialize tiles
	$effect(() => {
		if (phase === 'materialize') {
			tick().then(() => {
				if (!appRootEl || !matGridEl) return;
				const appRoot = appRootEl;
				const frames = matGridEl.querySelectorAll('.tile-frame');
				frames.forEach((frame) => {
					if (frame.children.length > 0) return;
					const clone = appRoot.cloneNode(true) as HTMLElement;
					clone.style.opacity = '1';
					clone.style.pointerEvents = 'none';
					frame.appendChild(clone);
				});
			});
		}
	});

	$effect(() => {
		const t1 = setTimeout(() => { phase = 'dematerialize'; }, 2200);
		const t2 = setTimeout(() => { phase = 'black'; }, 3600);
		const t3 = setTimeout(() => { phase = 'materialize'; }, 4200);
		// Force-update during splash (blocks until done or no update)
		updaterStore.forceUpdate().then(() => {
			// Start periodic background checks once app is running
			updaterStore.startBackgroundCheck();
		});

		const t4 = setTimeout(() => {
			phase = 'done';
		}, 5600);
		return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
	});
</script>

<!-- SVG Filters -->
<svg class="filters" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<filter id="electric" x="-20%" y="-20%" width="140%" height="140%">
			<feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="2" result="noise">
				<animate attributeName="baseFrequency" values="0.015;0.04;0.01;0.05;0.02;0.015" dur="0.4s" repeatCount="indefinite" />
				<animate attributeName="seed" values="2;5;8;3;7;2" dur="0.3s" repeatCount="indefinite" />
			</feTurbulence>
			<feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
		</filter>

		<linearGradient id="bolt-grad" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0%" stop-color="#0a84ff" />
			<stop offset="100%" stop-color="#bf5af2" />
		</linearGradient>
	</defs>
</svg>

<!-- SPLASH -->
{#if phase === 'electric' || phase === 'dematerialize'}
	<div class="splash" class:fading={phase === 'dematerialize'} bind:this={splashEl}>
		<div class="splash-content" class:crackling={phase === 'electric'}>
			<div class="arc arc-1"></div>
			<div class="arc arc-2"></div>
			<div class="arc arc-3"></div>
			<div class="bolt-glow"></div>

			<svg class="bolt" viewBox="0 0 64 64" fill="none">
				<path d="M36.5 4L14 36h14l-4 24L46 28H32l4.5-24z" fill="url(#bolt-grad)" />
			</svg>

			<span class="splash-wordmark">ZeusIX</span>

			<div class="loading-dots">
				<span class="dot"></span>
				<span class="dot"></span>
				<span class="dot"></span>
			</div>
		</div>
	</div>
{/if}

<!-- DEMATERIALIZE: content-aware tiles shatter the actual splash outward -->
{#if phase === 'dematerialize'}
	<div class="tile-grid" bind:this={dematGridEl}>
		{#each splatTiles as tile}
			<div
				class="tile-frame tile-shatter-out"
				style="
					clip-path: inset({tile.clipTop}% {tile.clipRight}% {tile.clipBottom}% {tile.clipLeft}%);
					transform-origin: {tile.originX}% {tile.originY}%;
					--tx: {tile.tx}px;
					--ty: {tile.ty}px;
					--rot: {tile.rot}deg;
					animation-delay: {tile.delay}s;
				"
			></div>
		{/each}
	</div>
{/if}

<!-- BLACK SCREEN between shatter and materialize -->
{#if phase === 'black' || phase === 'materialize'}
	<div class="black-backdrop" class:fading-out={phase === 'materialize'}></div>
{/if}

<!-- MATERIALIZE: content-aware tiles carry actual login UI fragments -->
{#if phase === 'materialize'}
	<div class="tile-grid" bind:this={matGridEl}>
		{#each matTiles as tile}
			<div
				class="tile-frame tile-assemble-in"
				style="
					clip-path: inset({tile.clipTop}% {tile.clipRight}% {tile.clipBottom}% {tile.clipLeft}%);
					transform-origin: {tile.originX}% {tile.originY}%;
					--tx: {tile.tx}px;
					--ty: {tile.ty}px;
					--rot: {tile.rot}deg;
					animation-delay: {tile.delay}s;
				"
			></div>
		{/each}
	</div>
{/if}

<!-- APP ROOT (always in DOM for cloning, visibility controlled by phase) -->
<div
	class="app-root"
	class:visible={phase === 'done'}
	bind:this={appRootEl}
>
	{@render children()}
</div>

<style>
	.filters {
		position: absolute;
		width: 0;
		height: 0;
	}

	/* ===== SPLASH ===== */
	.splash {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #000000;
		background-image:
			radial-gradient(at 0% 0%, hsla(253, 16%, 7%, 1) 0, transparent 50%),
			radial-gradient(at 50% 0%, hsla(225, 39%, 30%, 1) 0, transparent 50%),
			radial-gradient(at 100% 0%, hsla(339, 49%, 30%, 1) 0, transparent 50%);
		transition: opacity 0.5s ease-out;
	}

	.splash.fading {
		opacity: 0;
	}

	.splash-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		position: relative;
		animation: splashIn 0.6s ease-out;
	}

	.splash-content.crackling {
		filter: url(#electric);
	}

	/* ===== BOLT ===== */
	.bolt {
		width: 72px;
		height: 72px;
		filter: drop-shadow(0 0 30px rgba(var(--accent-rgb, 10, 132, 255), 0.5))
				drop-shadow(0 0 60px rgba(191, 90, 242, 0.3));
		animation: boltPulse 1.5s ease-in-out infinite;
		position: relative;
		z-index: 2;
	}

	.bolt-glow {
		position: absolute;
		width: 200px;
		height: 200px;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -65%);
		background: radial-gradient(
			circle,
			rgba(var(--accent-rgb, 10, 132, 255), 0.2) 0%,
			rgba(191, 90, 242, 0.1) 30%,
			rgba(var(--accent-rgb, 10, 132, 255), 0.05) 50%,
			transparent 70%
		);
		border-radius: 50%;
		filter: blur(20px);
		pointer-events: none;
		animation: glowPulse 1.5s ease-in-out infinite;
		z-index: 0;
	}

	/* ===== ELECTRIC ARCS ===== */
	.arc {
		position: absolute;
		width: 2px;
		background: linear-gradient(180deg, transparent, var(--accent-blue, #0a84ff), #bf5af2, transparent);
		border-radius: 2px;
		opacity: 0;
		z-index: 1;
		filter: blur(0.5px);
	}

	.arc-1 {
		height: 40px;
		top: -10px;
		left: 50%;
		transform: translateX(-20px) rotate(-15deg);
		animation: arcFlash1 0.3s ease-out infinite;
	}

	.arc-2 {
		height: 35px;
		top: 5px;
		left: 50%;
		transform: translateX(15px) rotate(20deg);
		animation: arcFlash2 0.4s ease-out infinite;
	}

	.arc-3 {
		height: 25px;
		top: -5px;
		left: 50%;
		transform: translateX(-5px) rotate(-5deg);
		animation: arcFlash3 0.25s ease-out infinite;
	}

	/* ===== WORDMARK ===== */
	.splash-wordmark {
		font-size: 24px;
		font-weight: 700;
		background: linear-gradient(135deg, var(--accent-blue, #0a84ff), #bf5af2);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		letter-spacing: -0.3px;
		position: relative;
		z-index: 2;
	}

	/* ===== LOADING DOTS ===== */
	.loading-dots {
		display: flex;
		gap: 6px;
		z-index: 2;
	}

	.dot {
		width: 6px;
		height: 6px;
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.6);
		border-radius: 50%;
		animation: dotBounce 1.2s ease-in-out infinite;
	}

	.dot:nth-child(2) { animation-delay: 0.15s; }
	.dot:nth-child(3) { animation-delay: 0.3s; }

	/* ===== CONTENT-AWARE DEMAT TILES ===== */
	.tile-grid {
		position: fixed;
		inset: 0;
		z-index: 10001;
		pointer-events: none;
	}

	.tile-frame {
		position: fixed;
		inset: 0;
		overflow: hidden;
	}

	.tile-shatter-out {
		opacity: 1;
		transform: translate(0, 0) rotate(0deg) scale(1);
		animation: tileFlyOut 0.8s cubic-bezier(0.4, 0, 1, 1) forwards;
	}

	@keyframes tileFlyOut {
		0% {
			opacity: 1;
			transform: translate(0, 0) rotate(0deg) scale(1);
		}
		25% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.15);
		}
	}

	/* ===== MATERIALIZE: content-aware tiles fly in ===== */
	.tile-assemble-in {
		opacity: 0;
		transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.3);
		animation: tileAssemble 0.9s cubic-bezier(0.25, 1, 0.5, 1) forwards;
	}

	@keyframes tileAssemble {
		0% {
			opacity: 0;
			transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.3);
		}
		35% {
			opacity: 1;
		}
		100% {
			opacity: 1;
			transform: translate(0, 0) rotate(0deg) scale(1);
		}
	}

	/* ===== BLACK BACKDROP ===== */
	.black-backdrop {
		position: fixed;
		inset: 0;
		z-index: 10000;
		background: #000;
		opacity: 1;
		transition: opacity 0.8s ease-out;
	}

	.black-backdrop.fading-out {
		opacity: 0;
	}

	/* ===== APP ROOT ===== */
	.app-root {
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.4s ease-out;
	}

	.app-root.visible {
		opacity: 1;
		pointer-events: all;
	}

	/* ===== KEYFRAMES ===== */
	@keyframes splashIn {
		0% { opacity: 0; transform: scale(0.7); }
		60% { opacity: 1; transform: scale(1.05); }
		100% { transform: scale(1); }
	}

	@keyframes boltPulse {
		0%, 100% {
			filter: drop-shadow(0 0 30px rgba(var(--accent-rgb, 10, 132, 255), 0.5))
					drop-shadow(0 0 60px rgba(191, 90, 242, 0.3));
		}
		50% {
			filter: drop-shadow(0 0 40px rgba(var(--accent-rgb, 10, 132, 255), 0.8))
					drop-shadow(0 0 80px rgba(191, 90, 242, 0.5));
		}
	}

	@keyframes glowPulse {
		0%, 100% { opacity: 0.6; transform: translate(-50%, -65%) scale(1); }
		50% { opacity: 1; transform: translate(-50%, -65%) scale(1.15); }
	}

	@keyframes arcFlash1 {
		0% { opacity: 0; height: 0; }
		10% { opacity: 0.9; }
		30% { height: 40px; opacity: 0.8; }
		100% { opacity: 0; height: 50px; }
	}

	@keyframes arcFlash2 {
		0% { opacity: 0; height: 0; }
		15% { opacity: 0.7; }
		40% { height: 35px; opacity: 0.6; }
		100% { opacity: 0; height: 45px; }
	}

	@keyframes arcFlash3 {
		0% { opacity: 0; height: 0; }
		12% { opacity: 1; }
		35% { height: 25px; opacity: 0.9; }
		100% { opacity: 0; height: 30px; }
	}

	@keyframes dotBounce {
		0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
		40% { transform: translateY(-8px); opacity: 1; }
	}
</style>
