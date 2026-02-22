import { SvelteMap } from 'svelte/reactivity';

export interface VoiceChannelParticipant {
	userId: string;
	username: string;
	muted: boolean;
	deafened: boolean;
}

/**
 * Tracks voice participants per channel across the entire server,
 * regardless of whether the local user is connected to voice.
 */
class VoiceChannelStore {
	/** Map<channelId, Map<userId, participant>> */
	private channels = new SvelteMap<string, SvelteMap<string, VoiceChannelParticipant>>();

	/** Get participants for a specific channel */
	getParticipants(channelId: string): VoiceChannelParticipant[] {
		const map = this.channels.get(channelId);
		return map ? Array.from(map.values()) : [];
	}

	/** Get participant count for a channel */
	getCount(channelId: string): number {
		return this.channels.get(channelId)?.size ?? 0;
	}

	/** Bulk-set initial voice states (e.g. on server switch) */
	setStates(states: { channel_id: string; user_id: string; username: string }[]) {
		this.channels.clear();
		for (const s of states) {
			this.addParticipant(s.channel_id, {
				userId: s.user_id,
				username: s.username,
				muted: false,
				deafened: false
			});
		}
	}

	/** A user joined a voice channel */
	addParticipant(channelId: string, participant: VoiceChannelParticipant) {
		let map = this.channels.get(channelId);
		if (!map) {
			map = new SvelteMap();
			this.channels.set(channelId, map);
		}
		map.set(participant.userId, participant);
	}

	/** A user left a voice channel */
	removeParticipant(channelId: string, userId: string) {
		const map = this.channels.get(channelId);
		if (!map) return;
		map.delete(userId);
		if (map.size === 0) {
			this.channels.delete(channelId);
		}
	}

	/** Update participant state (mute/deafen) */
	updateParticipant(channelId: string, userId: string, data: Partial<VoiceChannelParticipant>) {
		const map = this.channels.get(channelId);
		if (!map) return;
		const existing = map.get(userId);
		if (!existing) return;
		map.set(userId, { ...existing, ...data });
	}

	/** Clear all state (e.g. on server switch) */
	clear() {
		this.channels.clear();
	}
}

export const voiceChannelStore = new VoiceChannelStore();
