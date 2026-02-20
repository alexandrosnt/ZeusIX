import {
	Room,
	RoomEvent,
	ConnectionState,
	Track,
	type RemoteTrack,
	type RemoteTrackPublication,
	type RemoteParticipant,
	type Participant,
	type TrackPublication,
	type LocalTrackPublication
} from 'livekit-client';
// Lazy-load Tauri invoke & event APIs for PTT
let _invoke: typeof import('@tauri-apps/api/core').invoke | null = null;
let _listen: typeof import('@tauri-apps/api/event').listen | null = null;
async function loadTauriApis() {
	if (_invoke) return;
	try {
		const core = await import('@tauri-apps/api/core');
		const event = await import('@tauri-apps/api/event');
		_invoke = core.invoke;
		_listen = event.listen;
	} catch {
		// Not running in Tauri
	}
}
import { voiceStore } from '$lib/stores/voice.svelte';
import { authStore } from '$lib/stores/auth.svelte';
import { settingsStore } from '$lib/stores/settings.svelte';
import { getVoiceToken } from '$lib/services/api';
import { gateway } from '$lib/services/gateway';

class LiveKitService {
	private room: Room | null = null;
	private pttDown = false;
	private handleKeyDown: ((e: KeyboardEvent) => void) | null = null;
	private handleKeyUp: ((e: KeyboardEvent) => void) | null = null;
	private pttUnlistenPress: (() => void) | null = null;
	private pttUnlistenRelease: (() => void) | null = null;

	// Native screen capture state
	private nativeScreenShareActive = false;
	private nativeCapTimer: ReturnType<typeof setInterval> | null = null;
	private nativeCapCanvas: HTMLCanvasElement | null = null;
	private nativeCapStream: MediaStream | null = null;

	// Local VAD (Voice Activity Detection)
	private micStream: MediaStream | null = null;
	private audioCtx: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private vadInterval: ReturnType<typeof setInterval> | null = null;

	// Stats polling
	private statsInterval: ReturnType<typeof setInterval> | null = null;

	// Hidden container for attached remote audio elements
	private audioContainer: HTMLDivElement | null = null;

	// Video element tracking and callbacks
	private videoElements = new Map<string, HTMLVideoElement>();
	private onVideoAttached: ((userId: string, source: 'camera' | 'screenshare', el: HTMLVideoElement) => void) | null = null;
	private onVideoDetached: ((userId: string, source: 'camera' | 'screenshare') => void) | null = null;

	/** Parse LiveKit identity string "userId:username" safely.
	 *  Also handles bot identities like "bot-ss-userId:username". */
	private parseIdentity(identity: string): { userId: string; username: string; isScreenShareBot: boolean } {
		// Check for screenshare bot prefix
		const botPrefix = 'bot-ss-';
		const isBot = identity.startsWith(botPrefix);
		const cleanIdentity = isBot ? identity.slice(botPrefix.length) : identity;

		const colonIdx = cleanIdentity.indexOf(':');
		if (colonIdx === -1) return { userId: cleanIdentity, username: 'Unknown', isScreenShareBot: isBot };
		return {
			userId: cleanIdentity.slice(0, colonIdx),
			username: cleanIdentity.slice(colonIdx + 1),
			isScreenShareBot: isBot
		};
	}

	// ── Selective screen share subscription ──────────────────────────────
	// Only 1 screen share subscribed at a time to save GPU/bandwidth.
	// Audio & camera tracks are always subscribed immediately.

	/** Decide whether to subscribe to a newly published remote track. */
	private handleRemoteTrackPublished(publication: RemoteTrackPublication, participant: RemoteParticipant) {
		const { userId, isScreenShareBot } = this.parseIdentity(participant.identity);

		// Screenshare bot only publishes screen_share tracks — always handle as screen share
		if (isScreenShareBot || publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) {
			// Mark the real user as sharing
			voiceStore.updateParticipant(userId, { screenSharing: true });

			// Only subscribe if no one else is currently being watched
			const currentWatching = voiceStore.activeScreenShareUserId;
			if (!currentWatching || currentWatching === userId) {
				publication.setSubscribed(true);
				if (publication.source === Track.Source.ScreenShare) {
					voiceStore.setActiveScreenShare(userId);
				}
			}
		} else {
			// Audio & camera: always subscribe
			publication.setSubscribed(true);
		}
	}

	/** Clean up when a remote participant unpublishes a screen share track. */
	private handleRemoteTrackUnpublished(publication: RemoteTrackPublication, participant: RemoteParticipant) {
		const { isScreenShareBot } = this.parseIdentity(participant.identity);
		if (publication.source !== Track.Source.ScreenShare && !isScreenShareBot) return;

		const { userId } = this.parseIdentity(participant.identity);
		voiceStore.updateParticipant(userId, { screenSharing: false });

		// Clean up video element
		const key = `${userId}-screenshare`;
		const el = this.videoElements.get(key);
		if (el) el.remove();
		this.videoElements.delete(key);
		this.onVideoDetached?.(userId, 'screenshare');

		// If we were watching this person, auto-switch to next available sharer
		if (voiceStore.activeScreenShareUserId === userId) {
			const myId = authStore.user?.id;
			const next = voiceStore.screenSharers.find(p => p.userId !== userId && p.userId !== myId);
			if (next) {
				this.watchScreenShare(next.userId);
			} else {
				voiceStore.setActiveScreenShare(null);
			}
		}
	}

	/** After connecting, subscribe to all already-published tracks on remote participants. */
	private subscribeExistingTracks() {
		if (!this.room) return;
		for (const p of this.room.remoteParticipants.values()) {
			for (const pub of p.trackPublications.values()) {
				this.handleRemoteTrackPublished(pub, p);
			}
		}
	}

