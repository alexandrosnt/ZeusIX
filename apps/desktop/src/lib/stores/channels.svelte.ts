import { SvelteMap } from 'svelte/reactivity';
import type { Channel, Category } from '$lib/types';

class ChannelsStore {
	/** O(1) lookup by channel ID */
	private byId = new SvelteMap<string, Channel>();
	/** Ordered list of channel IDs */
	private order = $state<string[]>([]);
	activeChannelId = $state<string | null>(null);

	/** O(1) active channel lookup */
	activeChannel = $derived(this.activeChannelId ? this.byId.get(this.activeChannelId) ?? null : null);

	/** Ordered channels for iteration */
	get channels(): Channel[] {
		return this.order.map((id) => this.byId.get(id)).filter((c): c is Channel => c != null);
	}

	categories = $derived.by(() => {
		const allChannels = this.channels;
		const cats: Category[] = [];
		const categoryChannels = allChannels.filter((c) => c.channel_type === 'category');
		const nonCategoryChannels = allChannels.filter((c) => c.channel_type !== 'category');

		for (const cat of categoryChannels.sort((a, b) => a.position - b.position)) {
			cats.push({
				id: cat.id,
				name: cat.name,
				channels: nonCategoryChannels
					.filter((c) => c.category_id === cat.id)
					.sort((a, b) => a.position - b.position)
			});
		}

		// Uncategorized channels
		const uncategorized = nonCategoryChannels.filter((c) => !c.category_id);
		if (uncategorized.length > 0) {
			cats.unshift({
				id: '__uncategorized',
				name: 'Channels',
				channels: uncategorized.sort((a, b) => a.position - b.position)
			});
		}

		return cats;
	});

	setChannels(channels: Channel[]) {
		this.byId.clear();
		for (const c of channels) {
			this.byId.set(c.id, c);
		}
		this.order = channels.map((c) => c.id);
	}

	setActive(id: string | null) {
		this.activeChannelId = id;
	}

	addChannel(channel: Channel) {
		this.byId.set(channel.id, channel);
		if (!this.order.includes(channel.id)) {
			this.order = [...this.order, channel.id];
		}
	}

	removeChannel(id: string) {
		this.byId.delete(id);
		this.order = this.order.filter((cid) => cid !== id);
	}
}

export const channelsStore = new ChannelsStore();
