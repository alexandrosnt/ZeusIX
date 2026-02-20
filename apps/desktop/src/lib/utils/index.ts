/**
 * Generate a deterministic color from a string (username, etc.)
 */
export function hashColor(str: string): string {
	const colors = [
		'#FF453A', '#FF9F0A', '#FFD60A', '#30D158',
		'#0A84FF', '#5E5CE6', '#BF5AF2', '#FF375F',
		'#64D2FF', '#AC8E68', '#FF6482', '#32ADE6'
	];
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	return colors[Math.abs(hash) % colors.length];
}

/**
 * Get initials from a name (max 2 characters)
 */
export function getInitials(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return name.slice(0, 2).toUpperCase();
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();

	const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

	if (isToday) {
		return `Today at ${time}`;
	}

	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	if (date.toDateString() === yesterday.toDateString()) {
		return `Yesterday at ${time}`;
	}

	return `${date.toLocaleDateString()} ${time}`;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Debounce a function call
 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
	let timeout: ReturnType<typeof setTimeout>;
	return ((...args: unknown[]) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => fn(...args), delay);
	}) as T;
}

/**
 * Throttle a function call
 */
export function throttle<T extends (...args: unknown[]) => void>(fn: T, limit: number): T {
	let lastCall = 0;
	return ((...args: unknown[]) => {
		const now = Date.now();
		if (now - lastCall >= limit) {
			lastCall = now;
			fn(...args);
		}
	}) as T;
}
