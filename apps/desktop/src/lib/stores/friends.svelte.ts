import type { Friendship } from '$lib/types';

class FriendsStore {
	friends = $state<Friendship[]>([]);

	setFriends(list: Friendship[]) {
		this.friends = list;
	}

	addOrUpdate(friend: Friendship) {
		const idx = this.friends.findIndex((f) => f.id === friend.id);
		if (idx !== -1) {
			this.friends[idx] = friend;
		} else {
			this.friends.push(friend);
		}
	}

	updateStatus(friendshipId: string, status: string) {
		const idx = this.friends.findIndex((f) => f.id === friendshipId);
		if (idx !== -1) {
			this.friends[idx] = { ...this.friends[idx], status };
		}
	}

	remove(friendshipId: string) {
		this.friends = this.friends.filter((f) => f.id !== friendshipId);
	}
}

export const friendsStore = new FriendsStore();
