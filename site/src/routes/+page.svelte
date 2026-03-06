<script lang="ts">
	import { onMount } from 'svelte';
	import { detectLocale, t, SUPPORTED_LOCALES, LOCALE_NAMES, type Locale } from '$lib/i18n';

	let locale: Locale = $state('en');
	let showLangMenu = $state(false);
	let i = $derived(t(locale));

	let releases: Array<{
		tag_name: string;
		name: string;
		body: string;
		published_at: string;
		html_url: string;
		assets: Array<{ name: string; browser_download_url: string; size: number }>;
	}> = $state([]);

	let loadingReleases = $state(true);
	let userPlatform: 'windows' | 'macos' | 'linux' | 'unknown' = $state('unknown');

	const REPO = 'alexandrosnt/ZeusIX';
	const GITHUB_URL = `https://github.com/${REPO}`;

	function detectPlatform(): typeof userPlatform {
		if (typeof navigator === 'undefined') return 'unknown';
		const ua = navigator.userAgent.toLowerCase();
		const platform = ((navigator as any).userAgentData?.platform || navigator.platform || '').toLowerCase();
		if (platform.includes('win') || ua.includes('windows')) return 'windows';
		if (platform.includes('mac') || ua.includes('macintosh') || ua.includes('mac os')) return 'macos';
		if (platform.includes('linux') || ua.includes('linux')) return 'linux';
		return 'unknown';
	}

	onMount(async () => {
		locale = detectLocale();
		userPlatform = detectPlatform();
		try {
			const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=5`);
			if (res.ok) {
				releases = await res.json();
			}
		} catch {
			// Silently fail — releases section will show fallback
		} finally {
			loadingReleases = false;
		}
	});

	type Asset = { name: string; browser_download_url: string; size: number };

	function getWindowsAsset(assets: Asset[]) {
		return assets.find(a => a.name.endsWith('.msi')) ||
			assets.find(a => a.name.endsWith('.exe')) ||
			assets.find(a => a.name.endsWith('.nsis.zip'));
	}
	function getMacAsset(assets: Asset[]) {
		return assets.find(a => a.name.endsWith('.dmg')) ||
			assets.find(a => a.name.includes('darwin') && a.name.endsWith('.tar.gz'));
	}
	function getLinuxAsset(assets: Asset[]) {
		return assets.find(a => a.name.endsWith('.AppImage')) ||
			assets.find(a => a.name.endsWith('.deb'));
	}

	function getPlatformAsset(assets: Asset[]): Asset | undefined {
		if (userPlatform === 'windows') return getWindowsAsset(assets);
		if (userPlatform === 'macos') return getMacAsset(assets);
		if (userPlatform === 'linux') return getLinuxAsset(assets);
		return getWindowsAsset(assets);
	}

	const LOCALE_MAP: Record<Locale, string> = {
		en: 'en-US', el: 'el-GR', es: 'es-ES', de: 'de-DE',
		fr: 'fr-FR', ja: 'ja-JP', zh: 'zh-CN', pt: 'pt-BR', ru: 'ru-RU'
	};

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString(LOCALE_MAP[locale] || 'en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatSize(bytes: number): string {
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(1)} MB`;
	}

	let platformLabel = $derived(
		userPlatform === 'macos' ? 'macOS' :
		userPlatform === 'linux' ? 'Linux' :
		'Windows'
	);

	let latestDownloadUrl = $derived.by(() => {
		if (releases.length > 0) {
			const asset = getPlatformAsset(releases[0].assets);
			if (asset) return asset.browser_download_url;
		}
		return `${GITHUB_URL}/releases/latest`;
	});

	let latestDownloadSize = $derived.by(() => {
		if (releases.length > 0) {
			const asset = getPlatformAsset(releases[0].assets);
			if (asset) return formatSize(asset.size);
		}
		return null;
	});

	let features = $derived([
		{ icon: 'shield', title: i.feat_encrypted_title, desc: i.feat_encrypted_desc },
		{ icon: 'eye-off', title: i.feat_notrack_title, desc: i.feat_notrack_desc },
		{ icon: 'mic', title: i.feat_voice_title, desc: i.feat_voice_desc },
		{ icon: 'users', title: i.feat_servers_title, desc: i.feat_servers_desc },
		{ icon: 'zap', title: i.feat_fast_title, desc: i.feat_fast_desc },
		{ icon: 'code', title: i.feat_oss_title, desc: i.feat_oss_desc }
	]);
</script>

<svelte:window onclick={() => showLangMenu = false} />

<!-- Background Glow -->
<div class="glow"></div>

<!-- Floating Glass Nav -->
<nav>
	<a href="#top" class="logo">
		<img src="/logo.png" alt="ZeusIX" class="logo-icon" />
		<span>ZeusIX</span>
	</a>
	<div class="nav-links">
		<a href="#features">{i.nav_features}</a>
		<a href="#download">{i.nav_download}</a>
		<div class="lang-switcher">
			<button class="lang-btn" onclick={(e: MouseEvent) => { e.stopPropagation(); showLangMenu = !showLangMenu; }}>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
				<span class="lang-label">{LOCALE_NAMES[locale]}</span>
			</button>
			{#if showLangMenu}
				<div class="lang-menu" role="menu">
					{#each SUPPORTED_LOCALES as loc}
						<button
							class="lang-option"
							class:active={loc === locale}
							role="menuitem"
							onclick={() => { locale = loc; showLangMenu = false; }}
						>{LOCALE_NAMES[loc]}</button>
					{/each}
				</div>
			{/if}
		</div>
		<a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" class="nav-github" aria-label="GitHub">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
		</a>
	</div>
</nav>

<!-- Hero -->
<header id="top">
	<div class="hero-badge">{i.hero_badge}</div>
	<h1>{i.hero_title_1}<br />{i.hero_title_2}</h1>
	<p class="subtitle">{i.hero_sub}</p>
	<div class="hero-actions">
		<a href={latestDownloadUrl} class="btn-download">
			{i.hero_download} {platformLabel}
			{#if latestDownloadSize}<span class="btn-size"> ({latestDownloadSize})</span>{/if}
		</a>
		<a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" class="btn-ghost">
			{i.hero_github}
		</a>
	</div>
	<p class="hero-platforms">
		{#if userPlatform !== 'unknown'}
			{i.hero_also}
			{#if userPlatform === 'windows'}<a href="#download">macOS</a> {i.hero_and} <a href="#download">Linux</a>{/if}
			{#if userPlatform === 'macos'}<a href="#download">Windows</a> {i.hero_and} <a href="#download">Linux</a>{/if}
			{#if userPlatform === 'linux'}<a href="#download">Windows</a> {i.hero_and} <a href="#download">macOS</a>{/if}
		{:else}
			{i.hero_also} Windows, macOS {i.hero_and} Linux
		{/if}
	</p>
</header>

<!-- Features -->
<section class="features" id="features">
	<h2 class="section-title">{i.features_heading}</h2>
	<p class="section-sub">{i.features_sub}</p>
	<div class="features-grid">
		{#each features as feature}
			<div class="glass-card feature-card">
				<div class="feature-icon">
					{#if feature.icon === 'shield'}
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
					{:else if feature.icon === 'eye-off'}
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
					{:else if feature.icon === 'mic'}
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
					{:else if feature.icon === 'users'}
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
					{:else if feature.icon === 'zap'}
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
					{:else if feature.icon === 'code'}
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
					{/if}
				</div>
				<h3>{feature.title}</h3>
				<p>{feature.desc}</p>
			</div>
		{/each}
	</div>
</section>

<!-- Tech Stack -->
<section class="tech-strip">
	<span class="tech-label">{i.tech_powered}</span>
	<div class="tech-items">
		<span>Rust</span>
		<span class="dot"></span>
		<span>Tauri 2</span>
		<span class="dot"></span>
		<span>SvelteKit</span>
		<span class="dot"></span>
		<span>Axum</span>
		<span class="dot"></span>
		<span>LiveKit</span>
		<span class="dot"></span>
		<span>PostgreSQL</span>
	</div>
</section>

<!-- Downloads / Releases -->
<section class="releases" id="download">
	<h2 class="section-title">{i.download_heading}</h2>
	<p class="section-sub">{i.download_sub}</p>

	{#if loadingReleases}
		<div class="releases-loading">{i.download_loading}</div>
	{:else if releases.length > 0}
		<div class="releases-list">
			{#each releases as release, idx}
				{@const isLatest = idx === 0}
				{@const win = getWindowsAsset(release.assets)}
				{@const mac = getMacAsset(release.assets)}
				{@const linux = getLinuxAsset(release.assets)}
				<div class="glass-card release-card" class:latest={isLatest}>
					<div class="release-header">
						<div>
							<div class="release-tag">
								<span class="version-badge">{release.tag_name}{#if isLatest} — {i.download_latest}{/if}</span>
							</div>
							<h3 class="release-name">{release.name || release.tag_name}</h3>
							<span class="release-date">{formatDate(release.published_at)}</span>
						</div>
						<a href={release.html_url} target="_blank" rel="noopener noreferrer" class="release-notes-link">
							{i.download_notes} &rarr;
						</a>
					</div>
					<div class="release-assets">
						{#if win}
							<a href={win.browser_download_url} class="asset-pill">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
								Windows
								<span class="asset-size">{formatSize(win.size)}</span>
							</a>
						{/if}
						{#if mac}
							<a href={mac.browser_download_url} class="asset-pill">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
								macOS
								<span class="asset-size">{formatSize(mac.size)}</span>
							</a>
						{/if}
						{#if linux}
							<a href={linux.browser_download_url} class="asset-pill">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a11.966 11.966 0 0 0-2.517 2.453c-1.236 1.567-1.86 3.127-1.55 4.297.266 1.005.976 1.659 1.964 1.937 1.14.322 2.635.099 4.267-.629 1.588-.709 3.259-1.824 4.636-3.292 1.324 1.346 2.947 2.378 4.49 3.049 1.593.694 3.07.882 4.179.543.97-.297 1.654-.946 1.902-1.943.293-1.178-.329-2.735-1.566-4.297a11.967 11.967 0 0 0-2.517-2.453c.123-.805-.009-1.657-.287-2.489-.589-1.77-1.831-3.47-2.716-4.521-.75-1.067-.974-1.928-1.05-3.02-.065-1.491 1.056-5.965-3.17-6.298-.165-.013-.325-.021-.48-.021z"/></svg>
								Linux
								<span class="asset-size">{formatSize(linux.size)}</span>
							</a>
						{/if}
						{#if !win && !mac && !linux}
							<a href={release.html_url} target="_blank" rel="noopener noreferrer" class="asset-pill">
								View all assets
							</a>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="releases-empty">
			<p>{i.download_empty}</p>
			<a href="{GITHUB_URL}/releases" target="_blank" rel="noopener noreferrer" class="btn-ghost">{i.download_check}</a>
		</div>
	{/if}
</section>

<!-- Footer -->
<footer>
	<div class="footer-inner">
		<div class="footer-brand">
			<img src="/logo.png" alt="ZeusIX" class="logo-icon small" />
			<span>ZeusIX</span>
		</div>
		<div class="footer-links">
			<a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
			<a href="{GITHUB_URL}/releases" target="_blank" rel="noopener noreferrer">Releases</a>
			<a href="{GITHUB_URL}/issues" target="_blank" rel="noopener noreferrer">Issues</a>
			<a href="{GITHUB_URL}/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT License</a>
		</div>
		<p class="footer-copy">{i.footer_copy}</p>
	</div>
</footer>

<style>
	/* ===== Background Glow ===== */
	.glow {
		position: fixed;
		inset: 0;
		background: radial-gradient(circle at 50% 30%, rgba(94, 92, 230, 0.15) 0%, rgba(5, 5, 5, 0) 70%);
		pointer-events: none;
		z-index: -1;
	}

	/* ===== Floating Glass Pill Nav ===== */
	nav {
		position: fixed;
		top: 2rem;
		left: 50%;
		transform: translateX(-50%);
		width: 90%;
		max-width: 1000px;
		padding: 0.85rem 2rem;
		background: rgba(255, 255, 255, 0.05);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 50px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		z-index: 100;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 800;
		font-size: 1.2rem;
		letter-spacing: -0.5px;
		color: var(--text);
	}

	.logo-icon {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		object-fit: contain;
	}

	.logo-icon.small {
		width: 28px;
		height: 28px;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 24px;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.nav-links a {
		transition: color 0.2s;
	}

	.nav-links a:hover {
		color: var(--text);
	}

	.nav-github {
		display: flex;
		opacity: 0.5;
		transition: opacity 0.2s;
	}

	.nav-github:hover {
		opacity: 1;
	}

	/* ===== Language Switcher ===== */
	.lang-switcher {
		position: relative;
	}

	.lang-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 13px;
		font-weight: 500;
		padding: 4px 8px;
		border-radius: 20px;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
	}

	.lang-btn:hover {
		color: var(--text);
		background: rgba(255, 255, 255, 0.06);
	}

	.lang-menu {
		position: absolute;
		top: calc(100% + 12px);
		right: -20px;
		background: rgba(20, 20, 20, 0.95);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		padding: 6px;
		min-width: 160px;
		z-index: 200;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
	}

	.lang-option {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		color: var(--text-secondary);
		font-size: 13px;
		font-weight: 500;
		padding: 9px 14px;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}

	.lang-option:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--text);
	}

	.lang-option.active {
		color: var(--accent);
		background: rgba(94, 92, 230, 0.1);
	}

	/* ===== Hero ===== */
	header {
		text-align: center;
		padding: 12rem 1.5rem 6rem;
		max-width: 800px;
		margin: 0 auto;
	}

	.hero-badge {
		display: inline-block;
		padding: 0.3rem 1rem;
		border-radius: 20px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--accent);
		background: rgba(94, 92, 230, 0.08);
		border: 1px solid rgba(94, 92, 230, 0.15);
		margin-bottom: 2.5rem;
	}

	h1 {
		font-size: clamp(3rem, 6vw, 5rem);
		font-weight: 800;
		letter-spacing: -2px;
		line-height: 1.1;
		margin-bottom: 1.25rem;
		background: linear-gradient(180deg, #fff 0%, #a1a1a6 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subtitle {
		font-size: 1.25rem;
		color: var(--text-secondary);
		max-width: 600px;
		margin: 0 auto 3rem;
		line-height: 1.6;
	}

	.hero-actions {
		display: flex;
		gap: 16px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.hero-platforms {
		margin-top: 1.25rem;
		font-size: 0.9rem;
		color: var(--text-tertiary);
	}

	.hero-platforms a {
		color: var(--text-secondary);
		text-decoration: underline;
		text-underline-offset: 3px;
		transition: color 0.2s;
	}

	.hero-platforms a:hover {
		color: var(--accent);
	}

	/* ===== Buttons ===== */
	.btn-download {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: var(--accent);
		color: white;
		padding: 1rem 2.5rem;
		font-size: 1.1rem;
		font-weight: 600;
		border: none;
		border-radius: 30px;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 0 20px rgba(94, 92, 230, 0.4);
		text-decoration: none;
		font-family: inherit;
	}

	.btn-download:hover {
		transform: translateY(-2px);
		box-shadow: 0 0 40px rgba(94, 92, 230, 0.6);
		background: #6f6df0;
	}

	.btn-size {
		font-weight: 400;
		opacity: 0.75;
		font-size: 0.9rem;
	}

	.btn-ghost {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 1rem 2rem;
		font-size: 1.05rem;
		font-weight: 600;
		border-radius: 30px;
		transition: all 0.3s ease;
		cursor: pointer;
		text-decoration: none;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.04);
		color: var(--text);
		font-family: inherit;
	}

	.btn-ghost:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.2);
		transform: translateY(-2px);
	}

	/* ===== Glass Card (shared) ===== */
	.glass-card {
		background: rgba(255, 255, 255, 0.05);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 24px;
		padding: 2rem;
		transition: transform 0.3s ease, border-color 0.3s ease;
	}

	.glass-card:hover {
		transform: scale(1.02);
		border-color: rgba(255, 255, 255, 0.18);
	}

	/* ===== Section Titles ===== */
	.section-title {
		text-align: center;
		font-size: clamp(2rem, 4vw, 2.8rem);
		font-weight: 800;
		letter-spacing: -1.5px;
		margin-bottom: 0.75rem;
		background: linear-gradient(180deg, #fff 0%, #a1a1a6 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.section-sub {
		text-align: center;
		font-size: 1.1rem;
		color: var(--text-secondary);
		max-width: 520px;
		margin: 0 auto 3.5rem;
		line-height: 1.6;
	}

	/* ===== Features ===== */
	.features {
		padding: 6rem 1.5rem;
		max-width: 1100px;
		margin: 0 auto;
		width: 100%;
	}

	.features-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
	}

	.feature-card {
		padding: 2rem;
	}

	.feature-icon {
		width: 48px;
		height: 48px;
		border-radius: 14px;
		background: rgba(94, 92, 230, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent);
		margin-bottom: 1.25rem;
	}

	.feature-card h3 {
		font-size: 1.1rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
		letter-spacing: -0.3px;
	}

	.feature-card p {
		font-size: 0.9rem;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	/* ===== Tech Strip ===== */
	.tech-strip {
		padding: 2.5rem 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 20px;
		flex-wrap: wrap;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		max-width: 1000px;
		margin: 0 auto;
	}

	.tech-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		color: var(--text-tertiary);
	}

	.tech-items {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
		justify-content: center;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.dot {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--text-tertiary);
	}

	/* ===== Releases ===== */
	.releases {
		padding: 6rem 1.5rem;
		max-width: 800px;
		margin: 0 auto;
		width: 100%;
	}

	.releases-loading, .releases-empty {
		text-align: center;
		color: var(--text-tertiary);
		padding: 3rem 0;
	}

	.releases-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.release-card.latest {
		border-color: rgba(94, 92, 230, 0.25);
	}

	.release-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.25rem;
	}

	.release-tag {
		margin-bottom: 0.5rem;
	}

	.version-badge {
		display: inline-block;
		background: rgba(255, 255, 255, 0.1);
		padding: 0.25rem 0.75rem;
		border-radius: 20px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--accent);
	}

	.release-name {
		font-size: 1.3rem;
		font-weight: 700;
		margin-bottom: 0.25rem;
		letter-spacing: -0.3px;
	}

	.release-date {
		font-size: 0.8rem;
		color: var(--text-tertiary);
	}

	.release-notes-link {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-tertiary);
		transition: color 0.2s;
		white-space: nowrap;
	}

	.release-notes-link:hover {
		color: var(--accent);
	}

	.release-assets {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.asset-pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0.65rem 1.25rem;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 30px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text);
		transition: all 0.25s ease;
		text-decoration: none;
	}

	.asset-pill:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.18);
		transform: translateY(-1px);
	}

	.asset-size {
		font-weight: 400;
		color: var(--text-tertiary);
		font-size: 0.8rem;
	}

	/* ===== Footer ===== */
	footer {
		padding: 4rem 1.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		margin-top: 2rem;
		width: 100%;
	}

	.footer-inner {
		max-width: 1000px;
		margin: 0 auto;
		text-align: center;
	}

	.footer-brand {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-bottom: 1.25rem;
		font-weight: 800;
		font-size: 1.1rem;
	}

	.footer-links {
		display: flex;
		gap: 24px;
		justify-content: center;
		margin-bottom: 1.25rem;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.footer-links a:hover {
		color: var(--text);
	}

	.footer-copy {
		font-size: 0.85rem;
		color: var(--text-tertiary);
	}

	/* ===== Responsive ===== */
	@media (max-width: 768px) {
		nav {
			top: 1rem;
			width: 94%;
			padding: 0.75rem 1.25rem;
		}

		.lang-label {
			display: none;
		}

		.nav-links a:not(.nav-github) {
			display: none;
		}

		.features-grid {
			grid-template-columns: 1fr;
		}

		header {
			padding: 10rem 1.25rem 5rem;
		}

		.release-header {
			flex-direction: column;
			gap: 8px;
		}

		.release-assets {
			flex-direction: column;
		}

		.asset-pill {
			justify-content: center;
		}
	}

	@media (max-width: 480px) {
		.hero-actions {
			flex-direction: column;
			align-items: stretch;
		}

		.btn-download, .btn-ghost {
			justify-content: center;
			text-align: center;
		}
	}
</style>
