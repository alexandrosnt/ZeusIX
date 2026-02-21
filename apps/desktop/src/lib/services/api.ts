import { authStore } from '$lib/stores/auth.svelte';
import type { User, Server, Channel, Message, Invite, Friendship, DmChannel, Call, CallParticipantInfo } from '$lib/types';

const API_BASE = 'http://51.75.64.176:3002/api/v1';
const PUBLIC_HOST = 'http://51.75.64.176:3002';
const BROKEN_HOSTS = ['http://127.0.0.1:3002', 'http://127.0.0.1:3001', 'http://localhost:3002', 'http://0.0.0.0:3002'];

/** Rewrite any 127.0.0.1 / localhost upload URLs to the real public host */
function fixUrls<T>(data: T): T {
	if (data == null || typeof data !== 'object') return data;
	if (Array.isArray(data)) return data.map(fixUrls) as T;
	const obj = data as Record<string, unknown>;
	for (const key of Object.keys(obj)) {
		const val = obj[key];
		if (typeof val === 'string') {
			for (const broken of BROKEN_HOSTS) {
				if (val.startsWith(broken)) {
					obj[key] = PUBLIC_HOST + val.slice(broken.length);
					break;
				}
			}
		} else if (typeof val === 'object' && val !== null) {
			fixUrls(val);
		}
	}
	return data;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(options.headers as Record<string, string>)
	};

	if (authStore.token) {
		headers['Authorization'] = `Bearer ${authStore.token}`;
	}

	const response = await fetch(`${API_BASE}${path}`, {
		...options,
		headers
	});

	if (!response.ok) {
		const text = await response.text().catch(() => '');
		let message = `HTTP ${response.status}`;
		try {
			const json = JSON.parse(text);
			message = json.error || json.message || message;
		} catch {
			if (text) message += `: ${text}`;
		}
		console.error(`[API] ${response.status} ${response.statusText} — ${text}`);
		throw new Error(message);
	}

	return fixUrls(await response.json());
}

// Auth
export async function register(username: string, email: string, password: string) {
	return request<{ user: User; token: string }>('/auth/register', {
		method: 'POST',
		body: JSON.stringify({ username, email, password })
	});
}

export async function login(email: string, password: string) {
	return request<{ user: User; token: string }>('/auth/login', {
		method: 'POST',
		body: JSON.stringify({ email, password })
	});
}

// Servers
export async function getServers() {
	return request<Server[]>('/servers');
}

export async function createServer(name: string, isPublic: boolean = false) {
	return request<Server>('/servers', {
		method: 'POST',
		body: JSON.stringify({ name, is_public: isPublic })
	});
}

export async function getServer(serverId: string) {
	return request<Server>(`/servers/${serverId}`);
}

export async function deleteServer(serverId: string) {
	return request<void>(`/servers/${serverId}`, { method: 'DELETE' });
}

export async function leaveServer(serverId: string) {
	return request<{ left: boolean }>(`/servers/${serverId}/leave`, { method: 'POST' });
}

// Channels
export async function getChannels(serverId: string) {
	return request<Channel[]>(`/servers/${serverId}/channels`);
}

export async function createChannel(
	serverId: string,
	name: string,
	channelType: string = 'text',
	categoryId?: string
) {
	return request<Channel>(`/servers/${serverId}/channels`, {
		method: 'POST',
		body: JSON.stringify({ name, channel_type: channelType, category_id: categoryId })
	});
}

// Messages

/** Decode a byte array (from server) to a UTF-8 string */
function decodeContent(bytes: number[]): string {
	try {
		if (!bytes || bytes.length === 0) return '';
		return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
	} catch {
		return '\u26A0 Message could not be displayed';
	}
}

