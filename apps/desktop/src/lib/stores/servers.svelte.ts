import { SvelteMap } from 'svelte/reactivity';
import type { Server } from '$lib/types';

class ServersStore {
	/** O(1) lookup by server ID */
	private byId = new SvelteMap<string, Server>();
	/** Ordered list of server IDs */
	private order = $state<string[]>([]);
	activeServerId = $state<string | null>(null);

	/** O(1) active server lookup */
	activeServer = $derived(this.activeServerId ? this.byId.get(this.activeServerId) ?? null : null);

	/** Ordered servers for UI iteration */
	get servers(): Server[] {
		return this.order.map((id) => this.byId.get(id)).filter((s): s is Server => s != null);
	}

	setServers(servers: Server[]) {
		this.byId.clear();
		for (const s of servers) {
			this.byId.set(s.id, s);
		}
		this.order = servers.map((s) => s.id);
	}

	addServer(server: Server) {
		this.byId.set(server.id, server);
		if (!this.order.includes(server.id)) {
			this.order = [...this.order, server.id];
		}
	}

	removeServer(id: string) {
		this.byId.delete(id);
		this.order = this.order.filter((sid) => sid !== id);
		if (this.activeServerId === id) {
			this.activeServerId = this.order[0] ?? null;
		}
	}

	setActive(id: string | null) {
		this.activeServerId = id;
	}

	updateServer(id: string, data: Partial<Server>) {
		const existing = this.byId.get(id);
		if (!existing) return;
		this.byId.set(id, { ...existing, ...data });
	}
}

export const serversStore = new ServersStore();
