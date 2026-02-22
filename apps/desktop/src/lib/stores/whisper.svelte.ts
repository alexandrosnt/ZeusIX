const STORAGE_KEY = 'zeusix_whisper_lists';

class WhisperStore {
	/** Per-server whisper target channel IDs, persisted to localStorage */
	private lists = $state<Map<string, Set<string>>>(new Map());

	/** Whisper key currently held */
	active = $state(false);

	/** Whisper rooms connected and ready */
	connected = $state(false);

	/** Which channels have active whisper room connections */
	connectedChannelIds = $state<string[]>([]);

	constructor() {
		this.restore();
	}

	getTargets(serverId: string): string[] {
		return Array.from(this.lists.get(serverId) ?? []);
	}

	isTarget(serverId: string, channelId: string): boolean {
		return this.lists.get(serverId)?.has(channelId) ?? false;
	}

	toggleTarget(serverId: string, channelId: string) {
		let set = this.lists.get(serverId);
		if (!set) {
			set = new Set();
			this.lists.set(serverId, set);
		}
		if (set.has(channelId)) {
			set.delete(channelId);
		} else {
			set.add(channelId);
		}
		// Trigger reactivity by reassigning
		this.lists = new Map(this.lists);
		this.persist();
	}

	setTargets(serverId: string, channelIds: string[]) {
		this.lists.set(serverId, new Set(channelIds));
		this.lists = new Map(this.lists);
		this.persist();
	}

	hasTargets(serverId: string): boolean {
		const set = this.lists.get(serverId);
		return !!set && set.size > 0;
	}

	setActive(value: boolean) {
		this.active = value;
	}

	setConnected(value: boolean, channelIds: string[] = []) {
		this.connected = value;
		this.connectedChannelIds = channelIds;
	}

	/** Reset runtime state (active/connected) without clearing saved targets */
	resetRuntime() {
		this.active = false;
		this.connected = false;
		this.connectedChannelIds = [];
	}

	private persist() {
		try {
			if (typeof localStorage === 'undefined') return;
			const obj: Record<string, string[]> = {};
			for (const [serverId, set] of this.lists) {
				if (set.size > 0) {
					obj[serverId] = Array.from(set);
				}
			}
			localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
		} catch {
			// localStorage may be unavailable
		}
	}

	private restore() {
		try {
			if (typeof localStorage === 'undefined') return;
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw) as Record<string, string[]>;
			const map = new Map<string, Set<string>>();
			for (const [serverId, ids] of Object.entries(parsed)) {
				if (Array.isArray(ids)) {
					map.set(serverId, new Set(ids));
				}
			}
			this.lists = map;
		} catch {
			// corrupt data — keep empty
		}
	}
}

export const whisperStore = new WhisperStore();
