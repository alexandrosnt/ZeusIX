import { SvelteMap } from 'svelte/reactivity';
import type { Message } from '$lib/types';

class MessagesStore {
	/** Messages keyed by channel ID — SvelteMap for reactive O(1) channel lookups */
	private messagesByChannel = new SvelteMap<string, Message[]>();
	activeChannelId = $state<string | null>(null);

	currentMessages = $derived(this.messagesByChannel.get(this.activeChannelId ?? '') ?? []);

	setMessages(channelId: string, messages: Message[]) {
		this.messagesByChannel.set(channelId, messages);
	}

	addMessage(channelId: string, message: Message) {
		const existing = this.messagesByChannel.get(channelId) ?? [];
		// Deduplicate: don't add if a message with this ID already exists
		if (existing.some((m) => m.id === message.id)) return;
		this.messagesByChannel.set(channelId, [...existing, message]);
	}

	updateMessage(channelId: string, messageId: string, data: Partial<Message>) {
		const existing = this.messagesByChannel.get(channelId) ?? [];
		this.messagesByChannel.set(
			channelId,
			existing.map((m) => (m.id === messageId ? { ...m, ...data } : m))
		);
	}

	deleteMessage(channelId: string, messageId: string) {
		const existing = this.messagesByChannel.get(channelId) ?? [];
		this.messagesByChannel.set(
			channelId,
			existing.filter((m) => m.id !== messageId)
		);
	}

	clearChannel(channelId: string) {
		this.messagesByChannel.set(channelId, []);
	}

	setActiveChannel(channelId: string) {
		this.activeChannelId = channelId;
	}
}

export const messagesStore = new MessagesStore();