/** Map a raw server MessageResponse to frontend Message */
function mapMessage(raw: RawMessageResponse): Message {
	// Use current user's full profile if this is their message
	const currentUser = authStore.user;
	const isOwnMessage = currentUser && raw.author_id === currentUser.id;

	return {
		id: raw.id,
		channel_id: raw.channel_id,
		author_id: raw.author_id,
		content: decodeContent(raw.encrypted_content),
		encrypted_content: raw.encrypted_content,
		nonce: raw.nonce,
		message_type: raw.message_type ?? 'default',
		author_username: isOwnMessage ? currentUser.username : (raw.author_username ?? undefined),
		created_at: raw.created_at,
		edited_at: raw.edited_at,
		author: isOwnMessage
			? currentUser
			: raw.author_username
				? { id: raw.author_id, username: raw.author_username, discriminator: '0000', avatar_url: raw.author_avatar_url ?? null, cover_url: null, status: null, created_at: '' }
				: undefined
	};
}

interface RawMessageResponse {
	id: string;
	channel_id: string;
	author_id: string;
	author_username: string | null;
	author_avatar_url: string | null;
	encrypted_content: number[];
	nonce: number[] | null;
	message_type: string;
	created_at: string;
	edited_at: string | null;
}

export async function getMessages(channelId: string, limit: number = 50, before?: string) {
	const params = new URLSearchParams({ limit: String(limit) });
	if (before) params.set('before', before);
	const raw = await request<RawMessageResponse[]>(`/channels/${channelId}/messages?${params}`);
	return raw.map(mapMessage).reverse();
}

export async function sendMessage(channelId: string, plaintext: string) {
	const bytes = Array.from(new TextEncoder().encode(plaintext));
	const nonce = Array.from(crypto.getRandomValues(new Uint8Array(12)));
	const raw = await request<RawMessageResponse>(`/channels/${channelId}/messages`, {
		method: 'POST',
		body: JSON.stringify({ encrypted_content: bytes, nonce })
	});
	return mapMessage(raw);
}

export async function purgeChannelMessages(channelId: string): Promise<{ purged: number }> {
	return request<{ purged: number }>(`/channels/${channelId}/messages`, { method: 'DELETE' });
}

// Uploads
export async function uploadFile(file: File): Promise<{ url: string }> {
	const buffer = await file.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	const base64Data = btoa(binary);

	return request<{ url: string }>('/uploads', {
		method: 'POST',
		body: JSON.stringify({
			content_type: file.type,
			data: base64Data
		})
	});
}

// Users
export async function getMe() {
	return request<User>('/users/me');
}

export async function getUser(userId: string) {
	return request<User>(`/users/${userId}`);
}

export async function updateProfile(data: Partial<User>) {
	return request<User>('/users/me', {
		method: 'PATCH',
		body: JSON.stringify(data)
	});
}

// Invites
export async function createInvite(serverId: string, maxUses?: number, expiresIn?: number) {
	return request<Invite>('/invites', {
		method: 'POST',
		body: JSON.stringify({ server_id: serverId, max_uses: maxUses, expires_in: expiresIn })
	});
}

export async function useInvite(code: string) {
	return request<{ joined: boolean; server_id: string }>(`/invites/${code}/use`, { method: 'POST' });
}

// Discovery
export async function discoverServers(query?: string, limit: number = 20) {
	const params = new URLSearchParams({ limit: String(limit) });
	if (query) params.set('q', query);
	return request<Server[]>(`/discover?${params}`);
}

// Friends
export async function searchUsers(query: string, limit: number = 20) {
	const params = new URLSearchParams({ q: query, limit: String(limit) });
	return request<User[]>(`/users/search?${params}`);
}

export async function listFriends() {
	return request<Friendship[]>('/friends');
}

export async function sendFriendRequest(username: string, discriminator: string) {
	return request<{ id: string; status: string }>('/friends', {
		method: 'POST',
		body: JSON.stringify({ username, discriminator })
	});
}

export async function acceptFriend(friendshipId: string) {
	return request<{ status: string }>(`/friends/${friendshipId}/accept`, { method: 'PATCH' });
}

