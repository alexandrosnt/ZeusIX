import type { Role } from '$lib/types';

export const PERMISSIONS = {
	ADMIN: 1 << 0,
	MANAGE_SERVER: 1 << 1,
	MANAGE_CHANNELS: 1 << 2,
	MANAGE_MESSAGES: 1 << 3,
	SEND_MESSAGES: 1 << 5,
	READ_MESSAGES: 1 << 6,
	CONNECT_VOICE: 1 << 8,
	SPEAK: 1 << 9,
	CREATE_INVITE: 1 << 10
} as const;

export function computePermissions(roles: Role[]): number {
	let perms = 0;
	for (const role of roles) {
		perms |= role.permissions;
	}
	return perms;
}

export function hasPermission(roles: Role[], bit: number): boolean {
	const computed = computePermissions(roles);
	if (computed & PERMISSIONS.ADMIN) return true;
	return (computed & bit) === bit;
}
