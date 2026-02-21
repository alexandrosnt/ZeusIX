const cache = new Map<string, HTMLAudioElement>();

function getAudio(path: string): HTMLAudioElement {
	let audio = cache.get(path);
	if (!audio) {
		audio = new Audio(path);
		cache.set(path, audio);
	}
	return audio;
}

let activeLoop: HTMLAudioElement | null = null;

export const sounds = {
	message() {
		const a = getAudio('/sounds/message.mp3');
		a.currentTime = 0;
		a.play().catch(() => {});
	},

	friendRequest() {
		const a = getAudio('/sounds/friend-request.mp3');
		a.currentTime = 0;
		a.play().catch(() => {});
	},

	/** Incoming call ringtone — loops until stopped. */
	ringtone() {
		sounds.stopLoop();
		const a = getAudio('/sounds/ringtone.mp3');
		a.loop = true;
		a.currentTime = 0;
		a.play().catch(() => {});
		activeLoop = a;
	},

	/** Outgoing call dialing tone — loops until stopped. */
	outgoingCall() {
		sounds.stopLoop();
		const a = getAudio('/sounds/outgoing-call.mp3');
		a.loop = true;
		a.currentTime = 0;
		a.play().catch(() => {});
		activeLoop = a;
	},

	stopLoop() {
		if (activeLoop) {
			activeLoop.pause();
			activeLoop.currentTime = 0;
			activeLoop.loop = false;
			activeLoop = null;
		}
	}
};
