import {
	isPermissionGranted,
	requestPermission,
	sendNotification
} from '@tauri-apps/plugin-notification';

let permissionReady = false;
let granted = false;

async function ensurePermission(): Promise<boolean> {
	if (permissionReady) return granted;
	try {
		granted = await isPermissionGranted();
		if (!granted) {
			const result = await requestPermission();
			granted = result === 'granted';
		}
	} catch {
		granted = false;
	}
	permissionReady = true;
	return granted;
}

/** Send a native OS notification if window is not focused */
async function notify(title: string, body: string) {
	// Skip if window is focused — user already sees the message
	if (document.hasFocus()) return;

	const ok = await ensurePermission();
	if (!ok) return;

	sendNotification({ title, body });
}

export const notifications = {
	/** New DM or channel message */
	message(authorName: string, content: string) {
		const preview = content.length > 100 ? content.slice(0, 100) + '...' : content;
		notify(authorName, preview);
	},

	/** Incoming call */
	incomingCall(callerName: string) {
		notify('Incoming Call', `${callerName} is calling you`);
	},

	/** Friend request received */
	friendRequest(username: string) {
		notify('Friend Request', `${username} sent you a friend request`);
	}
};
