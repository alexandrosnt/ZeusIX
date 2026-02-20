import { SvelteMap } from 'svelte/reactivity';
import type { Call, CallParticipantInfo } from '$lib/types';

class CallsStore {
	activeCall = $state<Call | null>(null);
	incomingCall = $state<Call | null>(null);
	participants = $state<CallParticipantInfo[]>([]);

	/** Known active/ringing calls per DM channel (real-time from gateway) */
	knownCalls = new SvelteMap<string, Call>();

	setActiveCall(call: Call | null) {
		this.activeCall = call;
	}

	setIncomingCall(call: Call | null) {
		this.incomingCall = call;
	}

	/** Track a call we learned about (CALL_CREATE / CALL_UPDATE) */
	setKnownCall(dmChannelId: string, call: Call) {
		this.knownCalls.set(dmChannelId, call);
	}

	/** Remove a known call (CALL_DELETE) */
	removeKnownCall(dmChannelId: string) {
		this.knownCalls.delete(dmChannelId);
	}

	/** Get a joinable call for a DM — one that exists but we're not in */
	getJoinableCall(dmChannelId: string): Call | null {
		// If we're already in this call, not joinable
		if (this.activeCall?.dm_channel_id === dmChannelId) return null;
		return this.knownCalls.get(dmChannelId) ?? null;
	}

	addParticipant(info: CallParticipantInfo) {
		// Avoid duplicates
		if (!this.participants.some(p => p.user_id === info.user_id)) {
			this.participants = [...this.participants, info];
		}
	}

	removeParticipant(userId: string) {
		this.participants = this.participants.filter(p => p.user_id !== userId);
	}

	clearAll() {
		this.activeCall = null;
		this.incomingCall = null;
		this.participants = [];
	}
}

export const callsStore = new CallsStore();
