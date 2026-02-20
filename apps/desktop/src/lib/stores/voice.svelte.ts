import { SvelteMap } from 'svelte/reactivity';

export interface VoiceParticipant {
	userId: string;
	username: string;
	speaking: boolean;
	muted: boolean;
	deafened: boolean;
	videoEnabled: boolean;
	screenSharing: boolean;
}

export type RtcStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export interface VoiceStats {
	latencyMs: number;
	codec: string;
	packetLoss: number;
	jitter: number;
	bitrate: number;
	server: string;
}

class VoiceStore {
	channelId = $state<string | null>(null);
	connected = $state(false);
	muted = $state(false);
	deafened = $state(false);
	/** O(1) participant lookup by userId */
	private participantsMap = new SvelteMap<string, VoiceParticipant>();
	screenSharing = $state(false);
	videoEnabled = $state(false);
	activeScreenShareUserId = $state<string | null>(null);

	rtcStatus = $state<RtcStatus>('idle');
	stats = $state<VoiceStats>({
		latencyMs: 0,
		codec: '—',
		packetLoss: 0,
		jitter: 0,
		bitrate: 0,
		server: '—'
	});

	isInVoice = $derived(this.connected && this.channelId !== null);

	/** Expose participants as array for iteration */
	get participants(): VoiceParticipant[] {
		return Array.from(this.participantsMap.values());
	}

	/** Get list of participants currently screen sharing */
	get screenSharers(): VoiceParticipant[] {
		return this.participants.filter(p => p.screenSharing);
	}

	join(channelId: string) {
		this.channelId = channelId;
		this.connected = true;
	}

	setRtcStatus(status: RtcStatus) {
		this.rtcStatus = status;
	}

	updateStats(stats: Partial<VoiceStats>) {
		this.stats = { ...this.stats, ...stats };
	}

	setActiveScreenShare(userId: string | null) {
		this.activeScreenShareUserId = userId;
	}

	disconnect() {
		this.channelId = null;
		this.connected = false;
		this.muted = false;
		this.deafened = false;
		this.participantsMap.clear();
		this.screenSharing = false;
		this.videoEnabled = false;
		this.activeScreenShareUserId = null;
		this.rtcStatus = 'idle';
		this.stats = { latencyMs: 0, codec: '—', packetLoss: 0, jitter: 0, bitrate: 0, server: '—' };
	}

	toggleMute() {
		if (this.deafened) {
			this.deafened = false;
			this.muted = false;
		} else {
			this.muted = !this.muted;
		}
	}

	toggleDeafen() {
		if (this.deafened) {
			this.deafened = false;
			this.muted = false;
		} else {
			this.deafened = true;
			this.muted = true;
		}
	}

	toggleVideo() {
		this.videoEnabled = !this.videoEnabled;
	}

	toggleScreenShare() {
		this.screenSharing = !this.screenSharing;
	}

	setParticipants(participants: VoiceParticipant[]) {
		this.participantsMap.clear();
		for (const p of participants) {
			this.participantsMap.set(p.userId, p);
		}
	}

	addParticipant(participant: VoiceParticipant) {
		if (this.participantsMap.has(participant.userId)) return;
		this.participantsMap.set(participant.userId, participant);
	}

	removeParticipant(userId: string) {
		this.participantsMap.delete(userId);
	}

	updateParticipant(userId: string, data: Partial<VoiceParticipant>) {
		const existing = this.participantsMap.get(userId);
		if (!existing) return;
		this.participantsMap.set(userId, { ...existing, ...data });
	}

	getParticipantsByChannel(channelId: string): VoiceParticipant[] {
		if (this.channelId !== channelId) return [];
		return this.participants;
	}
}

export const voiceStore = new VoiceStore();
