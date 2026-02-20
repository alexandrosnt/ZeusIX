import type { UserSettings } from '$lib/stores/settings.svelte';

interface ThemeVars {
	'--bg-app': string;
	'--bg-glass-heavy': string;
	'--bg-glass-light': string;
	'--bg-glass-lighter': string;
	'--glass-heavy-rgb': string;
	'--glass-light-rgb': string;
	'--glass-lighter-rgb': string;
}

const THEME_MAP: Record<UserSettings['theme'], ThemeVars> = {
	dark: {
		'--bg-app': '#000000',
		'--bg-glass-heavy': 'rgba(28, 28, 30, 0.65)',
		'--bg-glass-light': 'rgba(44, 44, 46, 0.4)',
		'--bg-glass-lighter': 'rgba(58, 58, 60, 0.3)',
		'--glass-heavy-rgb': '28, 28, 30',
		'--glass-light-rgb': '44, 44, 46',
		'--glass-lighter-rgb': '58, 58, 60'
	},
	midnight: {
		'--bg-app': '#0a0e1a',
		'--bg-glass-heavy': 'rgba(10, 14, 26, 0.75)',
		'--bg-glass-light': 'rgba(18, 24, 44, 0.5)',
		'--bg-glass-lighter': 'rgba(28, 36, 60, 0.4)',
		'--glass-heavy-rgb': '10, 14, 26',
		'--glass-light-rgb': '18, 24, 44',
		'--glass-lighter-rgb': '28, 36, 60'
	},
	amoled: {
		'--bg-app': '#000000',
		'--bg-glass-heavy': 'rgba(0, 0, 0, 0.85)',
		'--bg-glass-light': 'rgba(12, 12, 12, 0.6)',
		'--bg-glass-lighter': 'rgba(20, 20, 20, 0.4)',
		'--glass-heavy-rgb': '0, 0, 0',
		'--glass-light-rgb': '12, 12, 12',
		'--glass-lighter-rgb': '20, 20, 20'
	}
};

const FONT_MAP: Record<UserSettings['chatFontFamily'], string> = {
	system: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, sans-serif",
	mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
	serif: "Georgia, 'Times New Roman', serif"
};

const VALID_HEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/** Parse hex (#rrggbb or #rgb) to "r, g, b" string for use in rgba() */
function hexToRgb(hex: string): string {
	if (!VALID_HEX.test(hex)) return '10, 132, 255'; // fallback to default accent
	const h = hex.replace('#', '');
	const full = h.length === 3
		? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
		: h;
	const r = parseInt(full.substring(0, 2), 16);
	const g = parseInt(full.substring(2, 4), 16);
	const b = parseInt(full.substring(4, 6), 16);
	return `${r}, ${g}, ${b}`;
}

/** Lighten a hex color by mixing with white */
function lightenHex(hex: string, amount: number): string {
	if (!VALID_HEX.test(hex)) return hex;
	const h = hex.replace('#', '');
	const full = h.length === 3
		? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
		: h;
	const r = Math.min(255, Math.round(parseInt(full.substring(0, 2), 16) + (255 - parseInt(full.substring(0, 2), 16)) * amount));
	const g = Math.min(255, Math.round(parseInt(full.substring(2, 4), 16) + (255 - parseInt(full.substring(2, 4), 16)) * amount));
	const b = Math.min(255, Math.round(parseInt(full.substring(4, 6), 16) + (255 - parseInt(full.substring(4, 6), 16)) * amount));
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function applyTheme(settings: {
	theme: UserSettings['theme'];
	accentColor: string;
	chatFontFamily: UserSettings['chatFontFamily'];
	chatFontSize: number;
}) {
	if (typeof document === 'undefined') return;
	const root = document.documentElement.style;
	const vars = THEME_MAP[settings.theme];

	// Theme backgrounds (pre-composed for direct use)
	root.setProperty('--bg-app', vars['--bg-app']);
	root.setProperty('--bg-glass-heavy', vars['--bg-glass-heavy']);
	root.setProperty('--bg-glass-light', vars['--bg-glass-light']);
	root.setProperty('--bg-glass-lighter', vars['--bg-glass-lighter']);

	// Glass RGB components (for custom-opacity rgba() in components)
	root.setProperty('--glass-heavy-rgb', vars['--glass-heavy-rgb']);
	root.setProperty('--glass-light-rgb', vars['--glass-light-rgb']);
	root.setProperty('--glass-lighter-rgb', vars['--glass-lighter-rgb']);

	// Accent color — hex, decomposed RGB, and hover variant
	root.setProperty('--accent-blue', settings.accentColor);
	root.setProperty('--accent-rgb', hexToRgb(settings.accentColor));
	root.setProperty('--accent-blue-hover', lightenHex(settings.accentColor, 0.2));

	// Font
	root.setProperty('--font-stack', FONT_MAP[settings.chatFontFamily]);
	root.setProperty('--chat-font-size', settings.chatFontSize + 'px');
}
