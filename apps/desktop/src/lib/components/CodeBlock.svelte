<script lang="ts" module>
	import { createHighlighter, type HighlighterGeneric } from 'shiki';

	let highlighterPromise: Promise<HighlighterGeneric<any, any>> | null = null;

	function getHighlighter(): Promise<HighlighterGeneric<any, any>> {
		if (!highlighterPromise) {
			highlighterPromise = createHighlighter({
				themes: ['github-dark'],
				langs: []
			});
		}
		return highlighterPromise;
	}
</script>

<script lang="ts">
	let { code, language }: { code: string; language: string } = $props();

	let highlighted: string | null = $state(null);
	let copied = $state(false);

	$effect(() => {
		// Re-run when code or language changes
		const currentCode = code;
		const currentLanguage = language;
		highlighted = null;

		let cancelled = false;

		(async () => {
			try {
				const highlighter = await getHighlighter();

				if (cancelled) return;

				// Attempt to load the requested language
				try {
					await highlighter.loadLanguage(currentLanguage as any);
				} catch {
					// Language not supported by Shiki, fall back to 'text'
					try {
						await highlighter.loadLanguage('text' as any);
					} catch {
						// 'text' also failed - give up on highlighting
						if (!cancelled) highlighted = null;
						return;
					}
				}

				if (cancelled) return;

				// Determine which language Shiki can actually use
				let lang = currentLanguage;
				try {
					highlighter.codeToHtml('', { lang: currentLanguage, theme: 'github-dark' });
				} catch {
					lang = 'text';
				}

				// Shiki internally HTML-escapes all entities before wrapping in spans.
				// No pre-escaping needed — passing raw code is correct and avoids double-escaping.
				const html = highlighter.codeToHtml(currentCode, {
					lang,
					theme: 'github-dark'
				});

				if (!cancelled) {
					highlighted = html;
				}
			} catch {
				// Total failure - stay in fallback mode
				if (!cancelled) highlighted = null;
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	function copyCode() {
		navigator.clipboard.writeText(code);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}
</script>

<div class="code-block">
	<div class="code-header">
		<span class="code-language">{language}</span>
		<button class="copy-btn" onclick={copyCode}>
			{copied ? 'Copied!' : 'Copy'}
		</button>
	</div>
	<div class="code-body">
		{#if highlighted}
			{@html highlighted}
		{:else}
			<pre><code>{code}</code></pre>
		{/if}
	</div>
</div>

<style>
	.code-block {
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		overflow: hidden;
		margin: 4px 0;
	}

	.code-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: rgba(255, 255, 255, 0.05);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.code-language {
		font-size: 0.75em;
		font-weight: 600;
		color: rgba(235, 235, 245, 0.5);
		text-transform: lowercase;
		font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
	}

	.copy-btn {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		color: rgba(235, 235, 245, 0.6);
		font-size: 0.75em;
		padding: 2px 10px;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.copy-btn:hover {
		background: rgba(255, 255, 255, 0.14);
		color: rgba(235, 235, 245, 0.9);
	}

	.code-body {
		padding: 12px 16px;
		overflow-x: auto;
		font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.85em;
		line-height: 1.5;
	}

	/* Reset Shiki's default pre/code styles */
	.code-body :global(pre) {
		margin: 0;
		padding: 0;
		background: transparent !important;
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
	}

	.code-body :global(code) {
		margin: 0;
		padding: 0;
		background: transparent;
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
	}

	/* Fallback pre/code styling (before Shiki loads) */
	.code-body > pre {
		margin: 0;
		padding: 0;
		background: transparent;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.code-body > pre > code {
		color: rgba(235, 235, 245, 0.7);
	}
</style>
