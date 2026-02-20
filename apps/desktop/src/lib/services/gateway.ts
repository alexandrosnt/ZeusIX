import { authStore } from '$lib/stores/auth.svelte';
import { messagesStore } from '$lib/stores/messages.svelte';
import { presenceStore } from '$lib/stores/presence.svelte';
import { voiceStore } from '$lib/stores/voice.svelte';
import { dmsStore } from '$lib/stores/dms.svelte';
import { callsStore } from '$lib/stores/calls.svelte';
import { friendsStore } from '$lib/stores/friends.svelte';
import { membersStore } from '$lib/stores/members.svelte';
import { serversStore } from '$lib/stores/servers.svelte';
// livekit-client is lazy-loaded to avoid pulling ~50MB into baseline memory
const getLiveKit = () => import('$lib/services/livekit').then(m => m.livekit);
import type { GatewayEvent, Message, PresenceStatus, DmChannel, Call, Friendship } from '$lib/types';

const GATEWAY_URL = 'ws://51.75.64.176:3002/gateway';
const PUBLIC_HOST = 'http://51.75.64.176:3002';
const BROKEN_HOSTS = ['http://127.0.0.1:3002', 'http://127.0.0.1:3001', 'http://localhost:3002', 'http://0.0.0.0:3002'];

function fixUrls(data: unknown): unknown {
	if (data == null || typeof data !== 'object') return data;
	if (Array.isArray(data)) return data.map(fixUrls);
	const obj = data as Record<string, unknown>;
	for (const key of Object.keys(obj)) {
		const val = obj[key];
		if (typeof val === 'string') {
			for (const broken of BROKEN_HOSTS) {
				if (val.startsWith(broken)) { obj[key] = PUBLIC_HOST + val.slice(broken.length); break; }
			}
		} else if (typeof val === 'object' && val !== null) { fixUrls(val); }
	}
	return data;
}

// Gateway opcodes (must match server OpCode enum)
const OP = {
	DISPATCH: 0,
	HEARTBEAT: 1,
	IDENTIFY: 2,
	HEARTBEAT_ACK: 3,
	HELLO: 4,
	SUBSCRIBE: 5,
	PRESENCE_UPDATE: 6,
	VOICE_STATE_UPDATE: 7
} as const;

// Event names
const EVENTS = {
	MESSAGE_CREATE: 'MESSAGE_CREATE',
	MESSAGE_UPDATE: 'MESSAGE_UPDATE',
	MESSAGE_DELETE: 'MESSAGE_DELETE',
	MESSAGE_PURGE: 'MESSAGE_PURGE',
	TYPING_START: 'TYPING_START',
	PRESENCE_UPDATE: 'PRESENCE_UPDATE',
	VOICE_STATE_UPDATE: 'VOICE_STATE_UPDATE',
	READY: 'READY',
	DM_CREATE: 'DM_CREATE',
	DM_UPDATE: 'DM_UPDATE',
	CALL_CREATE: 'CALL_CREATE',
	CALL_UPDATE: 'CALL_UPDATE',
	CALL_DELETE: 'CALL_DELETE',
	CALL_PARTICIPANT_JOIN: 'CALL_PARTICIPANT_JOIN',
	CALL_PARTICIPANT_LEAVE: 'CALL_PARTICIPANT_LEAVE',
	FRIEND_REQUEST_CREATE: 'FRIEND_REQUEST_CREATE',
	FRIEND_REQUEST_ACCEPT: 'FRIEND_REQUEST_ACCEPT',
	FRIEND_REQUEST_DECLINE: 'FRIEND_REQUEST_DECLINE',
	FRIEND_REMOVE: 'FRIEND_REMOVE',
	MEMBER_JOIN: 'MEMBER_JOIN',
	MEMBER_LEAVE: 'MEMBER_LEAVE'
} as const;

class GatewayClient {
	private ws: WebSocket | null = null;
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 10;

	// Idle detection
	private idleTimeout: ReturnType<typeof setTimeout> | null = null;
	private isAutoIdle = false;
	private readonly IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
	private readonly HIDDEN_IDLE_MS = 2 * 60 * 1000; // 2 minutes when tab/window hidden
	private idleListeners: Array<{ target: EventTarget; event: string; handler: EventListener }> = [];

