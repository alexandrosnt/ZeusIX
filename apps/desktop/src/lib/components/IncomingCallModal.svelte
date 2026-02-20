<script lang="ts">
	import { Phone, PhoneOff } from 'lucide-svelte';
	import type { Call } from '$lib/types';

	interface Props {
		call: Call;
		onaccept: () => void;
		ondecline: () => void;
	}

	let { call, onaccept, ondecline }: Props = $props();

	let visible = $state(false);
	let timeLeft = $state(20);
	let dismissed = $state(false);

	$effect(() => {
		requestAnimationFrame(() => {
			visible = true;
		});
	});

	// Auto-dismiss countdown
	$effect(() => {
		const interval = setInterval(() => {
			if (dismissed) return;
			timeLeft--;
			if (timeLeft <= 0) {
				dismissed = true;
				ondecline();
			}
		}, 1000);
		return () => clearInterval(interval);
	});

	function getInitial(name: string): string {
		return name.charAt(0).toUpperCase();
	}

	function getAvatarGradient(name: string): string {
		const gradients = [
			'linear-gradient(135deg, #0A84FF, #5E5CE6)',
			'linear-gradient(135deg, #BF5AF2, #FF375F)',
			'linear-gradient(135deg, #30D158, #0A84FF)',
			'linear-gradient(135deg, #FF9F0A, #FF375F)',
			'linear-gradient(135deg, #FF453A, #BF5AF2)',
			'linear-gradient(135deg, #5E5CE6, #30D158)'
		];
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}
		return gradients[Math.abs(hash) % gradients.length];
	}

	function handleAccept() { dismissed = true; onaccept(); }
	function handleDecline() { dismissed = true; ondecline(); }
</script>

<div class="call-overlay" class:visible>
	<div class="call-modal" class:visible>
		<div class="call-avatar" style:background={getAvatarGradient(call.initiator_username)}>
			{getInitial(call.initiator_username)}
		</div>
		<h2 class="call-title">{call.initiator_username}</h2>
		<p class="call-subtitle">Incoming Call...</p>
		<p class="call-timer">{timeLeft}s</p>

		<div class="call-actions">
			<button class="call-btn decline" onclick={handleDecline} aria-label="Decline call">
				<PhoneOff size={24} />
			</button>
			<button class="call-btn accept" onclick={handleAccept} aria-label="Accept call">
				<Phone size={24} />
			</button>
		</div>
	</div>
</div>

<style>
	.call-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		opacity: 0;
		transition: opacity 0.25s ease;
	}

	.call-overlay.visible {
		opacity: 1;
	}

	.call-modal {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 40px 48px;
		background: rgba(30, 30, 32, 0.95);
		border-radius: 20px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
		transform: scale(0.9);
		transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.call-modal.visible {
		transform: scale(1);
	}

	.call-avatar {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 32px;
		font-weight: 700;
		color: white;
		animation: pulse-ring 2s ease-out infinite;
	}

	@keyframes pulse-ring {
		0% {
			box-shadow: 0 0 0 0 rgba(48, 209, 88, 0.4);
		}
		70% {
			box-shadow: 0 0 0 20px rgba(48, 209, 88, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(48, 209, 88, 0);
		}
	}

	.call-title {
		font-size: 20px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.95);
		margin: 0;
	}

	.call-subtitle {
		font-size: 14px;
		color: rgba(235, 235, 245, 0.5);
		margin: 0;
	}

	.call-timer {
		font-size: 12px;
		color: rgba(235, 235, 245, 0.3);
		margin: 0;
	}

	.call-actions {
		display: flex;
		gap: 32px;
		margin-top: 12px;
	}

	.call-btn {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: transform 0.15s, filter 0.15s;
		color: white;
	}

	.call-btn:hover {
		transform: scale(1.1);
	}

	.call-btn:active {
		transform: scale(0.95);
	}

	.call-btn.accept {
		background: #30D158;
	}

	.call-btn.accept:hover {
		filter: brightness(1.15);
	}

	.call-btn.decline {
		background: #FF453A;
	}

	.call-btn.decline:hover {
		filter: brightness(1.15);
	}
</style>