export async function declineFriend(friendshipId: string) {
	return request<{ status: string }>(`/friends/${friendshipId}/decline`, { method: 'PATCH' });
}

export async function removeFriend(friendshipId: string) {
	return request<{ removed: boolean }>(`/friends/${friendshipId}`, { method: 'DELETE' });
}

export async function blockUser(userId: string) {
	return request<{ blocked: boolean }>(`/users/${userId}/block`, { method: 'POST' });
}

export async function unblockUser(userId: string) {
	return request<{ unblocked: boolean }>(`/users/${userId}/block`, { method: 'DELETE' });
}

export async function ignoreUser(userId: string) {
	return request<{ ignored: boolean }>(`/users/${userId}/ignore`, { method: 'POST' });
}

export async function deleteMessage(channelId: string, messageId: string) {
	return request<{ deleted: boolean }>(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' });
}

export async function deleteDmMessage(dmId: string, messageId: string) {
	return request<{ deleted: boolean }>(`/dms/${dmId}/messages/${messageId}`, { method: 'DELETE' });
}

export async function purgeMessages(dmId: string) {
	return request<{ purged: boolean }>(`/dms/${dmId}/messages/purge`, { method: 'POST' });
}

// Members
interface MemberWithUser {
	user_id: string;
	server_id: string;
	nickname: string | null;
	joined_at: string;
	username: string;
	discriminator: string;
	avatar_url: string | null;
	cover_url: string | null;
	status: string | null;
	roles: import('$lib/types').Role[];
}

export async function getMembers(serverId: string) {
	const raw = await request<MemberWithUser[]>(`/servers/${serverId}/members`);
	return raw.map((m): import('$lib/types').ServerMember => ({
		user_id: m.user_id,
		server_id: m.server_id,
		nickname: m.nickname,
		joined_at: m.joined_at,
		user: {
			id: m.user_id,
			username: m.username,
			discriminator: m.discriminator,
			avatar_url: m.avatar_url,
			cover_url: m.cover_url,
			status: m.status,
			created_at: m.joined_at
		},
		roles: m.roles ?? []
	}));
}

// Server management
export async function updateServer(serverId: string, data: { name?: string; icon_url?: string; is_public?: boolean }) {
	return request<Server>(`/servers/${serverId}`, {
		method: 'PATCH',
		body: JSON.stringify(data)
	});
}

// Roles
export async function getRoles(serverId: string) {
	return request<import('$lib/types').Role[]>(`/servers/${serverId}/roles`);
}

export async function createRole(serverId: string, name: string, color?: string, permissions?: number) {
	return request<import('$lib/types').Role>(`/servers/${serverId}/roles`, {
		method: 'POST',
		body: JSON.stringify({ name, color, permissions })
	});
}

export async function updateRole(roleId: string, data: { name?: string; color?: string; permissions?: number }) {
	return request<import('$lib/types').Role>(`/roles/${roleId}`, {
		method: 'PATCH',
		body: JSON.stringify(data)
	});
}

export async function deleteRole(roleId: string) {
	return request<{ deleted: boolean }>(`/roles/${roleId}`, { method: 'DELETE' });
}

export async function reorderRoles(serverId: string, roles: { id: string; position: number }[]) {
	return request<import('$lib/types').Role[]>(`/servers/${serverId}/roles/reorder`, {
		method: 'POST',
		body: JSON.stringify({ roles })
	});
}

export async function assignRole(serverId: string, userId: string, roleId: string) {
	return request<{ assigned: boolean }>(`/servers/${serverId}/members/${userId}/roles/${roleId}`, {
		method: 'POST'
	});
}

export async function removeRole(serverId: string, userId: string, roleId: string) {
	return request<{ removed: boolean }>(`/servers/${serverId}/members/${userId}/roles/${roleId}`, {
		method: 'DELETE'
	});
}

// Voice
export async function getVoiceToken(channelId: string): Promise<{
	token: string;
	url: string;
	participants: Array<{ user_id: string; username: string }>;
}> {
	return request('/voice/token', {
		method: 'POST',
		body: JSON.stringify({ channel_id: channelId })
	});
}

export async function getScreenShareToken(channelId: string): Promise<{
	token: string;
	url: string;
}> {
	return request('/voice/screenshare-token', {
		method: 'POST',
		body: JSON.stringify({ channel_id: channelId })
	});
}

// Channel management
export async function updateChannel(channelId: string, data: { name?: string; topic?: string; position?: number; category_id?: string }) {
	return request<Channel>(`/channels/${channelId}`, {
		method: 'PATCH',
		body: JSON.stringify(data)
	});
}

export async function deleteChannel(channelId: string) {
	return request<{ deleted: boolean }>(`/channels/${channelId}`, { method: 'DELETE' });
}

// DMs
export async function createDm(recipientId: string) {
	return request<DmChannel>('/dms', {
		method: 'POST',
		body: JSON.stringify({ recipient_id: recipientId })
	});
}

export async function listDms() {
	return request<DmChannel[]>('/dms');
}

export async function getDm(dmId: string) {
	return request<DmChannel>(`/dms/${dmId}`);
}

export async function closeDm(dmId: string) {
	return request<{ closed: boolean }>(`/dms/${dmId}`, { method: 'DELETE' });
}

export async function getDmMessages(dmId: string, limit: number = 50, before?: string) {
	const params = new URLSearchParams({ limit: String(limit) });
	if (before) params.set('before', before);
	const raw = await request<RawMessageResponse[]>(`/dms/${dmId}/messages?${params}`);
	return raw.map(mapMessage).reverse();
}

export async function sendDmMessage(dmId: string, plaintext: string) {
	const bytes = Array.from(new TextEncoder().encode(plaintext));
	const nonce = Array.from(crypto.getRandomValues(new Uint8Array(12)));
	const raw = await request<RawMessageResponse>(`/dms/${dmId}/messages`, {
		method: 'POST',
		body: JSON.stringify({ encrypted_content: bytes, nonce })
	});
	return mapMessage(raw);
}

export async function createGroupDm(recipientIds: string[], name?: string) {
	return request<DmChannel>('/dms/group', {
		method: 'POST',
		body: JSON.stringify({ recipient_ids: recipientIds, name })
	});
}

export async function updateGroupDm(dmId: string, data: { name?: string; icon_url?: string }) {
	return request<DmChannel>(`/dms/${dmId}`, {
		method: 'PATCH',
		body: JSON.stringify(data)
	});
}

export async function addGroupParticipant(dmId: string, userId: string) {
	return request<{ added: boolean }>(`/dms/${dmId}/participants`, {
		method: 'POST',
		body: JSON.stringify({ user_id: userId })
	});
}

export async function removeGroupParticipant(dmId: string, userId: string) {
	return request<{ removed: boolean }>(`/dms/${dmId}/participants/${userId}`, { method: 'DELETE' });
}

// Calls
export async function getActiveCall(dmId: string) {
	return request<(Call & { participants?: CallParticipantInfo[] }) | null>(`/dms/${dmId}/call`);
}

export async function startCall(dmId: string) {
	return request<Call>(`/dms/${dmId}/call/start`, { method: 'POST' });
}

export async function acceptCall(dmId: string) {
	return request<{ token: string; url: string; call_id: string }>(`/dms/${dmId}/call/accept`, { method: 'POST' });
}

export async function declineCall(dmId: string) {
	return request<{ declined: boolean }>(`/dms/${dmId}/call/decline`, { method: 'POST' });
}

export async function leaveCall(dmId: string) {
	return request<{ left: boolean }>(`/dms/${dmId}/call/leave`, { method: 'POST' });
}

export async function joinCall(dmId: string) {
	return request<{ token: string; url: string; call_id: string }>(`/dms/${dmId}/call/join`, { method: 'POST' });
}