	/** Switch which screen share to watch. Unsubscribes from current, subscribes to new. */
	watchScreenShare(userId: string) {
		if (!this.room) return;
		const myId = authStore.user?.id;

		// Unsubscribe from current remote screen share
		const currentId = voiceStore.activeScreenShareUserId;
		if (currentId && currentId !== userId && currentId !== myId) {
			for (const p of this.room.remoteParticipants.values()) {
				const { userId: pId } = this.parseIdentity(p.identity);
				if (pId === currentId) {
					for (const pub of p.trackPublications.values()) {
						if (pub.source === Track.Source.ScreenShare || pub.source === Track.Source.ScreenShareAudio) {
							pub.setSubscribed(false);
						}
					}
					break;
				}
			}
			// Clean up old video element
			const oldKey = `${currentId}-screenshare`;
			const oldEl = this.videoElements.get(oldKey);
			if (oldEl) oldEl.remove();
			this.videoElements.delete(oldKey);
			this.onVideoDetached?.(currentId, 'screenshare');
		}

		// Subscribe to new screen share (if it's a remote participant)
		if (userId !== myId) {
			for (const p of this.room.remoteParticipants.values()) {
				const { userId: pId } = this.parseIdentity(p.identity);
				if (pId === userId) {
					for (const pub of p.trackPublications.values()) {
						if (pub.source === Track.Source.ScreenShare || pub.source === Track.Source.ScreenShareAudio) {
							pub.setSubscribed(true);
						}
					}
					break;
				}
			}
		}

		voiceStore.setActiveScreenShare(userId);
	}

	/** UI registers callbacks to receive video elements. Returns unsubscribe function.
	 *  Replays any already-attached video elements so the UI stays in sync
	 *  when callbacks are registered after tracks were already subscribed. */
	registerVideoCallbacks(
		onAttach: (userId: string, source: 'camera' | 'screenshare', el: HTMLVideoElement) => void,
		onDetach: (userId: string, source: 'camera' | 'screenshare') => void
	): () => void {
		this.onVideoAttached = onAttach;
		this.onVideoDetached = onDetach;
		// Replay existing video elements (handles race where tracks subscribed before UI registered)
		for (const [key, el] of this.videoElements.entries()) {
			const dashIdx = key.lastIndexOf('-');
			if (dashIdx === -1) continue;
			const userId = key.slice(0, dashIdx);
			const source = key.slice(dashIdx + 1) as 'camera' | 'screenshare';
			if (source === 'camera' || source === 'screenshare') {
				onAttach(userId, source, el);
			}
		}
		return () => {
			this.onVideoAttached = null;
			this.onVideoDetached = null;
		};
	}

	/** Toggle local camera on/off */
	async toggleVideo() {
		if (!this.room) return;
		const enabling = !voiceStore.videoEnabled;
		voiceStore.videoEnabled = enabling;
		const me = authStore.user;

		await this.room.localParticipant.setCameraEnabled(enabling);

		if (enabling) {
			// Find the local camera track and attach
			const camPub = this.room.localParticipant.getTrackPublication(Track.Source.Camera);
			if (camPub?.track) {
				const el = camPub.track.attach() as HTMLVideoElement;
				el.style.transform = 'scaleX(-1)'; // Mirror local camera
				const key = `${me?.id ?? 'local'}-camera`;
				this.videoElements.set(key, el);
				if (me) {
					voiceStore.updateParticipant(me.id, { videoEnabled: true });
					this.onVideoAttached?.(me.id, 'camera', el);
				}
			}
		} else {
			const camPub = this.room.localParticipant.getTrackPublication(Track.Source.Camera);
			if (camPub?.track) {
				camPub.track.detach().forEach((el) => el.remove());
			}
			const key = `${me?.id ?? 'local'}-camera`;
			this.videoElements.delete(key);
			if (me) {
				voiceStore.updateParticipant(me.id, { videoEnabled: false });
				this.onVideoDetached?.(me.id, 'camera');
			}
		}
		this.broadcastVoiceState();
	}

	/** Toggle screen share on/off. Options control resolution/fps/audio. */
	async toggleScreenShare(options?: { resolution?: { width: number; height: number }; frameRate?: number; audio?: boolean }) {
		if (!this.room) return;
		const me = authStore.user;

		if (voiceStore.screenSharing) {
			// Stop screen share
			await this.room.localParticipant.setScreenShareEnabled(false);
			voiceStore.screenSharing = false;
			voiceStore.setActiveScreenShare(null);
			const key = `${me?.id ?? 'local'}-screenshare`;
			const existingEl = this.videoElements.get(key);
			if (existingEl) existingEl.remove();
			this.videoElements.delete(key);
			if (me) {
				voiceStore.updateParticipant(me.id, { screenSharing: false });
				this.onVideoDetached?.(me.id, 'screenshare');
			}
			this.broadcastVoiceState();
			return;
		}

		// Start screen share — user may cancel OS picker, so wrap in try/catch
		try {
			const captureOpts: Parameters<typeof this.room.localParticipant.setScreenShareEnabled>[1] = {
				audio: options?.audio ?? false,
				contentHint: 'detail',
				resolution: options?.resolution
					? { width: options.resolution.width, height: options.resolution.height, frameRate: options.frameRate ?? 30 }
					: undefined
			};
			await this.room.localParticipant.setScreenShareEnabled(true, captureOpts);

			voiceStore.screenSharing = true;
			if (me) {
				voiceStore.setActiveScreenShare(me.id);
				voiceStore.updateParticipant(me.id, { screenSharing: true });
			}

			// Attach local screen share track
			const ssPub = this.room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
			if (ssPub?.track) {
				const el = ssPub.track.attach() as HTMLVideoElement;
				const key = `${me?.id ?? 'local'}-screenshare`;
				this.videoElements.set(key, el);
				if (me) {
					this.onVideoAttached?.(me.id, 'screenshare', el);
				}
			}
			this.broadcastVoiceState();
		} catch (err) {
			// User cancelled the OS screen picker — do nothing
			console.log('[LiveKit] Screen share cancelled or failed:', err);
		}
	}

