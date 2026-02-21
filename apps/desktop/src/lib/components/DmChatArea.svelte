<script lang="ts">
	import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Headphones, HeadphoneOff, MonitorUp, Maximize, Minimize, Eye } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import MessageList from './MessageList.svelte';
	import ScreenSharePicker from './ScreenSharePicker.svelte';
	import { dmsStore } from '$lib/stores/dms.svelte';
	import { presenceStore } from '$lib/stores/presence.svelte';
	import { messagesStore } from '$lib/stores/messages.svelte';
	import { callsStore } from '$lib/stores/calls.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getDmMessages, sendDmMessage, startCall, leaveCall, joinCall, getActiveCall, getDm, deleteDmMessage, purgeMessages } from '$lib/services/api';
	import { gateway } from '$lib/services/gateway';
	import { sounds } from '$lib/services/sounds';
	import { unreadStore } from '$lib/stores/unread.svelte';
	const lk = () => import('$lib/services/livekit').then(m => m.livekit);
	import { voiceStore } from '$lib/stores/voice.svelte';
	import type { DmChannel } from '$lib/types';

	let { dmChannelId }: { dmChannelId: string } = $props();

	let dmChannel = $state<DmChannel | null>(null);
	let loading = $state(true);
	let error: string | null = $state(null);
	let callLoading = $state(false);
	let callError = $state<string | null>(null);

	// DM-specific message input state
	let message = $state('');
	let sending = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);

	// Derive whether this is a 1-on-1 or group DM
	let isGroup = $derived(dmChannel?.dm_type === 'group');

	// For 1-on-1 DMs: the other user's info
	let recipientName = $derived(dmChannel?.recipient_username ?? 'Unknown');
	let recipientId = $derived(dmChannel?.recipient_id ?? '');
	let recipientStatus = $derived(recipientId ? presenceStore.getStatus(recipientId) : 'offline');

	// For group DMs: display name and participant count
	let groupDisplayName = $derived.by(() => {
		if (!dmChannel) return 'Group DM';
		if (dmChannel.name) return dmChannel.name;
		const participants = dmChannel.participants ?? [];
		if (participants.length === 0) return 'Group DM';
		return participants.map((p) => p.username).join(', ');
	});
	let memberCount = $derived((dmChannel?.participants?.length ?? 0) + 1);

	// Current user info for call display
	let myName = $derived(authStore.user?.username ?? 'You');
	let myAvatarUrl = $derived(authStore.user?.avatar_url ?? null);
	let myId = $derived(authStore.user?.id ?? '');

	// Call state for this DM channel
	let activeCall = $derived(callsStore.activeCall?.dm_channel_id === dmChannelId ? callsStore.activeCall : null);
	let isRinging = $derived(activeCall?.status === 'ringing');
	let isCallActive = $derived(activeCall?.status === 'active');
	let isInCall = $derived(isRinging || isCallActive || callLoading || !!callError);

	// Real-time: is there an active call on this DM we can join?
	let joinableCall = $derived(callsStore.getJoinableCall(dmChannelId));
	let hasJoinableCall = $derived(!isInCall && joinableCall != null && joinableCall.status === 'active');
	let callElapsed = $state(0);
	let callTimer: ReturnType<typeof setInterval> | null = null;

	// Remote participant status (mute/deafen/speaking from voiceStore)
	let remoteParticipant = $derived(voiceStore.participants.find(p => p.userId === recipientId));
	let remoteSpeaking = $derived(remoteParticipant?.speaking ?? false);
	let remoteMuted = $derived(remoteParticipant?.muted ?? false);
	let remoteDeafened = $derived(remoteParticipant?.deafened ?? false);

	// Video/screen share state
	let showScreenSharePicker = $state(false);
	let isFullscreen = $state(false);
	let screenShareMainEl = $state<HTMLDivElement | null>(null);
	let videoElements = $state(new Map<string, { camera?: HTMLVideoElement; screenshare?: HTMLVideoElement }>());
	let activeScreenShareUserId = $derived(voiceStore.activeScreenShareUserId);
	let isScreenShareActive = $derived(activeScreenShareUserId !== null);
	let screenSharers = $derived(voiceStore.screenSharers);
	let hasMultipleSharers = $derived(screenSharers.length > 1 || (screenSharers.length === 1 && voiceStore.screenSharing));
	let pendingVideoCall = $state(false);

	// Register video callbacks when call is active
	$effect(() => {
		if (!isCallActive) return;
		let cancelled = false;
		let unsub: (() => void) | undefined;
		(async () => {
			const svc = await lk();
			if (cancelled) return;
			unsub = svc.registerVideoCallbacks(
				(userId, source, el) => {
					const current = new Map(videoElements);
					const entry = current.get(userId) ?? {};
					if (source === 'camera') entry.camera = el;
					else entry.screenshare = el;
					current.set(userId, entry);
					videoElements = current;
				},
				(userId, source) => {
					const current = new Map(videoElements);
					const entry = current.get(userId);
					if (entry) {
						if (source === 'camera') delete entry.camera;
						else delete entry.screenshare;
						if (!entry.camera && !entry.screenshare) {
							current.delete(userId);
						} else {
							current.set(userId, entry);
						}
					}
					videoElements = current;
				}
			);
		})();
		return () => { cancelled = true; unsub?.(); videoElements = new Map(); };
	});

	// Auto-enable camera after starting a video call
	$effect(() => {
		if (pendingVideoCall && isCallActive) {
			pendingVideoCall = false;
			lk().then(svc => svc.toggleVideo());
		}
	});

	// Track fullscreen changes
	$effect(() => {
		const handler = () => { isFullscreen = !!document.fullscreenElement; };
		document.addEventListener('fullscreenchange', handler);
		return () => document.removeEventListener('fullscreenchange', handler);
	});

	// Svelte action: attach a video element into a container div
	function attachVideo(node: HTMLDivElement, getElement: () => HTMLVideoElement | undefined) {
		let el = getElement();
		if (el) {
			el.style.width = '100%';
			el.style.height = '100%';
			el.style.objectFit = 'cover';
			el.style.borderRadius = 'inherit';
			node.appendChild(el);
		}

		return {
			update(newGetElement: () => HTMLVideoElement | undefined) {
				const newEl = newGetElement();
				if (newEl !== el) {
					if (el?.parentNode === node) node.removeChild(el);
					el = newEl;
					if (el) {
						el.style.width = '100%';
						el.style.height = '100%';
						el.style.objectFit = 'cover';
						el.style.borderRadius = 'inherit';
						node.appendChild(el);
					}
				}
			},
			destroy() {
				if (el?.parentNode === node) node.removeChild(el);
			}
		};
	}

	// Svelte action for screenshare video (objectFit: contain)
	function attachScreenShare(node: HTMLDivElement, getElement: () => HTMLVideoElement | undefined) {
		let el = getElement();
		if (el) {
			el.style.width = '100%';
			el.style.height = '100%';
			el.style.objectFit = 'contain';
			node.appendChild(el);
		}

		return {
			update(newGetElement: () => HTMLVideoElement | undefined) {
				const newEl = newGetElement();
				if (newEl !== el) {
					if (el?.parentNode === node) node.removeChild(el);
					el = newEl;
					if (el) {
						el.style.width = '100%';
						el.style.height = '100%';
						el.style.objectFit = 'contain';
						node.appendChild(el);
					}
				}
			},
			destroy() {
				if (el?.parentNode === node) node.removeChild(el);
			}
		};
	}

	async function toggleFullscreen() {
		if (document.fullscreenElement) {
			await document.exitFullscreen();
		} else {
			await screenShareMainEl?.requestFullscreen();
		}
	}

	async function handleScreenShareBtn() {
		if (voiceStore.screenSharing) {
			(await lk()).stopNativeScreenShare();
		} else {
			showScreenSharePicker = true;
		}
	}

	async function handleScreenSharePicked(options: { sourceType?: string; sourceIndex?: number; resolution?: { width: number; height: number }; frameRate?: number; audio?: boolean }) {
		showScreenSharePicker = false;
		const svc = await lk();
		if (options.sourceType && options.sourceIndex !== undefined) {
			svc.startNativeScreenShare(options as { sourceType: string; sourceIndex: number; resolution?: { width: number; height: number }; frameRate?: number; audio?: boolean });
		} else {
			svc.toggleScreenShare(options);
		}
	}

	async function handleStartVideoCall() {
		if (callLoading || isInCall) return;
		callError = null;
		callLoading = true;
		pendingVideoCall = true;
		try {
			const call = await startCall(dmChannelId);
			callsStore.setActiveCall(call);
			sounds.outgoingCall();
		} catch (err: any) {
			console.error('[DmChat] Failed to start video call:', err);
			callError = err?.message || 'Failed to start call';
			pendingVideoCall = false;
			setTimeout(() => { callError = null; }, 5000);
		} finally {
			callLoading = false;
		}
	}

	// Track call duration
	$effect(() => {
		if (isCallActive) {
			callElapsed = 0;
			callTimer = setInterval(() => { callElapsed++; }, 1000);
		} else {
			if (callTimer) clearInterval(callTimer);
			callTimer = null;
			callElapsed = 0;
		}
		return () => { if (callTimer) clearInterval(callTimer); };
	});

	function formatDuration(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}

	async function handleHangUp() {
		const call = callsStore.activeCall;
		if (call) {
			try {
				await leaveCall(call.dm_channel_id);
			} catch (err) {
				console.error('[DmChat] Failed to leave call:', err);
			}
		}
		const svc = await lk();
		svc.leaveCallRoom();
		callsStore.clearAll();
		callError = null;
	}

	// Presence status colors
	const statusColors: Record<string, string> = {
		online: '#30D158',
		idle: '#FF9F0A',
		dnd: '#FF453A',
		offline: '#636366'
	};

	function getInitial(username: string): string {
		return username.charAt(0).toUpperCase();
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

	// Load DM channel info and messages when dmChannelId changes
	$effect(() => {
		const id = dmChannelId;
		if (!id) return;
		unreadStore.clear(id);
		loadDmChannel(id);
		loadMessages(id);
	});

	// Auto-focus message input when DM loads
	$effect(() => {
		if (!loading && inputEl) {
			inputEl.focus();
		}
	});

	async function loadDmChannel(id: string) {
		try {
			const channel = await getDm(id);
			if (dmChannelId !== id) return; // stale response
			dmChannel = channel;
			dmsStore.addOrUpdateChannel(channel);
		} catch (err) {
			console.error('[DmChat] Failed to load DM channel:', err);
		}

		// Check if there's an active call on this DM we could join
		try {
			const call = await getActiveCall(id);
			if (dmChannelId !== id) return;
			if (call) {
				callsStore.setKnownCall(id, call);
			}
		} catch {
			// No active call or fetch failed
		}
	}

	async function loadMessages(id: string) {
		loading = true;
		error = null;
		try {
			gateway.subscribe([id]);
			const msgs = await getDmMessages(id);
			if (dmChannelId !== id) return; // stale response
			messagesStore.setMessages(id, msgs);
			messagesStore.setActiveChannel(id);
		} catch (err) {
			console.error('[DmChat] Failed to load messages:', err);
			error = 'Failed to load messages';
		} finally {
			loading = false;
		}
	}

	async function handleStartCall() {
		if (callLoading || isInCall) return;
		callError = null;
		callLoading = true;
		try {
			const call = await startCall(dmChannelId);
			callsStore.setActiveCall(call);
			sounds.outgoingCall();
			// Add self to participants immediately
			const me = authStore.user;
			if (me) callsStore.addParticipant({ user_id: me.id, username: me.username });
		} catch (err: any) {
			console.error('[DmChat] Failed to start call:', err);
			callError = err?.message || 'Failed to start call';
			setTimeout(() => { callError = null; }, 5000);
		} finally {
			callLoading = false;
		}
	}

	async function handleJoinCall() {
		if (callLoading || isInCall || !joinableCall) return;
		callError = null;
		callLoading = true;
		try {
			// Clear stale participants from any previous call
			callsStore.clearAll();
			const { token, url } = await joinCall(dmChannelId);
			callsStore.setActiveCall({ ...joinableCall, status: 'active' });
			await (await lk()).joinCallRoom(url, token, dmChannelId);
			// Populate call participants from server
			const callInfo = await getActiveCall(dmChannelId);
			if (callInfo?.participants) {
				for (const p of callInfo.participants) {
					callsStore.addParticipant(p);
				}
			}
			const me = authStore.user;
			if (me) callsStore.addParticipant({ user_id: me.id, username: me.username });
		} catch (err: any) {
			console.error('[DmChat] Failed to join call:', err);
			callError = err?.message || 'Failed to join call';
			setTimeout(() => { callError = null; }, 5000);
		} finally {
			callLoading = false;
		}
	}

	async function handleSendDm() {
		const trimmed = message.trim();
		if (!trimmed || sending) return;

		sending = true;
		message = '';

		try {
			const msg = await sendDmMessage(dmChannelId, trimmed);
			messagesStore.addMessage(dmChannelId, msg);
			dmsStore.bumpToTop(dmChannelId);
		} catch (err) {
			console.error('[DmChat] Failed to send DM:', err);
			message = trimmed;
		} finally {
			sending = false;
			inputEl?.focus();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSendDm();
		}
	}
</script>

<section class="dm-chat-area">
	<header class="chat-header">
		{#if isGroup}
			<div class="header-avatar group-avatar" style:background={getAvatarGradient(groupDisplayName)}>
				{getInitial(groupDisplayName)}
			</div>
			<span class="header-name">{groupDisplayName}</span>
			<span class="header-meta">{memberCount} Members</span>
		{:else}
			<div class="header-avatar" style:background={getAvatarGradient(recipientName)}>
				{#if dmChannel?.recipient_avatar_url}
					<img src={dmChannel.recipient_avatar_url} alt={recipientName} class="avatar-img" />
				{:else}
					{getInitial(recipientName)}
				{/if}
				<span class="status-indicator" style:background-color={statusColors[recipientStatus]}></span>
			</div>
			<span class="header-name">@{recipientName}</span>
			<span class="header-status-text">{recipientStatus === 'dnd' ? 'Do Not Disturb' : recipientStatus.charAt(0).toUpperCase() + recipientStatus.slice(1)}</span>
		{/if}

		<div class="header-icons">
			{#if hasJoinableCall}
				<button
					class="header-icon-btn join-call-btn"
					aria-label="Join call"
					onclick={handleJoinCall}
					disabled={callLoading}
				>
					<Phone size={18} />
					<span class="join-call-label">Join Call</span>
				</button>
			{:else}
				<button
					class="header-icon-btn"
					aria-label="Start call"
					onclick={handleStartCall}
					disabled={callLoading || isInCall}
				>
					<Phone size={20} />
				</button>
			{/if}
			<button
				class="header-icon-btn"
				aria-label="Video call"
				onclick={handleStartVideoCall}
				disabled={callLoading || isInCall}
			>
				<Video size={20} />
			</button>
		</div>
	</header>

	<!-- Discord-style call panel — takes upper portion of content area -->
	{#if isInCall}
		<div class="call-region">
			<div class="call-stage">
				{#if isCallActive}
					{#if isScreenShareActive}
						<!-- Presentation mode: screen share main + side strip -->
						<div class="presentation-layout">
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="screenshare-main"
								bind:this={screenShareMainEl}
								ondblclick={toggleFullscreen}
							>
								{#if videoElements.get(activeScreenShareUserId ?? '')?.screenshare}
									<div class="screenshare-video-container" use:attachScreenShare={() => videoElements.get(activeScreenShareUserId ?? '')?.screenshare}></div>
								{:else}
									<div class="screenshare-placeholder">
										<MonitorUp size={48} />
										<span>Loading screen share...</span>
									</div>
								{/if}
								<button class="fullscreen-btn" onclick={toggleFullscreen} aria-label="Toggle fullscreen">
									{#if isFullscreen}<Minimize size={18} />{:else}<Maximize size={18} />{/if}
								</button>
							</div>
							<div class="side-strip">
								{#each callsStore.participants as participant (participant.user_id)}
									{@const isMe = participant.user_id === myId}
									{@const voicePart = voiceStore.participants.find(p => p.userId === participant.user_id)}
									{@const pSpeaking = voicePart?.speaking ?? false}
									{@const pMuted = isMe ? voiceStore.muted : (voicePart?.muted ?? false)}
									{@const pDeafened = isMe ? voiceStore.deafened : (voicePart?.deafened ?? false)}
									{@const pVideoEnabled = voicePart?.videoEnabled ?? false}
									{@const pAvatarUrl = isMe ? myAvatarUrl : (participant.user_id === recipientId ? dmChannel?.recipient_avatar_url : null)}
									{@const vidEntry = videoElements.get(participant.user_id)}
								{@const pScreenSharing = isMe ? voiceStore.screenSharing : (voicePart?.screenSharing ?? false)}
								{@const isBeingWatched = activeScreenShareUserId === participant.user_id}
									<div class="side-tile" class:speaking={pSpeaking}>
										{#if pVideoEnabled && vidEntry?.camera}
											<div class="tile-video" use:attachVideo={() => vidEntry?.camera}></div>
										{:else}
											<div class="tile-avatar" style:background={getAvatarGradient(participant.username)}>
												{#if pAvatarUrl}
													<img src={pAvatarUrl} alt={participant.username} class="tile-avatar-img" />
												{:else}
													<span class="tile-avatar-initial">{getInitial(participant.username)}</span>
												{/if}
											</div>
										{/if}
										{#if pMuted || pDeafened}
											<div class="tile-status-badge">
												{#if pDeafened}<HeadphoneOff size={12} />{:else}<MicOff size={12} />{/if}
											</div>
										{/if}
										{#if pScreenSharing && !isBeingWatched}
											<button class="watch-btn" onclick={async () => (await lk()).watchScreenShare(participant.user_id)} aria-label="Watch screen share">
												<Eye size={12} />
												<span>Watch</span>
											</button>
										{/if}
										{#if pScreenSharing && isBeingWatched}
											<div class="watching-badge">
												<MonitorUp size={10} />
											</div>
										{/if}
										<span class="tile-name">{participant.username}</span>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<!-- Gallery mode: participants in flex layout with video -->
						<div class="call-participants gallery-layout">
							{#each callsStore.participants as participant (participant.user_id)}
								{@const isMe = participant.user_id === myId}
								{@const voicePart = voiceStore.participants.find(p => p.userId === participant.user_id)}
								{@const pSpeaking = voicePart?.speaking ?? false}
								{@const pMuted = isMe ? voiceStore.muted : (voicePart?.muted ?? false)}
								{@const pDeafened = isMe ? voiceStore.deafened : (voicePart?.deafened ?? false)}
								{@const pVideoEnabled = voicePart?.videoEnabled ?? false}
								{@const pAvatarUrl = isMe ? myAvatarUrl : (participant.user_id === recipientId ? dmChannel?.recipient_avatar_url : null)}
								{@const vidEntry = videoElements.get(participant.user_id)}
							{@const pScreenSharing = isMe ? voiceStore.screenSharing : (voicePart?.screenSharing ?? false)}
								<div class="call-participant">
									{#if pVideoEnabled && vidEntry?.camera}
										<div class="gallery-video-wrapper" class:speaking={pSpeaking}>
											<div class="gallery-video" use:attachVideo={() => vidEntry?.camera}></div>
											{#if pMuted || pDeafened}
												<div class="call-status-badge video-badge">
													{#if pDeafened}<HeadphoneOff size={14} />{:else}<MicOff size={14} />{/if}
												</div>
											{/if}
										</div>
									{:else}
										<div class="call-avatar-wrapper">
											<div class="call-avatar-ring" class:speaking={pSpeaking}>
												<div class="call-avatar-large" style:background={getAvatarGradient(participant.username)}>
													{#if pAvatarUrl}
														<img src={pAvatarUrl} alt={participant.username} class="call-avatar-img" />
													{:else}
														<span class="call-avatar-initial">{getInitial(participant.username)}</span>
													{/if}
												</div>
											</div>
											{#if pMuted || pDeafened}
												<div class="call-status-badge">
													{#if pDeafened}<HeadphoneOff size={14} />{:else}<MicOff size={14} />{/if}
												</div>
											{/if}
										</div>
									{/if}
									<span class="call-participant-name">{participant.username}</span>
									{#if pScreenSharing}
										<button class="gallery-watch-btn" onclick={async () => (await lk()).watchScreenShare(participant.user_id)} aria-label="Watch screen share">
											<Eye size={14} />
											<span>Watch Stream</span>
										</button>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
					<span class="call-state-text connected">{formatDuration(callElapsed)}</span>
				{:else}
					<!-- Single avatar when ringing/loading -->
					<div class="call-avatar-wrapper">
						<div class="call-avatar-ring" class:ringing={isRinging || callLoading}>
							<div class="call-avatar-large" style:background={getAvatarGradient(recipientName)}>
								{#if dmChannel?.recipient_avatar_url}
									<img src={dmChannel.recipient_avatar_url} alt={recipientName} class="call-avatar-img" />
								{:else}
									<span class="call-avatar-initial">{getInitial(recipientName)}</span>
								{/if}
							</div>
						</div>
						{#if isRinging || callLoading}
							<span class="call-ring-pulse"></span>
							<span class="call-ring-pulse delay"></span>
						{/if}
					</div>
					<span class="call-recipient-name">{recipientName}</span>
					{#if callError}
						<span class="call-state-error">{callError}</span>
						<button class="call-dismiss-btn" onclick={() => { callError = null; }}>Dismiss</button>
					{:else if callLoading}
						<span class="call-state-text">Starting call...</span>
					{:else if isRinging}
						<span class="call-state-text">Ringing...</span>
					{/if}
				{/if}
			</div>

			<!-- Control bar at bottom of call region -->
			<div class="call-control-bar">
				<button class="call-ctrl-btn" aria-label="Toggle mute" onclick={async () => (await lk()).toggleMute()} class:active-state={voiceStore.muted}>
					{#if voiceStore.muted}<MicOff size={20} />{:else}<Mic size={20} />{/if}
				</button>
				<button class="call-ctrl-btn" aria-label="Toggle deafen" onclick={async () => (await lk()).toggleDeafen()} class:active-state={voiceStore.deafened}>
					{#if voiceStore.deafened}<HeadphoneOff size={20} />{:else}<Headphones size={20} />{/if}
				</button>
				<button class="call-ctrl-btn" aria-label="Toggle video" onclick={async () => (await lk()).toggleVideo()} class:active-state={voiceStore.videoEnabled}>
					{#if voiceStore.videoEnabled}<VideoOff size={20} />{:else}<Video size={20} />{/if}
				</button>
				<button class="call-ctrl-btn" aria-label="Screen share" onclick={handleScreenShareBtn} class:active-state={voiceStore.screenSharing}>
					<MonitorUp size={20} />
				</button>
				<button class="call-hangup-btn" aria-label="Hang up" onclick={handleHangUp}>
					<PhoneOff size={20} />
				</button>
			</div>

		</div>
	{/if}

	<!-- Chat area (pushed down when call is active) -->
	<div class="chat-body" class:compressed={isInCall}>
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading messages...</p>
			</div>
		{:else if error}
			<div class="error-state">
				<p>{error}</p>
				<button class="retry-btn" onclick={() => loadMessages(dmChannelId)}>Retry</button>
			</div>
		{:else}
			<MessageList {dmChannelId} />
		{/if}

		<div class="dm-input-wrapper">
			<div class="dm-input-bar">
				<input
					class="dm-input-field"
					type="text"
					placeholder={isGroup ? `Message ${groupDisplayName}` : `Message @${recipientName}`}
					bind:value={message}
					bind:this={inputEl}
					onkeydown={handleKeydown}
					disabled={sending}
				/>
			</div>
		</div>
	</div>
</section>

{#if showScreenSharePicker}
	<ScreenSharePicker
		onclose={() => showScreenSharePicker = false}
		onshare={handleScreenSharePicked}
	/>
{/if}

<style>
	.dm-chat-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: transparent;
		position: relative;
	}

	/* ===== Header ===== */
	.chat-header {
		height: 52px;
		padding: 0 16px;
		display: flex;
		align-items: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		font-weight: 600;
		background: rgba(0, 0, 0, 0.01);
		gap: 10px;
		flex-shrink: 0;
	}

	.header-avatar {
		width: 32px;
		height: 32px;
		min-width: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		font-weight: 600;
		color: white;
		position: relative;
		overflow: visible;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.status-indicator {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid rgba(28, 28, 30, 0.92);
	}

	.group-avatar { border-radius: 10px; }

	.header-name {
		font-size: 15px;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: rgba(255, 255, 255, 0.95);
	}

	.header-status-text, .header-meta {
		font-size: 13px;
		font-weight: 400;
		color: rgba(235, 235, 245, 0.4);
		white-space: nowrap;
	}

	.header-icons {
		margin-left: auto;
		display: flex;
		gap: 16px;
		color: rgba(235, 235, 245, 0.6);
	}

	.header-icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		transition: color 0.2s;
	}
	.header-icon-btn:hover:not(:disabled) { color: rgba(255, 255, 255, 0.95); }
	.header-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

	.join-call-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: rgba(48, 209, 88, 0.15);
		color: #30d158;
		padding: 4px 12px;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		transition: background 0.15s, color 0.15s;
	}
	.join-call-btn:hover:not(:disabled) {
		background: rgba(48, 209, 88, 0.25);
		color: #30d158;
	}

	.join-call-label {
		white-space: nowrap;
	}

	/* ===== Discord-style Call Region ===== */
	.call-region {
		flex: 1 1 45%;
		min-height: 200px;
		max-height: 55%;
		display: flex;
		flex-direction: column;
		background: radial-gradient(ellipse at 50% 40%, rgba(30, 30, 50, 0.95), rgba(10, 10, 18, 0.98));
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		animation: callFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
		overflow: hidden;
	}

	@keyframes callFadeIn {
		from { opacity: 0; transform: translateY(-12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Center stage: avatar + name + status */
	.call-stage {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 24px;
		min-height: 0;
	}

	/* Avatar wrapper for pulse rings */
	.call-avatar-wrapper {
		position: relative;
		width: 96px;
		height: 96px;
	}

	.call-avatar-ring {
		width: 96px;
		height: 96px;
		border-radius: 50%;
		padding: 3px;
		background: transparent;
		transition: box-shadow 0.3s ease;
	}

	.call-avatar-ring.ringing {
		box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.4);
	}

	.call-avatar-ring.speaking {
		box-shadow: 0 0 0 3px rgba(48, 209, 88, 0.7);
	}

	.call-avatar-large {
		width: 90px;
		height: 90px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.call-avatar-img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.call-avatar-initial {
		font-size: 36px;
		font-weight: 700;
		color: white;
		line-height: 1;
	}

	/* Pulse rings during ringing */
	.call-ring-pulse {
		position: absolute;
		inset: -6px;
		border-radius: 50%;
		border: 2px solid rgba(10, 132, 255, 0.4);
		animation: ringPulse 2s ease-out infinite;
		pointer-events: none;
	}
	.call-ring-pulse.delay {
		animation-delay: 0.7s;
	}

	@keyframes ringPulse {
		0% { transform: scale(1); opacity: 0.6; }
		100% { transform: scale(1.5); opacity: 0; }
	}

	.call-participants {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 40px;
	}

	.call-participant {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.call-participant-name {
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.85);
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}

	.call-status-badge {
		position: absolute;
		bottom: 2px;
		right: 2px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: rgba(30, 30, 34, 0.95);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ff453a;
		border: 2px solid rgba(30, 30, 34, 0.95);
	}

	.call-recipient-name {
		font-size: 18px;
		font-weight: 700;
		color: white;
		margin-top: 4px;
	}

	.call-state-text {
		font-size: 13px;
		font-weight: 500;
		color: rgba(235, 235, 245, 0.4);
		letter-spacing: 0.3px;
	}
	.call-state-text.connected {
		color: rgba(48, 209, 88, 0.9);
		font-variant-numeric: tabular-nums;
	}
	.call-state-error {
		font-size: 13px;
		font-weight: 500;
		color: #ff453a;
		margin-top: 4px;
		max-width: 300px;
		text-align: center;
		line-height: 1.4;
	}

	.call-dismiss-btn {
		margin-top: 8px;
		padding: 6px 20px;
		border-radius: 6px;
		border: none;
		background: rgba(255, 255, 255, 0.1);
		color: rgba(235, 235, 245, 0.7);
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s;
	}
	.call-dismiss-btn:hover {
		background: rgba(255, 255, 255, 0.18);
		color: white;
	}

	/* ===== Gallery Video Layout ===== */
	.gallery-layout {
		flex-wrap: wrap;
	}

	.gallery-video-wrapper {
		position: relative;
		width: 160px;
		height: 120px;
		border-radius: 12px;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.4);
		transition: box-shadow 0.3s ease;
	}
	.gallery-video-wrapper.speaking {
		box-shadow: 0 0 0 3px rgba(48, 209, 88, 0.7);
	}

	.gallery-video {
		width: 100%;
		height: 100%;
		border-radius: 12px;
		overflow: hidden;
	}

	.video-badge {
		bottom: 4px;
		right: 4px;
	}

	/* ===== Presentation Layout (Screen Share) ===== */
	.presentation-layout {
		display: flex;
		width: 100%;
		height: 100%;
		gap: 8px;
		min-height: 0;
	}

	.screenshare-main {
		flex: 1;
		background: #000;
		border-radius: 8px;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
		overflow: hidden;
	}

	.screenshare-video-container {
		width: 100%;
		height: 100%;
	}

	.screenshare-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		color: rgba(235, 235, 245, 0.3);
	}
	.screenshare-placeholder span {
		font-size: 14px;
	}

	.fullscreen-btn {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 32px;
		height: 32px;
		border-radius: 6px;
		border: none;
		background: rgba(0, 0, 0, 0.6);
		color: rgba(255, 255, 255, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.2s, background 0.15s;
	}
	.screenshare-main:hover .fullscreen-btn {
		opacity: 1;
	}
	.fullscreen-btn:hover {
		background: rgba(0, 0, 0, 0.8);
		color: white;
	}

	/* Side strip for participants during screen share */
	.side-strip {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 120px;
		flex-shrink: 0;
		overflow-y: auto;
		padding: 4px 0;
	}

	.side-tile {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 6px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.04);
		transition: box-shadow 0.3s ease;
	}
	.side-tile.speaking {
		box-shadow: 0 0 0 2px rgba(48, 209, 88, 0.6);
	}

	.tile-video {
		width: 100%;
		aspect-ratio: 4/3;
		border-radius: 6px;
		overflow: hidden;
		background: rgba(0, 0, 0, 0.3);
	}

	.tile-avatar {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.tile-avatar-img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.tile-avatar-initial {
		font-size: 22px;
		font-weight: 700;
		color: white;
	}

	.tile-status-badge {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: rgba(30, 30, 34, 0.95);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ff453a;
	}

	.tile-name {
		font-size: 11px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.7);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}

	/* Watch button on side-strip tiles (screen share selective subscription) */
	.watch-btn {
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 2px 8px;
		border-radius: 4px;
		border: none;
		background: rgba(10, 132, 255, 0.2);
		color: #0a84ff;
		font-size: 10px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s;
	}
	.watch-btn:hover {
		background: rgba(10, 132, 255, 0.35);
	}

	/* "Watching" indicator badge on side-strip tile */
	.watching-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: rgba(48, 209, 88, 0.2);
		color: #30d158;
	}

	/* Watch button in gallery layout (under participant) */
	.gallery-watch-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 12px;
		border-radius: 6px;
		border: none;
		background: rgba(10, 132, 255, 0.15);
		color: #0a84ff;
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s, transform 0.1s;
		margin-top: 4px;
	}
	.gallery-watch-btn:hover {
		background: rgba(10, 132, 255, 0.3);
	}
	.gallery-watch-btn:active {
		transform: scale(0.95);
	}

	/* Control bar at bottom of call region */
	.call-control-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 16px;
		background: rgba(0, 0, 0, 0.25);
		flex-shrink: 0;
	}

	.call-ctrl-btn {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		border: none;
		background: rgba(255, 255, 255, 0.1);
		color: rgba(235, 235, 245, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 0.15s, color 0.15s, box-shadow 0.15s;
	}
	.call-ctrl-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.18);
		color: white;
	}
	.call-ctrl-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	.call-ctrl-btn.active-state {
		background: rgba(255, 69, 58, 0.25);
		color: #ff453a;
	}
	.call-ctrl-btn.active-state:hover {
		background: rgba(255, 69, 58, 0.35);
	}

	.call-hangup-btn {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		border: none;
		background: #ff453a;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 0.15s, transform 0.1s;
		margin-left: 8px;
	}
	.call-hangup-btn:hover { background: #ff6961; }
	.call-hangup-btn:active { transform: scale(0.93); }

	/* ===== Chat body (messages + input) ===== */
	.chat-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.chat-body.compressed {
		flex: 1 1 45%;
		min-height: 120px;
	}

	/* ===== Loading / Error ===== */
	.loading-state, .error-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: rgba(235, 235, 245, 0.3);
	}
	.loading-state p, .error-state p { font-size: 14px; margin: 0; }

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid rgba(255, 255, 255, 0.1);
		border-top-color: var(--accent-blue, #0a84ff);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.retry-btn {
		padding: 8px 16px;
		border-radius: 8px;
		border: none;
		background: rgba(var(--accent-rgb, 10, 132, 255), 0.15);
		color: var(--accent-blue, #0a84ff);
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s;
	}
	.retry-btn:hover { background: rgba(var(--accent-rgb, 10, 132, 255), 0.25); }

	/* ===== DM Message Input ===== */
	.dm-input-wrapper {
		padding: 0 16px 24px 16px;
		position: relative;
		flex-shrink: 0;
	}

	.dm-input-bar {
		background: var(--bg-glass-light, rgba(44, 44, 46, 0.4));
		border-radius: 12px;
		padding: 0 16px;
		display: flex;
		align-items: center;
		min-height: 44px;
		transition: box-shadow 0.2s;
		border: 1px solid transparent;
	}
	.dm-input-bar:focus-within {
		background: var(--bg-glass-heavy, rgba(28, 28, 30, 0.65));
		border-color: rgba(255, 255, 255, 0.2);
		box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.2);
	}

	.dm-input-field {
		flex: 1;
		background: transparent;
		border: none;
		color: white;
		padding: 12px 0;
		font-size: 15px;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, sans-serif;
	}
	.dm-input-field::placeholder { color: rgba(235, 235, 245, 0.3); }
	.dm-input-field:focus { outline: none; }
	.dm-input-field:disabled { opacity: 0.5; }
</style>
