<script lang="ts">
	interface Props {
		url: string | null;
		speaking: boolean;
		size: number;
		username: string;
	}

	let { url, speaking, size, username }: Props = $props();

	let staticFrameUrl: string | null = $state(null);

	let isGif = $derived(url != null && url.toLowerCase().endsWith('.gif'));

	let initials = $derived.by(() => {
		if (!username) return '?';
		const parts = username.trim().split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		}
		return username.slice(0, 2).toUpperCase();
	});

	let gradientBackground = $derived.by(() => {
		let hash = 0;
		for (let i = 0; i < username.length; i++) {
			hash = username.charCodeAt(i) + ((hash << 5) - hash);
		}
		const h1 = Math.abs(hash) % 360;
		const h2 = (h1 + 40) % 360;
		return `linear-gradient(135deg, hsl(${h1}, 70%, 50%), hsl(${h2}, 70%, 40%))`;
	});

	$effect(() => {
		if (!isGif || !url) {
			staticFrameUrl = null;
			return;
		}

		const currentUrl = url;
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.src = currentUrl;
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.drawImage(img, 0, 0, size, size);
				staticFrameUrl = canvas.toDataURL('image/png');
			}
		};
	});
</script>

<div
	class="avatar"
	class:speaking
	style:width="{size}px"
	style:height="{size}px"
>
	{#if url}
		{#if isGif}
			{#if speaking}
				<img src={url} alt="{username}'s avatar" width={size} height={size} />
			{:else if staticFrameUrl}
				<img src={staticFrameUrl} alt="{username}'s avatar" width={size} height={size} />
			{:else}
				<div class="fallback" style:background={gradientBackground}>
					<span class="initials" style:font-size="{size * 0.4}px">{initials}</span>
				</div>
			{/if}
		{:else}
			<img src={url} alt="{username}'s avatar" width={size} height={size} />
		{/if}
	{:else}
		<div class="fallback" style:background={gradientBackground}>
			<span class="initials" style:font-size="{size * 0.4}px">{initials}</span>
		</div>
	{/if}
</div>

<style>
	.avatar {
		position: relative;
		border-radius: 50%;
		overflow: visible;
		flex-shrink: 0;
		outline: 2.5px solid transparent;
		outline-offset: 1px;
		transition: outline-color 0.15s ease;
	}

	.avatar.speaking {
		outline-color: #30D158;
	}

	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		border-radius: 50%;
		clip-path: circle(50%);
	}

	.fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		clip-path: circle(50%);
	}

	.initials {
		color: #ffffff;
		font-weight: 600;
		line-height: 1;
		user-select: none;
	}
</style>