	/** Start native screen share: Rust captures → JPEG → JS polls → canvas → LiveKit.
	 *  No custom protocol (avoids WebView2 memory leak), no libwebrtc in Rust.
	 *  Falls back to getDisplayMedia() if native pipeline fails. */
	async startNativeScreenShare(options: {
		sourceType: string;
		sourceIndex: number;
		resolution?: { width: number; height: number };
		frameRate?: number;
		audio?: boolean;
	}) {
		if (!this.room) return;
		const me = authStore.user;

		try {
			await loadTauriApis();
			if (!_invoke) throw new Error('Tauri not available');

			const fps = options.frameRate ?? 30;
			const width = options.resolution?.width ?? 1920;
			const height = options.resolution?.height ?? 1080;

			// 1. Start Rust-side capture (RGBA → JPEG → shared buffer)
			console.log('[ScreenCap] Starting native capture:', options.sourceType, options.sourceIndex);
			await _invoke('start_capture', {
				sourceType: options.sourceType,
				sourceIndex: options.sourceIndex,
				fps,
				jpegQuality: 60
			});
			console.log('[ScreenCap] Native capture started');

			// 2. Create hidden canvas + captureStream for LiveKit
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d')!;
			// No args = auto-capture on every canvas draw (NOT 0 which means manual-only)
			const stream = canvas.captureStream();
			this.nativeCapCanvas = canvas;
			this.nativeCapStream = stream;

			// 3. Poll frames from Rust (raw binary via Tauri IPC) and draw to canvas
			const pollInterval = Math.round(1000 / fps);
			let polling = false;
			this.nativeCapTimer = setInterval(async () => {
				if (polling || !_invoke) return;
				polling = true;
				try {
					const buffer: ArrayBuffer = await _invoke('get_capture_frame');
					if (!buffer || buffer.byteLength === 0) { polling = false; return; }

					const blob = new Blob([buffer], { type: 'image/jpeg' });
					const bitmap = await createImageBitmap(blob, {
						resizeWidth: width,
						resizeHeight: height,
						resizeQuality: 'low'
					});
					ctx.drawImage(bitmap, 0, 0);
					bitmap.close();
				} catch {}
				polling = false;
			}, pollInterval);

			// 4. Publish the canvas MediaStream as screen share track
			const videoTrack = stream.getVideoTracks()[0];
			await this.room.localParticipant.publishTrack(videoTrack, {
				name: 'native-screenshare',
				source: Track.Source.ScreenShare,
				simulcast: false
			});

			this.nativeScreenShareActive = true;
			voiceStore.screenSharing = true;
			if (me) {
				voiceStore.setActiveScreenShare(me.id);
				voiceStore.updateParticipant(me.id, { screenSharing: true });
			}

			// Attach local preview
			const ssPub = this.room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
			if (ssPub?.track) {
				const el = ssPub.track.attach() as HTMLVideoElement;
				const key = `${me?.id ?? 'local'}-screenshare`;
				this.videoElements.set(key, el);
				if (me) this.onVideoAttached?.(me.id, 'screenshare', el);
			}

			this.broadcastVoiceState();
			console.log('[ScreenCap] Native screen share fully active');

		} catch (err) {
			console.error('[ScreenCap] Native screen share failed:', err);
			this.stopNativeCapture();
			// Fallback to browser getDisplayMedia
			console.log('[ScreenCap] Falling back to browser getDisplayMedia');
			this.toggleScreenShare({
				resolution: options.resolution,
				frameRate: options.frameRate,
				audio: options.audio
			});
		}
	}

	/** Stop native screen share — stops Rust capture and unpublishes track. */
	async stopNativeScreenShare() {
		const me = authStore.user;

		// Stop frame polling + Rust capture
		this.stopNativeCapture();

		// Unpublish the screen share track from LiveKit
		if (this.room) {
			try {
				await this.room.localParticipant.setScreenShareEnabled(false);
			} catch {}
		}

		// Update state
		voiceStore.screenSharing = false;
		voiceStore.setActiveScreenShare(null);
		const key = `${me?.id ?? 'local'}-screenshare`;
		const existingEl = this.videoElements.get(key);
		if (existingEl) existingEl.remove();
		this.videoElements.delete(key);
		if (me) {
			voiceStore.updateParticipant(me.id, { screenSharing: false });
			this.onVideoDetached?.(me.id, 'screenshare');
		}
		this.broadcastVoiceState();
	}

	async joinVoiceChannel(channelId: string) {
		if (this.room) {
			await this.leaveVoiceChannel();
		}

		voiceStore.setRtcStatus('connecting');

		const { token, url, participants } = await getVoiceToken(channelId);

		const allParticipants = participants.map((p) => ({
			userId: p.user_id,
			username: p.username,
			speaking: false,
			muted: false,
			deafened: false,
			videoEnabled: false,
			screenSharing: false
		}));

		const me = authStore.user;
		if (me && !allParticipants.some((p) => p.userId === me.id)) {
			allParticipants.push({
				userId: me.id,
				username: me.username,
				speaking: false,
				muted: false,
				deafened: false,
				videoEnabled: false,
				screenSharing: false
			});
		}

		voiceStore.setParticipants(allParticipants);
		voiceStore.join(channelId);
		voiceStore.updateStats({ server: new URL(url.replace('ws://', 'http://').replace('wss://', 'https://')).hostname });
		gateway.sendVoiceState(channelId, 'join');

		// Start local VAD or PTT based on setting
		if (settingsStore.inputMode === 'voice_activity') {
			this.startLocalVAD();
		} else {
			await this.setupPTT();
		}

		// Connect to LiveKit (with status tracking)
		this.connectRoom(url, token);
	}

	/** Build audio constraints using the selected input device */
	private getAudioConstraints(): MediaTrackConstraints {
		const deviceId = settingsStore.inputDevice;
		if (deviceId && deviceId !== 'default') {
			return { deviceId: { exact: deviceId } };
		}
		return {};
	}

