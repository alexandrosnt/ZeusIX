<script lang="ts">
	import type { Snippet } from 'svelte';
	import Titlebar from '$lib/components/Titlebar.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="auth-frame">
	<Titlebar />
	<div class="auth-content">
		{@render children()}
	</div>
</div>

<style>
	.auth-frame {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background-color: #000000;
		background-image:
			radial-gradient(at 0% 0%, hsla(253, 16%, 7%, 1) 0, transparent 50%),
			radial-gradient(at 50% 0%, hsla(225, 39%, 30%, 1) 0, transparent 50%),
			radial-gradient(at 100% 0%, hsla(339, 49%, 30%, 1) 0, transparent 50%);
	}

	.auth-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
	}
</style>
