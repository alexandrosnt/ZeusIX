/**
 * Discord-style markdown parser.
 *
 * Parsing order (matches Discord):
 * 1. Fenced code blocks  — ```lang\n...\n``` — block-level, contents literal
 * 2. Inline code         — `...`            — inline, contents literal
 * 3. Bold (**...**), Italic (*...*), Strikethrough (~~...~~)
 * 4. @mentions           — only in remaining text segments
 */

export type Segment =
	| { type: 'text'; text: string }
	| { type: 'mention'; text: string; username: string }
	| { type: 'code-block'; code: string; language: string }
	| { type: 'code-inline'; code: string }
	| { type: 'bold'; text: string }
	| { type: 'italic'; text: string }
	| { type: 'strikethrough'; text: string };

const FENCED_CODE_RE = /```(\w*)\n([\s\S]*?)```/g;
const INLINE_CODE_RE = /`([^`\n]+)`/g;
const BOLD_RE = /\*\*(.+?)\*\*/g;
const ITALIC_RE = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
const STRIKE_RE = /~~(.+?)~~/g;
const MENTION_RE = /(?:^|\s)(@(\w+))/g;

/**
 * HTML-escape a string (defense-in-depth for Shiki input).
 */
export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Parse message content into a flat list of typed segments.
 */
export function parseMarkdown(content: string, knownUsernames: Set<string>): Segment[] {
	// Phase 1: Extract fenced code blocks
	let segments: Segment[] = splitByRegex(
		[{ type: 'text', text: content }],
		FENCED_CODE_RE,
		(match) => ({
			type: 'code-block' as const,
			code: match[2],
			language: match[1] || 'text'
		})
	);

	// Phase 2: Extract inline code (only from 'text' segments)
	segments = splitByRegex(segments, INLINE_CODE_RE, (match) => ({
		type: 'code-inline' as const,
		code: match[1]
	}));

	// Phase 3: Bold, italic, strikethrough (only from 'text' segments)
	segments = splitByRegex(segments, BOLD_RE, (match) => ({
		type: 'bold' as const,
		text: match[1]
	}));

	segments = splitByRegex(segments, ITALIC_RE, (match) => ({
		type: 'italic' as const,
		text: match[1]
	}));

	segments = splitByRegex(segments, STRIKE_RE, (match) => ({
		type: 'strikethrough' as const,
		text: match[1]
	}));

	// Phase 4: @mentions (only from 'text' segments)
	segments = splitMentions(segments, knownUsernames);

	return segments;
}

/**
 * Split 'text' segments by a regex pattern, replacing matches with new segments.
 * Non-text segments are passed through unchanged.
 */
function splitByRegex(
	segments: Segment[],
	regex: RegExp,
	makeSegment: (match: RegExpExecArray) => Segment
): Segment[] {
	const result: Segment[] = [];

	for (const seg of segments) {
		if (seg.type !== 'text') {
			result.push(seg);
			continue;
		}

		const text = seg.text;
		const re = new RegExp(regex.source, regex.flags);
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = re.exec(text)) !== null) {
			if (match.index > lastIndex) {
				result.push({ type: 'text', text: text.slice(lastIndex, match.index) });
			}
			result.push(makeSegment(match));
			lastIndex = re.lastIndex;
		}

		if (lastIndex < text.length) {
			result.push({ type: 'text', text: text.slice(lastIndex) });
		}
	}

	return result;
}

/**
 * Extract @mentions from text segments, checking against known usernames.
 */
function splitMentions(segments: Segment[], knownUsernames: Set<string>): Segment[] {
	const result: Segment[] = [];

	for (const seg of segments) {
		if (seg.type !== 'text') {
			result.push(seg);
			continue;
		}

		const text = seg.text;
		const re = new RegExp(MENTION_RE.source, MENTION_RE.flags);
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = re.exec(text)) !== null) {
			const fullMatch = match[1]; // @username
			const username = match[2]; // username

			if (!knownUsernames.has(username.toLowerCase())) continue;

			// match[0] may include a leading space; find the actual @
			const atIndex = text.indexOf(fullMatch, match.index);
			if (atIndex === -1) continue;

			if (atIndex > lastIndex) {
				result.push({ type: 'text', text: text.slice(lastIndex, atIndex) });
			}
			result.push({ type: 'mention', text: fullMatch, username });
			lastIndex = atIndex + fullMatch.length;
		}

		if (lastIndex < text.length) {
			result.push({ type: 'text', text: text.slice(lastIndex) });
		}
	}

	return result;
}