	connect() {
		if (this.ws?.readyState === WebSocket.OPEN) return;

		try {
			this.ws = new WebSocket(GATEWAY_URL);
			this.ws.onopen = () => this.onOpen();
			this.ws.onmessage = (e) => this.onMessage(e);
			this.ws.onclose = (e) => this.onClose(e);
			this.ws.onerror = (e) => console.error('[Gateway] Error:', e);
		} catch (err) {
			console.error('[Gateway] Connection failed:', err);
			this.scheduleReconnect();
		}
	}

	disconnect() {
		this.stopHeartbeat();
		this.stopIdleDetection();
		if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
		if (this.ws) {
			this.ws.onclose = null;
			this.ws.close();
			this.ws = null;
		}
	}

	send(event: GatewayEvent) {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(event));
		}
	}

	subscribe(channelIds: string[]) {
		this.send({
			op: OP.SUBSCRIBE,
			d: { channel_ids: channelIds }
		});
	}

	sendTyping(channelId: string) {
		this.send({
			op: OP.DISPATCH,
			t: EVENTS.TYPING_START,
			d: { channel_id: channelId }
		});
	}

	updatePresence(status: PresenceStatus) {
		this.send({
			op: OP.PRESENCE_UPDATE,
			d: { status }
		});
	}

	sendVoiceState(channelId: string | null, action: 'join' | 'leave' | 'state_update', extra?: { muted?: boolean; deafened?: boolean; videoEnabled?: boolean; screenSharing?: boolean }) {
		this.send({
			op: OP.VOICE_STATE_UPDATE,
			d: { channel_id: channelId, action, ...extra }
		});
	}

	private onOpen() {
		console.log('[Gateway] Connected');
		this.reconnectAttempts = 0;
		this.identify();
	}

	private identify() {
		if (!authStore.token) return;
		presenceStore.restoreChosenStatus();
		this.send({
			op: OP.IDENTIFY,
			d: {
				token: authStore.token,
				initial_status: presenceStore.chosenStatus
			}
		});
	}

	private onMessage(event: MessageEvent) {
		let data: GatewayEvent;
		try {
			data = fixUrls(JSON.parse(event.data)) as GatewayEvent;
		} catch {
			console.error('[Gateway] Invalid JSON received');
			return;
		}

		switch (data.op) {
			case OP.HELLO:
				this.startHeartbeat((data.d as { heartbeat_interval: number }).heartbeat_interval);
				break;
			case OP.HEARTBEAT_ACK:
				break;
			case OP.DISPATCH:
				this.handleDispatch(data);
				break;
		}
	}

	/** Decode a raw gateway message (with encrypted_content byte array) into a frontend Message */
	private decodeRawMessage(raw: Record<string, unknown>): Message {
		const encrypted = raw.encrypted_content as number[] | undefined;
		const content = encrypted
			? new TextDecoder().decode(new Uint8Array(encrypted))
			: '';
		const authorId = raw.author_id as string;
		const authorUsername = raw.author_username as string | undefined;
		const authorAvatarUrl = (raw.author_avatar_url as string | null) ?? null;
		const messageType = (raw.message_type as string) ?? 'default';

		// Use current user's full profile if this is their message
		const currentUser = authStore.user;
		const isOwnMessage = currentUser && authorId === currentUser.id;

		return {
			id: raw.id as string,
			channel_id: raw.channel_id as string,
			author_id: authorId,
			content,
			message_type: messageType,
			author_username: isOwnMessage ? currentUser.username : authorUsername,
			created_at: raw.created_at as string,
			edited_at: (raw.edited_at as string | null) ?? null,
			author: isOwnMessage
				? currentUser
				: authorUsername
					? { id: authorId, username: authorUsername, discriminator: '0000', avatar_url: authorAvatarUrl, cover_url: null, status: null, created_at: '' }
					: undefined
		};
	}

	private handleDispatch(event: GatewayEvent) {
		switch (event.t) {
			case EVENTS.MESSAGE_CREATE: {
				const msg = this.decodeRawMessage(event.d as Record<string, unknown>);
				messagesStore.addMessage(msg.channel_id, msg);
				// Bump DM to top if this is a DM message
				dmsStore.bumpToTop(msg.channel_id);
				break;
			}
			case EVENTS.MESSAGE_UPDATE: {
				const msg = this.decodeRawMessage(event.d as Record<string, unknown>);
				messagesStore.updateMessage(msg.channel_id, msg.id, msg);
				break;
			}
			case EVENTS.MESSAGE_DELETE: {
				const { channel_id, id } = event.d as { channel_id: string; id: string };
				messagesStore.deleteMessage(channel_id, id);
				break;
			}
			case EVENTS.MESSAGE_PURGE: {
				const { channel_id } = event.d as { channel_id: string };
				messagesStore.clearChannel(channel_id);
				break;
			}
			case EVENTS.TYPING_START: {
				const { channel_id, user_id } = event.d as {
					channel_id: string;
					user_id: string;
				};
				presenceStore.setTyping(channel_id, user_id);
				break;
			}
			case EVENTS.PRESENCE_UPDATE: {
				const { user_id, status } = event.d as {
					user_id: string;
					status: PresenceStatus;
				};
				presenceStore.updatePresence(user_id, status);
				break;
			}
			case EVENTS.VOICE_STATE_UPDATE: {
				const { user_id, channel_id, username, action, muted, deafened, videoEnabled, screenSharing } = event.d as {
					user_id: string;
					channel_id: string;
					username: string;
					action: string;
					muted?: boolean;
					deafened?: boolean;
					videoEnabled?: boolean;
					screenSharing?: boolean;
				};
				if (action === 'join') {
					voiceStore.addParticipant({
						userId: user_id,
						username,
						speaking: false,
						muted: false,
						deafened: false,
						videoEnabled: false,
						screenSharing: false
					});
				} else if (action === 'leave') {
					voiceStore.removeParticipant(user_id);
				} else if (action === 'state_update') {
					voiceStore.updateParticipant(user_id, {
						...(muted !== undefined ? { muted } : {}),
						...(deafened !== undefined ? { deafened } : {}),
						...(videoEnabled !== undefined ? { videoEnabled } : {}),
						...(screenSharing !== undefined ? { screenSharing } : {})
					});
				}
				break;
			}
			case EVENTS.READY: {
				console.log('[Gateway] Ready');
				const { user_id: readyUserId, presences } = event.d as {
					user_id: string;
					presences?: Array<{ user_id: string; status: PresenceStatus }>;
				};
				presenceStore.updatePresence(readyUserId, presenceStore.chosenStatus);
				if (presences?.length) {
					presenceStore.bulkUpdate(
						presences.map((p) => ({ userId: p.user_id, status: p.status }))
					);
				}
				this.startIdleDetection();
				break;
			}
			case EVENTS.DM_CREATE: {
				const dmChannel = event.d as DmChannel;
				dmsStore.addOrUpdateChannel(dmChannel);
				break;
			}
			case EVENTS.DM_UPDATE: {
				const dmChannel = event.d as DmChannel;
				dmsStore.addOrUpdateChannel(dmChannel);
				break;
			}
			case EVENTS.CALL_CREATE: {
				const call = event.d as Call;
				const myId = authStore.user?.id;
				// Track this call so other views know it exists in real-time
				callsStore.setKnownCall(call.dm_channel_id, call);
				if (myId && call.initiator_id !== myId) {
					callsStore.setIncomingCall(call);
				}
				break;
			}
			case EVENTS.CALL_UPDATE: {
				const call = event.d as Call;
				callsStore.setKnownCall(call.dm_channel_id, call);
				if (call.status === 'active') {
					// Only set activeCall if we're already part of it
					if (callsStore.activeCall?.dm_channel_id === call.dm_channel_id) {
						callsStore.setActiveCall(call);
					}
					callsStore.setIncomingCall(null);
				}
				break;
			}
			case EVENTS.CALL_DELETE: {
				const deleted = event.d as { id: string; dm_channel_id: string; status: string };
				callsStore.removeKnownCall(deleted.dm_channel_id);
				// Only leave LiveKit if we're currently in this call
				if (callsStore.activeCall?.dm_channel_id === deleted.dm_channel_id) {
					getLiveKit().then(lk => lk.leaveCallRoom());
					callsStore.clearAll();
				}
				break;
			}
			case EVENTS.CALL_PARTICIPANT_JOIN: {
				const { user_id, username } = event.d as { call_id: string; user_id: string; username: string };
				callsStore.addParticipant({ user_id, username });
				break;
			}
			case EVENTS.CALL_PARTICIPANT_LEAVE: {
				const { user_id } = event.d as { call_id: string; user_id: string; username: string };
				callsStore.removeParticipant(user_id);
				break;
			}
			case EVENTS.FRIEND_REQUEST_CREATE: {
				const friend = event.d as Friendship;
				friendsStore.addOrUpdate(friend);
				break;
			}
			case EVENTS.FRIEND_REQUEST_ACCEPT: {
				const friend = event.d as Friendship;
				friendsStore.addOrUpdate(friend);
				break;
			}
			case EVENTS.FRIEND_REQUEST_DECLINE: {
				const { id } = event.d as { id: string };
				friendsStore.remove(id);
				break;
			}
			case EVENTS.FRIEND_REMOVE: {
				const { id } = event.d as { id: string };
				friendsStore.remove(id);
				break;
			}
			case EVENTS.MEMBER_JOIN: {
				const { server_id, user_id, username, discriminator, avatar_url } = event.d as {
					server_id: string;
					user_id: string;
					username: string;
					discriminator: string;
					avatar_url: string | null;
				};
				// Only update if we're viewing this server
				if (serversStore.activeServerId === server_id) {
					membersStore.addMember({
						user_id,
						server_id,
						nickname: null,
						joined_at: new Date().toISOString(),
						user: { id: user_id, username, discriminator, avatar_url, cover_url: null, status: null, created_at: '' },
						roles: []
					});
				}
				// Update member count on the server object
				serversStore.updateServer(server_id, {
					member_count: (serversStore.servers.find(s => s.id === server_id)?.member_count ?? 0) + 1
				});
				break;
			}
			case EVENTS.MEMBER_LEAVE: {
				const { server_id, user_id } = event.d as {
					server_id: string;
					user_id: string;
				};
				// If it's us leaving, remove the server from our list
				if (user_id === authStore.user?.id) {
					serversStore.removeServer(server_id);
				} else {
					// Remove the member from the list if we're viewing this server
					if (serversStore.activeServerId === server_id) {
						membersStore.removeMember(user_id);
					}
					// Update member count
					serversStore.updateServer(server_id, {
						member_count: Math.max(0, (serversStore.servers.find(s => s.id === server_id)?.member_count ?? 1) - 1)
					});
				}
				break;
			}
		}
	}

	private startHeartbeat(intervalMs: number) {
		this.stopHeartbeat();
		this.heartbeatInterval = setInterval(() => {
			this.send({ op: OP.HEARTBEAT, d: null });
		}, intervalMs);
	}

	private stopHeartbeat() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	private startIdleDetection() {
		this.stopIdleDetection();

		const resetIdle = () => {
			if (this.idleTimeout) clearTimeout(this.idleTimeout);

			// If we were auto-idle, restore to the chosen status
			if (this.isAutoIdle) {
				this.isAutoIdle = false;
				const chosen = presenceStore.chosenStatus;
				if (chosen === 'online') {
					this.updatePresence('online');
				}
			}

			this.idleTimeout = setTimeout(() => {
				// Only auto-idle if the user's chosen status is "online"
				const chosen = presenceStore.chosenStatus;
				if (chosen === 'online') {
					this.isAutoIdle = true;
					this.updatePresence('idle');
				}
			}, this.IDLE_THRESHOLD_MS);
		};

		const visibilityHandler = () => {
			if (document.hidden) {
				// Shorter idle timer when window is hidden
				if (this.idleTimeout) clearTimeout(this.idleTimeout);
				this.idleTimeout = setTimeout(() => {
					const chosen = presenceStore.chosenStatus;
					if (chosen === 'online') {
						this.isAutoIdle = true;
						this.updatePresence('idle');
					}
				}, this.HIDDEN_IDLE_MS);
			} else {
				resetIdle();
			}
		};

		// Store listener refs for cleanup
		const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'] as const;
		for (const evt of activityEvents) {
			const handler = resetIdle as EventListener;
			window.addEventListener(evt, handler);
			this.idleListeners.push({ target: window, event: evt, handler });
		}
		document.addEventListener('visibilitychange', visibilityHandler as EventListener);
		this.idleListeners.push({ target: document, event: 'visibilitychange', handler: visibilityHandler as EventListener });

		// Start initial timer
		resetIdle();
	}

	private stopIdleDetection() {
		if (this.idleTimeout) {
			clearTimeout(this.idleTimeout);
			this.idleTimeout = null;
		}
		for (const { target, event, handler } of this.idleListeners) {
			target.removeEventListener(event, handler);
		}
		this.idleListeners = [];
		this.isAutoIdle = false;
	}

	private onClose(event: CloseEvent) {
		console.log('[Gateway] Closed:', event.code, event.reason);
		this.stopHeartbeat();
		if (event.code !== 1000) {
			this.scheduleReconnect();
		}
	}

	private scheduleReconnect() {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error('[Gateway] Max reconnect attempts reached');
			return;
		}
		const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
		this.reconnectAttempts++;
		console.log(`[Gateway] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
		this.reconnectTimeout = setTimeout(() => this.connect(), delay);
	}
}

export const gateway = new GatewayClient();
