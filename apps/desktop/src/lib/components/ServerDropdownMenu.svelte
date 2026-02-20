<script lang="ts">
	import { UserPlus, Settings, Trash2 } from 'lucide-svelte';

	interface Props {
		isOwner: boolean;
		onclose: () => void;
		oninvite: () => void;
		onsettings?: () => void;
		ondelete?: () => void;
	}

	let { isOwner, onclose, oninvite, onsettings, ondelete }: Props = $props();

	let visible = $state(false);

	$effect(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	function clickOutside(node: HTMLElement) {
		function handleMousedown(e: MouseEvent) {
			if (!node.contains(e.target as Node)) {
				onclose();
			}
		}

		document.addEventListener('mousedown', handleMousedown);

		return {
			destroy() {
				document.removeEventListener('mousedown', handleMousedown);
			}
		};
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="dropdown" class:visible use:clickOutside role="menu">
	<button class="menu-item" role="menuitem" onclick={oninvite}>
		<UserPlus size={16} />
		<span>Invite People</span>
	</button>
	{#if onsettings}
		<button class="menu-item" role="menuitem" onclick={onsettings}>
			<Settings size={16} />
			<span>Server Settings</span>
		</button>
	{/if}
	{#if ondelete}
		<div class="divider"></div>
		<button class="menu-item danger" role="menuitem" onclick={ondelete}>
			<Trash2 size={16} />
			<span>Delete Server</span>
		</button>
	{/if}
</div>

<style>
	.dropdown {
		position: absolute;
		top: 52px;
		left: 8px;
		right: 8px;
		z-index: 100;
		background: rgba(30, 30, 30, 0.92);
		backdrop-filter: blur(40px);
		-webkit-backdrop-filter: blur(40px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		padding: 6px;
		transform: scale(0.95);
		opacity: 0;
		transform-origin: top center;
		transition:
			transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
			opacity 0.15s ease;
		pointer-events: none;
	}

	.dropdown.visible {
		transform: scale(1);
		opacity: 1;
		pointer-events: auto;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px 12px;
		border: none;
		border-radius: 8px;
		background: none;
		color: rgba(235, 235, 245, 0.85);
		font-size: 14px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.95);
	}

	.menu-item.danger {
		color: #ff453a;
	}

	.menu-item.danger:hover {
		background: rgba(255, 69, 58, 0.12);
		color: #ff6961;
	}

	.divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.08);
		margin: 4px 8px;
	}
</style>
