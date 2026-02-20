<script lang="ts">
	interface MentionMember {
		user_id: string;
		username: string;
		nickname: string | null;
		avatar_url: string | null;
		roleColor: string | null;
	}

	interface Props {
		query: string;
		members: MentionMember[];
		x: number;
		y: number;
		onselect: (member: { user_id: string; username: string }) => void;
		onclose: () => void;
		onkeyhandler: (handler: (e: KeyboardEvent) => boolean) => void;
	}

	let { query, members, x, y, onselect, onclose, onkeyhandler }: Props = $props();

	let selectedIndex = $state(0);
	let dropdownEl: HTMLDivElement | undefined = $state();

	const COLORS = ['#F47067', '#E0AF68', '#73DACA', '#7AA2F7', '#BB9AF7', '#FF9E64', '#2AC3DE', '#9ECE6A'];

	function getColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}
		return COLORS[Math.abs(hash) % COLORS.length];
	}

	function getInitials(member: MentionMember): string {
		const name = member.nickname ?? member.username;
		return name.charAt(0).toUpperCase();
	}

	let filtered = $derived.by(() => {
		const q = query.toLowerCase();
		return members
			.filter((m) => {
				return (
					m.username.toLowerCase().includes(q) ||
					(m.nickname && m.nickname.toLowerCase().includes(q))
				);
			})
			.slice(0, 8);
	});

	// Reset selection index when the query changes — this is a legitimate
	// side-effect (resetting UI cursor position in response to new input).
	$effect(() => {
		query;
		selectedIndex = 0;
	});

	function confirmSelection() {
		const member = filtered[selectedIndex];
		if (member) {
			onselect({ user_id: member.user_id, username: member.username });
		}
	}

	function handleKey(e: KeyboardEvent): boolean {
		if (filtered.length === 0) {
			if (e.key === 'Escape') {
				onclose();
				return true;
			}
			return false;
		}

		switch (e.key) {
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = selectedIndex <= 0 ? filtered.length - 1 : selectedIndex - 1;
				scrollToSelected();
				return true;
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = selectedIndex >= filtered.length - 1 ? 0 : selectedIndex + 1;
				scrollToSelected();
				return true;
			case 'Enter':
			case 'Tab':
				e.preventDefault();
				confirmSelection();
				return true;
			case 'Escape':
				onclose();
				return true;
			default:
				return false;
		}
	}

	function scrollToSelected() {
		const item = dropdownEl?.querySelectorAll('.mention-item')[selectedIndex];
		if (item) {
			item.scrollIntoView({ block: 'nearest' });
		}
	}

	// Hand the handleKey function to the parent on mount
	$effect(() => {
		onkeyhandler(handleKey);
	});
</script>

<div class="mention-dropdown" bind:this={dropdownEl} style="left:{x}px;bottom:{y}px">
	{#each filtered as member, i (member.user_id)}
		<button
			class="mention-item"
			class:selected={i === selectedIndex}
			onmouseenter={() => (selectedIndex = i)}
			onclick={() => onselect({ user_id: member.user_id, username: member.username })}
		>
			<div class="mention-avatar" style:background-color={getColor(member.username)}>
				{#if member.avatar_url}
					<img src={member.avatar_url} alt="" />
				{:else}
					{getInitials(member)}
				{/if}
			</div>
			<span class="mention-name" style:color={member.roleColor ?? 'white'}
				>{member.nickname ?? member.username}</span
			>
			{#if member.nickname}
				<span class="mention-username">{member.username}</span>
			{/if}
		</button>
	{/each}
	{#if filtered.length === 0}
		<div class="mention-empty">No members found</div>
	{/if}
</div>

<style>
	.mention-dropdown {
		position: fixed;
		width: 240px;
		max-height: 320px;
		overflow-y: auto;
		background: rgba(30, 30, 30, 0.95);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		z-index: 900;
		padding: 4px;
		animation: slideUp 0.15s ease-out;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.mention-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 36px;
		padding: 6px 10px;
		border: none;
		border-radius: 6px;
		background: transparent;
		cursor: pointer;
		text-align: left;
		transition: background 0.1s ease;
	}

	.mention-item:hover,
	.mention-item.selected {
		background: rgba(255, 255, 255, 0.08);
	}

	.mention-avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 600;
		color: white;
		overflow: hidden;
	}

	.mention-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.mention-name {
		font-size: 14px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mention-username {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mention-empty {
		padding: 12px 10px;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.4);
		text-align: center;
	}
</style>