	/** Local voice activity detection via Web Audio API (RMS-based time domain) */
	private async startLocalVAD() {
		const me = authStore.user;
		if (!me) return;

		try {
			this.micStream = await navigator.mediaDevices.getUserMedia({ audio: this.getAudioConstraints() });
		} catch (err) {
			console.warn('[LiveKit] Microphone access denied, VAD disabled:', err);
			return;
		}
		this.audioCtx = new AudioContext();
		const source = this.audioCtx.createMediaStreamSource(this.micStream);
		this.analyser = this.audioCtx.createAnalyser();
		this.analyser.fftSize = 2048;
		this.analyser.smoothingTimeConstant = 0.3;
		source.connect(this.analyser);

		const dataArray = new Float32Array(this.analyser.fftSize);
		let isSpeaking = false;
		let speakingFrames = 0;
		let silentFrames = 0;

		// Poll every 50ms (20 times/sec) - reliable even when window unfocused
		this.vadInterval = setInterval(() => {
			if (!this.analyser) return;

			// Time domain data: values -1.0 to 1.0 representing raw audio amplitude
			this.analyser.getFloatTimeDomainData(dataArray);

			// Compute RMS (root mean square) - standard measure of audio level
			let sumSquares = 0;
			for (let i = 0; i < dataArray.length; i++) {
				sumSquares += dataArray[i] * dataArray[i];
			}
			const rms = Math.sqrt(sumSquares / dataArray.length);

			// Convert RMS to dB-like scale (0-100)
			// rms of 0.01 = quiet, 0.05 = talking, 0.2 = loud
			const level = Math.min(100, Math.max(0, (rms / 0.15) * 100));

			// Threshold from settings (0-100)
			const threshold = settingsStore.voiceActivityThreshold;
			const nowSpeaking = level > threshold;

			// Hysteresis: require a few consecutive frames to change state
			// This prevents flickering between speaking/silent
			if (nowSpeaking) {
				speakingFrames++;
				silentFrames = 0;
				if (!isSpeaking && speakingFrames >= 2) {
					isSpeaking = true;
					voiceStore.updateParticipant(me.id, { speaking: true });
				}
			} else {
				silentFrames++;
				speakingFrames = 0;
				if (isSpeaking && silentFrames >= 6) {
					isSpeaking = false;
					voiceStore.updateParticipant(me.id, { speaking: false });
				}
			}
		}, 50);
	}

	private stopLocalVAD() {
		if (this.vadInterval !== null) {
			clearInterval(this.vadInterval);
			this.vadInterval = null;
		}
		if (this.audioCtx) {
			this.audioCtx.close();
			this.audioCtx = null;
		}
		this.analyser = null;
		if (this.micStream) {
			for (const track of this.micStream.getTracks()) track.stop();
			this.micStream = null;
		}
	}

	/** Ensure a hidden DOM container exists for remote audio elements */
	private ensureAudioContainer(): HTMLDivElement {
		if (!this.audioContainer) {
			this.audioContainer = document.createElement('div');
			this.audioContainer.id = 'livekit-audio';
			// Use offscreen positioning instead of display:none to avoid
			// WebKit (macOS) autoplay issues with hidden elements
			this.audioContainer.style.position = 'absolute';
			this.audioContainer.style.width = '0';
			this.audioContainer.style.height = '0';
			this.audioContainer.style.overflow = 'hidden';
			document.body.appendChild(this.audioContainer);
		}
		return this.audioContainer;
	}

	/** Remove all attached audio elements and the container */
	private destroyAudioContainer() {
		if (this.audioContainer) {
			this.audioContainer.remove();
			this.audioContainer = null;
		}
	}

