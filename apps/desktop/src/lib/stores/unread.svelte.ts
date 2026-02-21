import { SvelteMap } from 'svelte/reactivity';

class UnreadStore {
	/** channel_id → unread count */
	private counts = new SvelteMap<string, number>();

	/** Set of ignored user IDs — no notifications for these */
	private ignoredUsers = new SvelteSet<string>();

	getCount(channelId: string): number {
		return this.counts.get(channelId) ?? 0;
	}

	get totalUnread(): number {
		let sum = 0;
		for (const count of this.counts.values()) sum += count;
		return sum;
	}

	increment(channelId: string) {
		this.counts.set(channelId, (this.counts.get(channelId) ?? 0) + 1);
	}

	clear(channelId: string) {
		this.counts.delete(channelId);
	}

	clearAll() {
		this.counts.clear();
	}

	// Ignored users management
	isIgnored(userId: string): boolean {
		return this.ignoredUsers.has(userId);
	}

	ignoreUser(userId: string) {
		this.ignoredUsers.add(userId);
	}

	unignoreUser(userId: string) {
		this.ignoredUsers.delete(userId);
	}
}

class SvelteSet<T> extends Set<T> {
	#version = $state(0);

	has(value: T): boolean {
		this.#version;
		return super.has(value);
	}

	add(value: T): this {
		super.add(value);
		this.#version++;
		return this;
	}

	delete(value: T): boolean {
		const result = super.delete(value);
		if (result) this.#version++;
		return result;
	}
}

export const unreadStore = new UnreadStore();
