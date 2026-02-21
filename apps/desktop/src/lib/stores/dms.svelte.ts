import { SvelteMap } from 'svelte/reactivity';
import type { DmChannel } from '$lib/types';

class DmsStore {
	/** O(1) lookup by channel ID */
	private byId = new SvelteMap<string, DmChannel>();
	/** Ordered list of channel IDs (most recent first) */
	private order = $state<string[]>([]);
	activeChannelId = $state<string | null>(null);

	/** Ordered channels derived from order + map */
	get channels(): DmChannel[] {
		return this.order.map((id) => this.byId.get(id)).filter((c): c is DmChannel => c != null);
	}

	activeChannel = $derived(this.activeChannelId ? this.byId.get(this.activeChannelId) ?? null : null);

	setChannels(channels: DmChannel[]) {
		this.byId.clear();
		// Sort by most recently active first
		const sorted = [...channels].sort((a, b) => {
			const ta = a.updated_at || a.created_at || '';
			const tb = b.updated_at || b.created_at || '';
			return tb.localeCompare(ta);
		});
		for (const c of sorted) {
			this.byId.set(c.id, c);
		}
		this.order = sorted.map((c) => c.id);
	}

	addOrUpdateChannel(channel: DmChannel) {
		this.byId.set(channel.id, channel);
		if (!this.order.includes(channel.id)) {
			this.order = [channel.id, ...this.order];
		}
	}

	removeChannel(channelId: string) {
		this.byId.delete(channelId);
		this.order = this.order.filter((id) => id !== channelId);
		if (this.activeChannelId === channelId) {
			this.activeChannelId = null;
		}
	}

	setActive(channelId: string | null) {
		this.activeChannelId = channelId;
	}

	bumpToTop(channelId: string) {
		const idx = this.order.indexOf(channelId);
		if (idx > 0) {
			this.order = [channelId, ...this.order.filter((id) => id !== channelId)];
		}
	}
}

export const dmsStore = new DmsStore();
