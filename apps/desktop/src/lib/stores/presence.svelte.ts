import { SvelteMap } from 'svelte/reactivity';
import type { PresenceStatus } from '$lib/types';

interface UserPresence {
	userId: string;
	status: PresenceStatus;
	lastSeen: number;
}

class PresenceStore {
	presences = new SvelteMap<string, UserPresence>();
	typingUsers = new SvelteMap<string, Set<string>>();
	/** Track typing timers to prevent accumulation — keyed by "channelId:userId" */
	private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

	/** User's manually chosen status — survives reconnects via localStorage */
	chosenStatus = $state<PresenceStatus>('online');

	setChosenStatus(status: PresenceStatus) {
		this.chosenStatus = status;
		localStorage.setItem('zeusix_chosen_status', status);
	}

	restoreChosenStatus() {
		const saved = localStorage.getItem('zeusix_chosen_status') as PresenceStatus | null;
		if (saved && ['online', 'idle', 'dnd'].includes(saved)) {
			this.chosenStatus = saved;
		}
	}

	getStatus(userId: string): PresenceStatus {
		return this.presences.get(userId)?.status ?? 'offline';
	}

	getTypingInChannel(channelId: string): string[] {
		return Array.from(this.typingUsers.get(channelId) ?? []);
	}

	updatePresence(userId: string, status: PresenceStatus) {
		this.presences.set(userId, { userId, status, lastSeen: Date.now() });
	}

	setTyping(channelId: string, userId: string) {
		const existing = this.typingUsers.get(channelId) ?? new Set();
		existing.add(userId);
		this.typingUsers.set(channelId, existing);

		// Cancel existing timer for this user+channel to prevent accumulation
		const timerKey = `${channelId}:${userId}`;
		const oldTimer = this.typingTimers.get(timerKey);
		if (oldTimer) clearTimeout(oldTimer);

		// Auto-remove after 8 seconds
		this.typingTimers.set(
			timerKey,
			setTimeout(() => {
				this.typingTimers.delete(timerKey);
				this.clearTyping(channelId, userId);
			}, 8000)
		);
	}

	clearTyping(channelId: string, userId: string) {
		const existing = this.typingUsers.get(channelId);
		if (!existing) return;
		existing.delete(userId);
		if (existing.size === 0) {
			this.typingUsers.delete(channelId);
		} else {
			// Trigger reactivity by re-setting
			this.typingUsers.set(channelId, existing);
		}
	}

	bulkUpdate(presences: Array<{ userId: string; status: PresenceStatus }>) {
		for (const p of presences) {
			this.presences.set(p.userId, { userId: p.userId, status: p.status, lastSeen: Date.now() });
		}
	}
}

export const presenceStore = new PresenceStore();
