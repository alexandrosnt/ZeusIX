const STORAGE_KEY = 'zeusix_settings';

type Theme = 'dark' | 'midnight' | 'amoled';
type InputMode = 'voice_activity' | 'push_to_talk';
type FontFamily = 'system' | 'mono' | 'serif';
type AutoDelete = 'never' | '24h' | '7d' | '30d';

export interface UserSettings {
	theme: Theme;
	accentColor: string;
	inputMode: InputMode;
	pttKeybind: string;
	voiceActivityThreshold: number;
	inputDevice: string;
	outputDevice: string;
	inputVolume: number;
	outputVolume: number;
	chatFontSize: number;
	chatFontFamily: FontFamily;
	compactMode: boolean;
	showOnlineStatus: boolean;
	showReadReceipts: boolean;
	allowDmFromServerMembers: boolean;
	autoDeleteMessages: AutoDelete;
	blockInvites: boolean;
	hideTypingIndicator: boolean;
	minimizeToTray: boolean;
}

const DEFAULTS: UserSettings = {
	theme: 'dark',
	accentColor: '#0a84ff',
	inputMode: 'voice_activity',
	pttKeybind: 'KeyV',
	voiceActivityThreshold: 50,
	inputDevice: 'default',
	outputDevice: 'default',
	inputVolume: 100,
	outputVolume: 100,
	chatFontSize: 15,
	chatFontFamily: 'system',
	compactMode: false,
	showOnlineStatus: true,
	showReadReceipts: false,
	allowDmFromServerMembers: true,
	autoDeleteMessages: 'never',
	blockInvites: false,
	hideTypingIndicator: false,
	minimizeToTray: true
};

class SettingsStore {
	theme = $state<Theme>('dark');
	accentColor = $state('#0a84ff');
	inputMode = $state<InputMode>('voice_activity');
	pttKeybind = $state('KeyV');
	voiceActivityThreshold = $state(50);
	inputDevice = $state('default');
	outputDevice = $state('default');
	inputVolume = $state(100);
	outputVolume = $state(100);
	chatFontSize = $state(15);
	chatFontFamily = $state<FontFamily>('system');
	compactMode = $state(false);
	showOnlineStatus = $state(true);
	showReadReceipts = $state(false);
	allowDmFromServerMembers = $state(true);
	autoDeleteMessages = $state<AutoDelete>('never');
	blockInvites = $state(false);
	hideTypingIndicator = $state(false);
	minimizeToTray = $state(true);

	constructor() {
		this.restoreSettings();
	}

	update(partial: Partial<UserSettings>) {
		const keys = Object.keys(partial) as (keyof UserSettings)[];
		for (const key of keys) {
			(this as any)[key] = partial[key];
		}
		this.persist();
	}

	reset() {
		this.update({ ...DEFAULTS });
	}

	toJSON(): UserSettings {
		return {
			theme: this.theme,
			accentColor: this.accentColor,
			inputMode: this.inputMode,
			pttKeybind: this.pttKeybind,
			voiceActivityThreshold: this.voiceActivityThreshold,
			inputDevice: this.inputDevice,
			outputDevice: this.outputDevice,
			inputVolume: this.inputVolume,
			outputVolume: this.outputVolume,
			chatFontSize: this.chatFontSize,
			chatFontFamily: this.chatFontFamily,
			compactMode: this.compactMode,
			showOnlineStatus: this.showOnlineStatus,
			showReadReceipts: this.showReadReceipts,
			allowDmFromServerMembers: this.allowDmFromServerMembers,
			autoDeleteMessages: this.autoDeleteMessages,
			blockInvites: this.blockInvites,
			hideTypingIndicator: this.hideTypingIndicator,
			minimizeToTray: this.minimizeToTray
		};
	}

	persist() {
		try {
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toJSON()));
			}
		} catch {
			// localStorage may be unavailable
		}
	}

	restoreSettings() {
		try {
			if (typeof localStorage === 'undefined') return;
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw) as Partial<UserSettings>;
			const keys = Object.keys(DEFAULTS) as (keyof UserSettings)[];
			for (const key of keys) {
				if (key in parsed) {
					(this as any)[key] = parsed[key];
				}
			}
		} catch {
			// corrupt data — keep defaults
		}
	}
}

export const settingsStore = new SettingsStore();
