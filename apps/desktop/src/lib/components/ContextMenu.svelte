<script lang="ts">
	interface ContextMenuItem {
		label: string;
		danger?: boolean;
		divider?: boolean;
		action: () => void;
	}

	interface Props {
		x: number;
		y: number;
		items: ContextMenuItem[];
		onclose: () => void;
	}

	let { x, y, items, onclose }: Props = $props();

	let visible = $state(false);
	let adjustedX = $state(0);
	let adjustedY = $state(0);
	let menuNode: HTMLDivElement | undefined = $state();

	function menuAction(node: HTMLDivElement) {
		menuNode = node;

		return {
			destroy() {
				menuNode = undefined;
			}
		};
	}

	$effect(() => {
		if (!menuNode) return;

		const rect = menuNode.getBoundingClientRect();
		const viewportW = window.innerWidth;
		const viewportH = window.innerHeight;

		let newX = x;
		let newY = y;

		if (x + rect.width > viewportW) {
			newX = viewportW - rect.width - 8;
		}
		if (y + rect.height > viewportH) {
			newY = viewportH - rect.height - 8;
		}
		if (newX < 8) newX = 8;
		if (newY < 8) newY = 8;

		adjustedX = newX;
		adjustedY = newY;

		// Delay visibility one frame so the browser can position before animating
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	function handleClickOutside(e: MouseEvent) {
		if (menuNode && !menuNode.contains(e.target as Node)) {
			onclose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	function handleItemClick(action: () => void) {
		action();
		onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} onmousedown={handleClickOutside} />

<div
	class="context-menu"
	class:visible
	style="left: {adjustedX}px; top: {adjustedY}px;"
	use:menuAction
	role="menu"
>
	{#each items as item (item.label)}
		{#if item.divider}
			<div class="divider"></div>
		{/if}
		<button
			class="menu-item"
			class:danger={item.danger}
			role="menuitem"
			onclick={() => handleItemClick(item.action)}
		>
			{item.label}
		</button>
	{/each}
</div>

<style>
	.context-menu {
		position: fixed;
		z-index: 9999;
		min-width: 160px;
		background: rgba(30, 30, 34, 0.95);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		padding: 5px;
		transform: scale(0.95);
		opacity: 0;
		transform-origin: top left;
		transition:
			transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
			opacity 0.15s ease;
		pointer-events: none;
	}

	.context-menu.visible {
		transform: scale(1);
		opacity: 1;
		pointer-events: auto;
	}

	.menu-item {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 8px 14px;
		border: none;
		border-radius: 6px;
		background: none;
		color: rgba(235, 235, 245, 0.85);
		font-size: 13px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.95);
	}

	.menu-item.danger {
		color: #ff453a;
	}

	.menu-item.danger:hover {
		background: rgba(255, 69, 58, 0.1);
		color: #ff6961;
	}

	.divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.08);
		margin: 4px 8px;
	}
</style>
