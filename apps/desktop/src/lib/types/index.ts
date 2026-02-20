export interface User {
	id: string;
	username: string;
	discriminator: string;
	email?: string;
	avatar_url: string | null;
	cover_url: string | null;
	status: string | null;
	created_at: string;
}

export interface Server {
	id: string;
	name: string;
	owner_id: string;
	icon_url: string | null;
	is_public: boolean;
	member_count: number;
	created_at: string;
}

export interface Channel {
	id: string;
	server_id: string;
	name: string;
	channel_type: 'text' | 'voice' | 'category';
	category_id: string | null;
	position: number;
	topic: string | null;
}

export interface Message {
	id: string;
	channel_id: string;
	author_id: string;
	content: string;
	encrypted_content?: number[];
	nonce?: number[] | null;
	message_type: string;
	author_username?: string;
	created_at: string;
	edited_at: string | null;
	author?: User;
}

export interface Role {
	id: string;
	server_id: string;
	name: string;
	color: string | null;
	permissions: number;
	position: number;
}

export interface ServerMember {
	user_id: string;
	server_id: string;
	nickname: string | null;
	joined_at: string;
	user?: User;
	roles?: Role[];
}

export interface Invite {
	code: string;
	server_id: string;
	creator_id: string;
	max_uses: number | null;
	uses: number;
	expires_at: string | null;
}

export interface GatewayEvent {
	op: number;
	d: unknown;
	t?: string;
}

export interface Friendship {
	id: string;
	user_id: string;
	username: string;
	discriminator: string;
	avatar_url: string | null;
	status: string; // 'pending' | 'accepted' | 'declined'
	direction: string; // 'incoming' | 'outgoing'
	friend_status: string | null; // online status of the friend
	since: string;
}

export interface DmChannel {
	id: string;
	dm_type: 'dm' | 'group';
	name: string | null;
	icon_url: string | null;
	owner_id: string | null;
	last_message_id: string | null;
	recipient_id?: string;
	recipient_username?: string;
	recipient_discriminator?: string;
	recipient_avatar_url?: string;
	participants?: DmParticipant[];
	created_at: string;
	updated_at: string;
}

export interface DmParticipant {
	user_id: string;
	username: string;
	discriminator: string;
	avatar_url: string | null;
}

export interface Call {
	id: string;
	dm_channel_id: string;
	initiator_id: string;
	initiator_username: string;
	status: 'ringing' | 'active' | 'ended' | 'missed';
	participants?: CallParticipantInfo[];
}

export interface CallParticipantInfo {
	user_id: string;
	username: string;
	joined_at?: string;
}

export type PresenceStatus = 'online' | 'offline' | 'idle' | 'dnd';

export interface TypingEvent {
	channel_id: string;
	user_id: string;
	timestamp: number;
}

export interface Category {
	id: string;
	name: string;
	channels: Channel[];
}
