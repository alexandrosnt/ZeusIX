import { SvelteMap } from 'svelte/reactivity';
import type { ServerMember } from '$lib/types';

class MembersStore {
	/** Members keyed by user_id for O(1) lookups */
	private byUserId = new SvelteMap<string, ServerMember>();

	/** Expose as array for iteration (derived from Map) */
	get members(): ServerMember[] {
		return Array.from(this.byUserId.values());
	}

	setMembers(members: ServerMember[]) {
		this.byUserId.clear();
		for (const m of members) {
			this.byUserId.set(m.user_id, m);
		}
	}

	clear() {
		this.byUserId.clear();
	}

	addMember(member: ServerMember) {
		this.byUserId.set(member.user_id, member);
	}

	removeMember(userId: string) {
		this.byUserId.delete(userId);
	}

	/** O(1) member lookup by user ID */
	getMember(userId: string): ServerMember | undefined {
		return this.byUserId.get(userId);
	}

	/** Get the top role color for a member — O(1) lookup + sort */
	getTopRoleColor(userId: string): string | null {
		const member = this.byUserId.get(userId);
		if (!member?.roles || member.roles.length === 0) return null;
		const sorted = [...member.roles].sort((a, b) => b.position - a.position);
		return sorted[0].color ?? null;
	}
}

export const membersStore = new MembersStore();
