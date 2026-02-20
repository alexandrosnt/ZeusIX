<script lang="ts">
	import { Search } from 'lucide-svelte';

	let query = $state('');
	let servers = $state<Array<{ id: string; name: string; member_count: number; icon_url: string | null }>>([]);
	let loading = $state(false);

	async function search() {
		if (!query.trim()) return;
		loading = true;
		try {
			// TODO: Call discoverServers API
			servers = [];
		} finally {
			loading = false;
		}
	}
</script>

<div class="discover">
	<div class="discover-header">
		<h1>Find your community</h1>
		<p>From gaming, to music, to study groups, there's a place for you.</p>
		<div class="search-bar">
			<Search size={20} />
			<input
				type="text"
				placeholder="Explore communities"
				bind:value={query}
				onkeydown={(e) => e.key === 'Enter' && search()}
			/>
		</div>
	</div>

	<div class="server-grid">
		{#if loading}
			<p class="empty">Searching...</p>
		{:else if servers.length === 0}
			<p class="empty">No servers found. Try a different search.</p>
		{:else}
			{#each servers as server (server.id)}
				<div class="server-card">
					<div class="server-banner"></div>
					<div class="server-info">
						<h3>{server.name}</h3>
						<span class="member-count">{server.member_count} members</span>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.discover {
		flex: 1;
		overflow-y: auto;
		padding: 0;
	}

	.discover-header {
		padding: 40px 32px 32px;
		text-align: center;
		background: linear-gradient(135deg, rgba(var(--accent-rgb, 10, 132, 255), 0.15), rgba(191, 90, 242, 0.15));
	}

	h1 {
		font-size: 28px;
		font-weight: 700;
		margin-bottom: 8px;
	}

	.discover-header p {
		color: rgba(235, 235, 245, 0.6);
		margin-bottom: 24px;
	}

	.search-bar {
		max-width: 480px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 12px;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 8px;
		padding: 10px 16px;
		color: rgba(235, 235, 245, 0.3);
	}

	.search-bar input {
		flex: 1;
		background: transparent;
		border: none;
		color: white;
		font-size: 15px;
		font-family: inherit;
		outline: none;
	}

	.search-bar input::placeholder {
		color: rgba(235, 235, 245, 0.3);
	}

	.server-grid {
		padding: 24px 32px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 16px;
	}

	.empty {
		grid-column: 1 / -1;
		text-align: center;
		color: rgba(235, 235, 245, 0.6);
		padding: 40px 0;
	}

	.server-card {
		background: var(--bg-glass-light, rgba(44, 44, 46, 0.4));
		border-radius: 12px;
		overflow: hidden;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.server-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
	}

	.server-banner {
		height: 120px;
		background: linear-gradient(135deg, rgba(var(--accent-rgb, 10, 132, 255), 0.3), rgba(191, 90, 242, 0.3));
	}

	.server-info {
		padding: 16px;
	}

	.server-info h3 {
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 4px;
	}

	.member-count {
		font-size: 13px;
		color: rgba(235, 235, 245, 0.6);
	}
</style>
