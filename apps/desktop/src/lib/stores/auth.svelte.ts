import type { User } from '$lib/types';

class AuthStore {
	user = $state<User | null>(null);
	token = $state<string | null>(null);
	isAuthenticated = $derived(this.user !== null && this.token !== null);

	login(user: User, token: string) {
		this.user = user;
		this.token = token;
		localStorage.setItem('zeusix_token', token);
		localStorage.setItem('zeusix_user', JSON.stringify(user));
	}

	logout() {
		this.user = null;
		this.token = null;
		localStorage.removeItem('zeusix_token');
		localStorage.removeItem('zeusix_user');
	}

	/** Restore token + user from localStorage. Returns true if a session was found. */
	restoreSession(): boolean {
		const token = localStorage.getItem('zeusix_token');
		const userJson = localStorage.getItem('zeusix_user');
		if (token && userJson) {
			try {
				this.token = token;
				this.user = JSON.parse(userJson);
				return true;
			} catch {
				this.logout();
			}
		}
		return false;
	}

	/** Update the stored user with fresh data from the server */
	setUser(user: User) {
		this.user = user;
		localStorage.setItem('zeusix_user', JSON.stringify(user));
	}

}

export const authStore = new AuthStore();