	private async connectRoom(url: string, token: string) {
		const room = new Room({ webAudioMix: true });
		this.room = room;
		const container = this.ensureAudioContainer();

		// Track connection state changes
		room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
			if (state === ConnectionState.Connected) {
				voiceStore.setRtcStatus('connected');
				this.startStatsPolling();
			} else if (state === ConnectionState.Reconnecting) {
				voiceStore.setRtcStatus('connecting');
			} else if (state === ConnectionState.Disconnected) {
				voiceStore.setRtcStatus('idle');
				this.stopStatsPolling();
			}
		});

		// Attach remote audio tracks to the DOM so we actually hear them
		room.on(
			RoomEvent.TrackSubscribed,
			(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
				const { userId } = this.parseIdentity(participant.identity);
				if (track.kind === Track.Kind.Audio) {
					const el = track.attach();
					el.id = `audio-${participant.identity}-${publication.trackSid}`;
					// Apply selected output device
					const outDev = settingsStore.outputDevice;
					const mediaEl = el as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
					if (mediaEl.setSinkId && outDev && outDev !== 'default') {
						mediaEl.setSinkId(outDev).catch(() => {});
					}
					container.appendChild(el);
				} else if (track.kind === Track.Kind.Video) {
					const el = track.attach() as HTMLVideoElement;
					if (publication.source === Track.Source.Camera) {
						const key = `${userId}-camera`;
						this.videoElements.set(key, el);
						voiceStore.updateParticipant(userId, { videoEnabled: true });
						this.onVideoAttached?.(userId, 'camera', el);
					} else if (publication.source === Track.Source.ScreenShare) {
						const key = `${userId}-screenshare`;
						this.videoElements.set(key, el);
						voiceStore.updateParticipant(userId, { screenSharing: true });
						voiceStore.setActiveScreenShare(userId);
						this.onVideoAttached?.(userId, 'screenshare', el);
					}
				}
			}
		);

		// Detach + remove audio/video elements when tracks go away
		room.on(
			RoomEvent.TrackUnsubscribed,
			(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
				const { userId } = this.parseIdentity(participant.identity);
				track.detach().forEach((el) => el.remove());
				if (track.kind === Track.Kind.Video) {
					if (publication.source === Track.Source.Camera) {
						this.videoElements.delete(`${userId}-camera`);
						voiceStore.updateParticipant(userId, { videoEnabled: false });
						this.onVideoDetached?.(userId, 'camera');
					} else if (publication.source === Track.Source.ScreenShare) {
						// Only detach video — don't clear screenSharing state here.
						// TrackUnpublished handles that (unsubscribe ≠ stopped sharing).
						this.videoElements.delete(`${userId}-screenshare`);
						this.onVideoDetached?.(userId, 'screenshare');
					}
				}
			}
		);

		// Handle browser autoplay restrictions (user gesture required)
		room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
			if (!room.canPlaybackAudio) {
				console.warn('[LiveKit] Audio playback blocked — attempting room.startAudio()');
				room.startAudio();
			}
		});

		room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
			const speakingIds = new Set(speakers.map((s) => this.parseIdentity(s.identity).userId));
			const myId = authStore.user?.id;
			for (const p of voiceStore.participants) {
				if (p.userId === myId) continue;
				voiceStore.updateParticipant(p.userId, { speaking: speakingIds.has(p.userId) });
			}
		});

		room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
			const { userId, username, isScreenShareBot } = this.parseIdentity(participant.identity);
			// Don't add screenshare bot as a visible participant
			if (isScreenShareBot) return;
			voiceStore.addParticipant({
				userId,
				username,
				speaking: false,
				muted: false,
				deafened: false,
				videoEnabled: false,
				screenSharing: false
			});
		});

		room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
			const { userId, isScreenShareBot } = this.parseIdentity(participant.identity);
			// When the screenshare bot disconnects, clean up screen share state
			if (isScreenShareBot) {
				voiceStore.updateParticipant(userId, { screenSharing: false });
				const key = `${userId}-screenshare`;
				const el = this.videoElements.get(key);
				if (el) el.remove();
				this.videoElements.delete(key);
				this.onVideoDetached?.(userId, 'screenshare');
				if (voiceStore.activeScreenShareUserId === userId) {
					voiceStore.setActiveScreenShare(null);
				}
				return;
			}
			// Regular participant disconnect
			if (voiceStore.activeScreenShareUserId === userId) {
				voiceStore.setActiveScreenShare(null);
			}
			this.videoElements.delete(`${userId}-camera`);
			this.videoElements.delete(`${userId}-screenshare`);
			this.onVideoDetached?.(userId, 'camera');
			this.onVideoDetached?.(userId, 'screenshare');
			voiceStore.removeParticipant(userId);
		});

		// Selective subscription: subscribe to audio/camera always, screen share 1 at a time
		room.on(RoomEvent.TrackPublished, (pub: RemoteTrackPublication, p: RemoteParticipant) => {
			this.handleRemoteTrackPublished(pub, p);
		});
		room.on(RoomEvent.TrackUnpublished, (pub: RemoteTrackPublication, p: RemoteParticipant) => {
			this.handleRemoteTrackUnpublished(pub, p);
		});

		// Audio muted state comes exclusively from gateway state_update (not TrackMuted),
		// so PTT mode doesn't flash the muted badge on the remote side.
		room.on(RoomEvent.TrackMuted, (publication: TrackPublication, participant: Participant) => {
			const { userId } = this.parseIdentity(participant.identity);
			if (userId === authStore.user?.id) return; // Skip local — managed by our toggles
			if (publication.kind === Track.Kind.Video) {
				if (publication.source === Track.Source.Camera) {
					voiceStore.updateParticipant(userId, { videoEnabled: false });
				} else if (publication.source === Track.Source.ScreenShare) {
					voiceStore.updateParticipant(userId, { screenSharing: false });
				}
			}
		});

		room.on(
			RoomEvent.TrackUnmuted,
			(publication: TrackPublication, participant: Participant) => {
				const { userId } = this.parseIdentity(participant.identity);
				if (userId === authStore.user?.id) return; // Skip local
				if (publication.kind === Track.Kind.Video) {
					if (publication.source === Track.Source.Camera) {
						voiceStore.updateParticipant(userId, { videoEnabled: true });
					} else if (publication.source === Track.Source.ScreenShare) {
						voiceStore.updateParticipant(userId, { screenSharing: true });
					}
				}
			}
		);

		// Catch local track unpublished (e.g. user stops screen share via browser's "Stop sharing" button)
		room.on(RoomEvent.LocalTrackUnpublished, (publication: LocalTrackPublication) => {
			const me = authStore.user;
			if (publication.source === Track.Source.ScreenShare) {
				voiceStore.screenSharing = false;
				const key = `${me?.id ?? 'local'}-screenshare`;
				const el = this.videoElements.get(key);
				if (el) el.remove();
				this.videoElements.delete(key);
				if (me) {
					voiceStore.updateParticipant(me.id, { screenSharing: false });
					this.onVideoDetached?.(me.id, 'screenshare');
				}
				// Auto-switch to next available remote sharer, or clear
				if (voiceStore.activeScreenShareUserId === me?.id) {
					const nextSharer = voiceStore.screenSharers.find(p => p.userId !== me?.id);
					if (nextSharer) {
						this.watchScreenShare(nextSharer.userId);
					} else {
						voiceStore.setActiveScreenShare(null);
					}
				}
				this.broadcastVoiceState();
			} else if (publication.source === Track.Source.Camera) {
				voiceStore.videoEnabled = false;
				const key = `${me?.id ?? 'local'}-camera`;
				const el = this.videoElements.get(key);
				if (el) el.remove();
				this.videoElements.delete(key);
				if (me) {
					voiceStore.updateParticipant(me.id, { videoEnabled: false });
					this.onVideoDetached?.(me.id, 'camera');
				}
				this.broadcastVoiceState();
			}
		});

		await room.connect(url, token, { autoSubscribe: false });
		voiceStore.setRtcStatus('connected');

		// Subscribe to all already-published tracks (autoSubscribe is off)
		this.subscribeExistingTracks();

		const micOn = settingsStore.inputMode === 'voice_activity';
		const micDeviceId = settingsStore.inputDevice;
		const micOptions = micDeviceId && micDeviceId !== 'default' ? { deviceId: micDeviceId } : undefined;
		await room.localParticipant.setMicrophoneEnabled(micOn, micOptions);

		// If autoplay was blocked before connect, kick it now
		if (!room.canPlaybackAudio) {
			room.startAudio();
		}

		this.startStatsPolling();
	}

	private startStatsPolling() {
		this.stopStatsPolling();
		// Poll WebRTC stats every 2 seconds
		this.statsInterval = setInterval(async () => {
			if (!this.room) return;

			try {
				// Access engine internals with graceful degradation
				const pc = (this.room as any).engine?.pcManager?.publisher;
				if (!pc?.getStats) return;

				const report = await pc.getStats();
				let latency = 0;
				let packetLoss = 0;
				let jitter = 0;
				let bitrate = 0;
				let codec = '—';

				report.forEach((stat: any) => {
					if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
						latency = Math.round((stat.currentRoundTripTime ?? 0) * 1000);
					}
					if (stat.type === 'outbound-rtp' && stat.kind === 'audio') {
						packetLoss = stat.packetsLost ?? 0;
						bitrate = Math.round((stat.bytesSent ?? 0) * 8 / 1000);
					}
					if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
						jitter = Math.round((stat.jitter ?? 0) * 1000);
					}
					if (stat.type === 'codec' && stat.mimeType?.includes('opus')) {
						codec = 'Opus';
					}
				});

				voiceStore.updateStats({ latencyMs: latency, packetLoss, jitter, bitrate, codec });
			} catch {
				// Stats unavailable (e.g., LiveKit internals changed), silently continue
			}
		}, 2000);
	}

	private stopStatsPolling() {
		if (this.statsInterval) {
			clearInterval(this.statsInterval);
			this.statsInterval = null;
		}
	}

	/** Join a LiveKit room for a DM call — integrates with voiceStore for full state sync. */
	async joinCallRoom(url: string, token: string, channelId: string) {
		if (this.room) {
			await this.leaveVoiceChannel();
		}

		voiceStore.setRtcStatus('connecting');

		const room = new Room({ webAudioMix: true });
		this.room = room;
		const container = this.ensureAudioContainer();

		// Track connection state → voiceStore.rtcStatus
		room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
			if (state === ConnectionState.Connected) {
				voiceStore.setRtcStatus('connected');
			} else if (state === ConnectionState.Reconnecting) {
				voiceStore.setRtcStatus('connecting');
			} else if (state === ConnectionState.Disconnected) {
				voiceStore.setRtcStatus('idle');
				this.stopStatsPolling();
			}
		});

		// Attach remote audio/video tracks
		room.on(
			RoomEvent.TrackSubscribed,
			(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
				const { userId } = this.parseIdentity(participant.identity);
				if (track.kind === Track.Kind.Audio) {
					const el = track.attach();
					el.id = `audio-${participant.identity}-${publication.trackSid}`;
					container.appendChild(el);
				} else if (track.kind === Track.Kind.Video) {
					const el = track.attach() as HTMLVideoElement;
					if (publication.source === Track.Source.Camera) {
						this.videoElements.set(`${userId}-camera`, el);
						voiceStore.updateParticipant(userId, { videoEnabled: true });
						this.onVideoAttached?.(userId, 'camera', el);
					} else if (publication.source === Track.Source.ScreenShare) {
						this.videoElements.set(`${userId}-screenshare`, el);
						voiceStore.updateParticipant(userId, { screenSharing: true });
						voiceStore.setActiveScreenShare(userId);
						this.onVideoAttached?.(userId, 'screenshare', el);
					}
				}
			}
		);

		room.on(
			RoomEvent.TrackUnsubscribed,
			(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
				const { userId } = this.parseIdentity(participant.identity);
				track.detach().forEach((el) => el.remove());
				if (track.kind === Track.Kind.Video) {
					if (publication.source === Track.Source.Camera) {
						this.videoElements.delete(`${userId}-camera`);
						voiceStore.updateParticipant(userId, { videoEnabled: false });
						this.onVideoDetached?.(userId, 'camera');
					} else if (publication.source === Track.Source.ScreenShare) {
						this.videoElements.delete(`${userId}-screenshare`);
						this.onVideoDetached?.(userId, 'screenshare');
					}
				}
			}
		);

		room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
			if (!room.canPlaybackAudio) {
				room.startAudio();
			}
		});

		room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
			const speakingIds = new Set(speakers.map((s) => this.parseIdentity(s.identity).userId));
			const myId = authStore.user?.id;
			for (const p of voiceStore.participants) {
				if (p.userId === myId) continue;
				voiceStore.updateParticipant(p.userId, { speaking: speakingIds.has(p.userId) });
			}
		});

		// Handle muted/unmuted for video tracks in calls.
		// Audio muted state is NOT set here — it comes exclusively from gateway state_update,
		// so that PTT mode (which toggles mic on/off rapidly) doesn't flash the muted badge.
		room.on(RoomEvent.TrackMuted, (publication: TrackPublication, participant: Participant) => {
			const { userId } = this.parseIdentity(participant.identity);
			if (userId === authStore.user?.id) return;
			if (publication.kind === Track.Kind.Video) {
				if (publication.source === Track.Source.Camera) {
					voiceStore.updateParticipant(userId, { videoEnabled: false });
				} else if (publication.source === Track.Source.ScreenShare) {
					voiceStore.updateParticipant(userId, { screenSharing: false });
				}
			}
		});

		room.on(RoomEvent.TrackUnmuted, (publication: TrackPublication, participant: Participant) => {
			const { userId } = this.parseIdentity(participant.identity);
			if (userId === authStore.user?.id) return;
			if (publication.kind === Track.Kind.Video) {
				if (publication.source === Track.Source.Camera) {
					voiceStore.updateParticipant(userId, { videoEnabled: true });
				} else if (publication.source === Track.Source.ScreenShare) {
					voiceStore.updateParticipant(userId, { screenSharing: true });
				}
			}
		});

		// Catch local track unpublished (browser "Stop sharing" button, etc.)
		room.on(RoomEvent.LocalTrackUnpublished, (publication: LocalTrackPublication) => {
			const me = authStore.user;
			if (publication.source === Track.Source.ScreenShare) {
				voiceStore.screenSharing = false;
				const key = `${me?.id ?? 'local'}-screenshare`;
				const el = this.videoElements.get(key);
				if (el) el.remove();
				this.videoElements.delete(key);
				if (me) {
					voiceStore.updateParticipant(me.id, { screenSharing: false });
					this.onVideoDetached?.(me.id, 'screenshare');
				}
				// Auto-switch to next available remote sharer, or clear
				if (voiceStore.activeScreenShareUserId === me?.id) {
					const nextSharer = voiceStore.screenSharers.find(p => p.userId !== me?.id);
					if (nextSharer) {
						this.watchScreenShare(nextSharer.userId);
					} else {
						voiceStore.setActiveScreenShare(null);
					}
				}
				this.broadcastVoiceState();
			} else if (publication.source === Track.Source.Camera) {
				voiceStore.videoEnabled = false;
				const key = `${me?.id ?? 'local'}-camera`;
				const el = this.videoElements.get(key);
				if (el) el.remove();
				this.videoElements.delete(key);
				if (me) {
					voiceStore.updateParticipant(me.id, { videoEnabled: false });
					this.onVideoDetached?.(me.id, 'camera');
				}
				this.broadcastVoiceState();
			}
		});

		room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
			const { userId, username, isScreenShareBot } = this.parseIdentity(participant.identity);
			if (isScreenShareBot) return;
			voiceStore.addParticipant({
				userId,
				username,
				speaking: false,
				muted: false,
				deafened: false,
				videoEnabled: false,
				screenSharing: false
			});
		});

		room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
			const { userId, isScreenShareBot } = this.parseIdentity(participant.identity);
			if (isScreenShareBot) {
				voiceStore.updateParticipant(userId, { screenSharing: false });
				const key = `${userId}-screenshare`;
				const el = this.videoElements.get(key);
				if (el) el.remove();
				this.videoElements.delete(key);
				this.onVideoDetached?.(userId, 'screenshare');
				if (voiceStore.activeScreenShareUserId === userId) {
					voiceStore.setActiveScreenShare(null);
				}
				return;
			}
			if (voiceStore.activeScreenShareUserId === userId) {
				voiceStore.setActiveScreenShare(null);
			}
			this.videoElements.delete(`${userId}-camera`);
			this.videoElements.delete(`${userId}-screenshare`);
			this.onVideoDetached?.(userId, 'camera');
			this.onVideoDetached?.(userId, 'screenshare');
			voiceStore.removeParticipant(userId);
		});

		// Selective subscription: subscribe to audio/camera always, screen share 1 at a time
		room.on(RoomEvent.TrackPublished, (pub: RemoteTrackPublication, p: RemoteParticipant) => {
			this.handleRemoteTrackPublished(pub, p);
		});
		room.on(RoomEvent.TrackUnpublished, (pub: RemoteTrackPublication, p: RemoteParticipant) => {
			this.handleRemoteTrackUnpublished(pub, p);
		});

		await room.connect(url, token, { autoSubscribe: false });
		voiceStore.setRtcStatus('connected');

		// Populate voiceStore with participants
		voiceStore.join(channelId);

		const me = authStore.user;
		if (me) {
			voiceStore.addParticipant({
				userId: me.id,
				username: me.username,
				speaking: false,
				muted: false,
				deafened: false,
				videoEnabled: false,
				screenSharing: false
			});
		}

		for (const p of room.remoteParticipants.values()) {
			const { userId, username, isScreenShareBot } = this.parseIdentity(p.identity);
			if (isScreenShareBot) continue;
			voiceStore.addParticipant({
				userId,
				username,
				speaking: false,
				muted: false,
				deafened: false,
				videoEnabled: false,
				screenSharing: false
			});
		}

		// Subscribe to all already-published tracks (autoSubscribe is off)
		this.subscribeExistingTracks();

		// Respect input mode: VAD or PTT
		const callMicDeviceId = settingsStore.inputDevice;
		const callMicOptions = callMicDeviceId && callMicDeviceId !== 'default' ? { deviceId: callMicDeviceId } : undefined;
		if (settingsStore.inputMode === 'voice_activity') {
			await room.localParticipant.setMicrophoneEnabled(true, callMicOptions);
			this.startLocalVAD();
		} else {
			await room.localParticipant.setMicrophoneEnabled(false, callMicOptions);
			await this.setupPTT();
		}

		// Handle autoplay restrictions
		if (!room.canPlaybackAudio) {
			room.startAudio();
		}

		this.startStatsPolling();
	}

	/** Disconnect from a call room if connected. */
	leaveCallRoom() {
		this.stopStatsPolling();
		this.stopLocalVAD();
		this.teardownPTT();
		this.stopNativeCapture();
		this.cleanupVideoElements();
		this.room?.disconnect();
		this.room = null;
		this.destroyAudioContainer();
		voiceStore.disconnect();
	}

	async leaveVoiceChannel() {
		this.stopLocalVAD();
		await this.teardownPTT();
		this.stopNativeCapture();
		this.stopStatsPolling();
		this.cleanupVideoElements();
		this.room?.disconnect();
		this.room = null;
		this.destroyAudioContainer();
		gateway.sendVoiceState(null, 'leave');
		voiceStore.disconnect();
	}

	/** Kill native screen share without updating voice state */
	private stopNativeCapture() {
		this.nativeScreenShareActive = false;

		// Stop frame polling timer
		if (this.nativeCapTimer) {
			clearInterval(this.nativeCapTimer);
			this.nativeCapTimer = null;
		}

		// Stop canvas stream tracks
		if (this.nativeCapStream) {
			for (const t of this.nativeCapStream.getTracks()) t.stop();
			this.nativeCapStream = null;
		}
		this.nativeCapCanvas = null;

		// Stop Rust-side capture (fire-and-forget)
		loadTauriApis().then(() => { if (_invoke) _invoke('stop_capture').catch(() => {}); }).catch(() => {});
	}

	/** Remove all tracked video elements from DOM and clear the map */
	private cleanupVideoElements() {
		for (const el of this.videoElements.values()) {
			el.remove();
		}
		this.videoElements.clear();
	}

	async toggleMute() {
		const wasDeafened = voiceStore.deafened;
		voiceStore.toggleMute();
		if (this.room) {
			await this.room.localParticipant.setMicrophoneEnabled(!voiceStore.muted);
			// If we were deafened, re-enable all remote audio tracks
			if (wasDeafened) {
				for (const participant of this.room.remoteParticipants.values()) {
					for (const publication of participant.audioTrackPublications.values()) {
						publication.setEnabled(true);
					}
				}
			}
		}
		if (voiceStore.muted) {
			this.stopLocalVAD();
		} else if (settingsStore.inputMode === 'voice_activity') {
			this.startLocalVAD();
		}
		// Update local participant entry so the UI reflects the change
		const me = authStore.user;
		if (me) voiceStore.updateParticipant(me.id, { muted: voiceStore.muted, deafened: voiceStore.deafened });
		// Broadcast state to others
		this.broadcastVoiceState();
	}

	async toggleDeafen() {
		voiceStore.toggleDeafen();
		if (this.room) {
			await this.room.localParticipant.setMicrophoneEnabled(!voiceStore.muted);
			for (const participant of this.room.remoteParticipants.values()) {
				for (const publication of participant.audioTrackPublications.values()) {
					publication.setEnabled(!voiceStore.deafened);
				}
			}
		}
		if (voiceStore.deafened) {
			this.stopLocalVAD();
		} else if (settingsStore.inputMode === 'voice_activity') {
			this.startLocalVAD();
		}
		// Update local participant entry so the UI reflects the change
		const me = authStore.user;
		if (me) voiceStore.updateParticipant(me.id, { muted: voiceStore.muted, deafened: voiceStore.deafened });
		// Broadcast state to others
		this.broadcastVoiceState();
	}

	private broadcastVoiceState() {
		if (voiceStore.channelId) {
			gateway.sendVoiceState(voiceStore.channelId, 'state_update', {
				muted: voiceStore.muted,
				deafened: voiceStore.deafened,
				videoEnabled: voiceStore.videoEnabled,
				screenSharing: voiceStore.screenSharing
			});
		}
	}

	private async setupPTT() {
		const me = authStore.user;
		if (!me) return;

		const keyCode = settingsStore.pttKeybind;
		console.log('[PTT] Setting up PTT for key:', keyCode);

		// Try Tauri native PTT listener first (works system-wide, even when unfocused)
		try {
			await loadTauriApis();
			if (_invoke && _listen) {
				// Start the Rust-side polling listener
				await _invoke('start_ptt_listener', { keyCode });
				console.log('[PTT] Native listener started for:', keyCode);

				// Listen for press/release events from Rust
				const unPress = await _listen('ptt-press', () => {
					if (!this.pttDown) {
						this.pttDown = true;
						voiceStore.updateParticipant(me.id, { speaking: true });
						if (this.room) this.room.localParticipant.setMicrophoneEnabled(true);
					}
				});
				const unRelease = await _listen('ptt-release', () => {
					if (this.pttDown) {
						this.pttDown = false;
						voiceStore.updateParticipant(me.id, { speaking: false });
						if (this.room) this.room.localParticipant.setMicrophoneEnabled(false);
					}
				});

				this.pttUnlistenPress = unPress;
				this.pttUnlistenRelease = unRelease;
				console.log('[PTT] Native system-wide PTT active');
				return; // Native listener works, skip window fallback
			}
		} catch (err) {
			console.error('[PTT] Native listener failed, falling back to window events:', err);
		}

		// Fallback: window event listeners (only works when app is focused)
		this.handleKeyDown = (e: KeyboardEvent) => {
			if (e.code !== settingsStore.pttKeybind || e.repeat || this.pttDown) return;
			this.pttDown = true;
			voiceStore.updateParticipant(me.id, { speaking: true });
			if (this.room) this.room.localParticipant.setMicrophoneEnabled(true);
		};

		this.handleKeyUp = (e: KeyboardEvent) => {
			if (e.code !== settingsStore.pttKeybind || !this.pttDown) return;
			this.pttDown = false;
			voiceStore.updateParticipant(me.id, { speaking: false });
			if (this.room) this.room.localParticipant.setMicrophoneEnabled(false);
		};

		window.addEventListener('keydown', this.handleKeyDown);
		window.addEventListener('keyup', this.handleKeyUp);
	}

	private async teardownPTT() {
		// Stop Tauri native listener
		if (this.pttUnlistenPress) {
			this.pttUnlistenPress();
			this.pttUnlistenPress = null;
		}
		if (this.pttUnlistenRelease) {
			this.pttUnlistenRelease();
			this.pttUnlistenRelease = null;
		}
		try {
			await loadTauriApis();
			if (_invoke) await _invoke('stop_ptt_listener');
		} catch {}

		// Stop window fallback listeners
		if (this.handleKeyDown) window.removeEventListener('keydown', this.handleKeyDown);
		if (this.handleKeyUp) window.removeEventListener('keyup', this.handleKeyUp);
		this.handleKeyDown = null;
		this.handleKeyUp = null;
		this.pttDown = false;
	}

	/** Switch the microphone device on the active room */
	async switchInputDevice(deviceId: string) {
		if (!this.room) return;
		console.log('[LiveKit] Switching input device to:', deviceId);

		// Restart VAD with new device if in voice activity mode
		if (settingsStore.inputMode === 'voice_activity' && !voiceStore.muted) {
			this.stopLocalVAD();
			this.startLocalVAD();
		}

		// Switch the published mic track to the new device
		try {
			const constraints: MediaTrackConstraints = deviceId && deviceId !== 'default'
				? { deviceId: { exact: deviceId } }
				: {};
			await this.room.switchActiveDevice('audioinput', deviceId === 'default' ? '' : deviceId);
		} catch (err) {
			console.error('[LiveKit] Failed to switch input device:', err);
		}
	}

	/** Switch the audio output device on all remote audio elements */
	async switchOutputDevice(deviceId: string) {
		console.log('[LiveKit] Switching output device to:', deviceId);
		const container = this.audioContainer;
		if (!container) return;

		const audioEls = container.querySelectorAll('audio, video');
		for (const el of audioEls) {
			const mediaEl = el as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
			if (mediaEl.setSinkId) {
				try {
					await mediaEl.setSinkId(deviceId === 'default' ? '' : deviceId);
				} catch (err) {
					console.error('[LiveKit] Failed to set output device on element:', err);
				}
			}
		}
	}

	async switchInputMode() {
		if (!this.room) return; // Not in a voice channel, nothing to switch

		// Teardown current mode
		this.stopLocalVAD();
		await this.teardownPTT();

		const me = authStore.user;

		if (settingsStore.inputMode === 'voice_activity') {
			// Switching to VAD: enable mic, start VAD
			if (!voiceStore.muted) {
				await this.room.localParticipant.setMicrophoneEnabled(true);
				this.startLocalVAD();
			}
		} else {
			// Switching to PTT: disable mic (will be enabled by PTT key), setup PTT
			await this.room.localParticipant.setMicrophoneEnabled(false);
			await this.setupPTT();
			// Clear speaking state
			if (me) voiceStore.updateParticipant(me.id, { speaking: false });
		}
	}
}

export const livekit = new LiveKitService();
