<script lang="ts">
	import { Hash, Crown, Phone, PhoneOff } from 'lucide-svelte';
	import { messagesStore } from '$lib/stores/messages.svelte';
	import { channelsStore } from '$lib/stores/channels.svelte';
	import { membersStore } from '$lib/stores/members.svelte';
	import { presenceStore } from '$lib/stores/presence.svelte';
	import { serversStore } from '$lib/stores/servers.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import type { Message, ServerMember } from '$lib/types';
	import { parseMarkdown, type Segment } from '$lib/utils/markdown';
	import CodeBlock from '$lib/components/CodeBlock.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import { deleteMessage, deleteDmMessage, purgeMessages } from '$lib/services/api';

	interface Props {
		dmChannelId?: string;
	}

	let { dmChannelId }: Props = $props();

	let wrapper: HTMLDivElement | undefined = $state();

	// Context menu state
	let ctxMenu = $state<{ x: number; y: number; messageId: string; channelId: string } | null>(null);

	function handleMessageContext(e: MouseEvent, messageId: string, channelId: string) {
		e.preventDefault();
		ctxMenu = { x: e.clientX, y: e.clientY, messageId, channelId };
	}

	async function handleDeleteMsg(channelId: string, messageId: string) {
		try {
			if (dmChannelId) {
				await deleteDmMessage(dmChannelId, messageId);
			} else {
				await deleteMessage(channelId, messageId);
			}
			messagesStore.deleteMessage(channelId, messageId);
		} catch (err) {
			console.error('[MessageList] Failed to delete message:', err);
		}
	}

	async function handlePurgeChat() {
		if (!dmChannelId) return;
		try {
			await purgeMessages(dmChannelId);
			messagesStore.clearChannel(dmChannelId);
		} catch (err) {
			console.error('[MessageList] Failed to purge messages:', err);
		}
	}

	let messages = $derived(messagesStore.currentMessages);
	let activeChannel = $derived(channelsStore.activeChannel);
	let channelName = $derived(activeChannel?.name ?? 'general');
	let ownerId = $derived(serversStore.activeServer?.owner_id ?? null);

	// Profile card state
	let selectedUserId: string | null = $state(null);
	let selectedMemberRaw = $derived(selectedUserId ? membersStore.getMember(selectedUserId) ?? null : null);
	// Use authStore.user for current user's profile (always up-to-date after edits)
	let selectedMember = $derived.by(() => {
		if (!selectedMemberRaw) return null;
		const currentUser = authStore.user;
		if (currentUser && selectedMemberRaw.user_id === currentUser.id) {
			return { ...selectedMemberRaw, user: currentUser };
		}
		return selectedMemberRaw;
	});
	let cardX = $state(0);
	let cardY = $state(0);
	let cardEl: HTMLDivElement | undefined = $state(undefined);

	const statusColors: Record<string, string> = {
		online: '#30D158',
		idle: '#FF9F0A',
		dnd: '#FF453A',
		offline: '#636366'
	};

	function handleAuthorClick(authorId: string, e: MouseEvent | KeyboardEvent) {
		if (selectedUserId === authorId) {
			selectedUserId = null;
			return;
		}
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		cardX = rect.left;
		cardY = Math.min(rect.bottom + 8, window.innerHeight - 380);
		selectedUserId = authorId;
	}

	function closeCard() {
		selectedUserId = null;
	}

	function handleCardClickOutside(e: MouseEvent) {
		if (cardEl && !cardEl.contains(e.target as Node)) {
			closeCard();
		}
	}

	function handleCardKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeCard();
	}

	$effect(() => {
		if (!selectedMember) return;
		document.addEventListener('mousedown', handleCardClickOutside);
		document.addEventListener('keydown', handleCardKeydown);
		return () => {
			document.removeEventListener('mousedown', handleCardClickOutside);
			document.removeEventListener('keydown', handleCardKeydown);
		};
	});

	/**
	 * Generate a deterministic color from a username string.
	 */
	function getUserColor(username: string): string {
		const colors = [
			'#F47067', '#E0AF68', '#73DACA', '#7AA2F7',
			'#BB9AF7', '#FF9E64', '#2AC3DE', '#9ECE6A',
			'#E06C75', '#C678DD', '#56B6C2', '#D19A66'
		];
		let hash = 0;
		for (let i = 0; i < username.length; i++) {
			hash = username.charCodeAt(i) + ((hash << 5) - hash);
		}
		return colors[Math.abs(hash) % colors.length];
	}

	/**
	 * Extract initials from a username (first two characters, uppercased).
	 */
	function getInitials(username: string): string {
		return username.slice(0, 2).toUpperCase();
	}

	/**
	 * Format a timestamp string as "Today at HH:MM AM/PM" if the message
	 * was sent today, otherwise as "MM/DD/YYYY HH:MM AM/PM".
	 */
	function formatTimestamp(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const isToday =
			date.getFullYear() === now.getFullYear() &&
			date.getMonth() === now.getMonth() &&
			date.getDate() === now.getDate();

		const hours = date.getHours();
		const minutes = date.getMinutes().toString().padStart(2, '0');
		const ampm = hours >= 12 ? 'PM' : 'AM';
		const hour12 = hours % 12 || 12;
		const timeStr = `${hour12}:${minutes} ${ampm}`;

		if (isToday) {
			return `Today at ${timeStr}`;
		}

		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const day = date.getDate().toString().padStart(2, '0');
		const year = date.getFullYear();
		return `${month}/${day}/${year} ${timeStr}`;
	}

	/**
	 * Determine if a message author is a bot. Uses the username as a heuristic
	 * since the Message type does not have a dedicated bot field.
	 */
	function isBot(message: Message): boolean {
		const author = message.author;
		if (!author) return false;
		const name = author.username.toLowerCase();
		return name.includes('bot') || name.includes('webhook');
	}

	/**
	 * Build a Set of known usernames (lowercased) for fast mention lookups.
	 */
	let knownUsernames = $derived(
		new Set(membersStore.members.map((m) => (m.user?.username ?? '').toLowerCase()))
	);

	// Auto-scroll to the bottom when new messages arrive
	$effect(() => {
		// Read messages.length to register as a dependency
		messages.length;

		if (wrapper) {
			wrapper.scrollTop = wrapper.scrollHeight;
		}
	});
</script>

<div class="messages-wrapper" class:compact-spacing={settingsStore.compactMode} bind:this={wrapper}>
	<!-- Channel welcome section -->
	<div class="channel-welcome">
		<div class="welcome-icon">
			<Hash size={30} />
		</div>
		<h2 class="welcome-heading">Welcome to #{channelName}!</h2>
		<p class="welcome-subtitle">This is the start of the #{channelName} channel.</p>
	</div>

	<!-- Message list -->
	{#each messages as message (message.id)}
		{#if message.message_type === 'missed_call'}
			{@const sysData = (() => { try { return JSON.parse(message.content); } catch { return {}; } })()}
			<div class="system-message">
				<div class="system-message-icon missed">
					<PhoneOff size={16} />
				</div>
				<span class="system-message-text">Missed call from {sysData.caller_username ?? message.author_username ?? 'Unknown'}</span>
				<span class="system-message-time">{formatTimestamp(message.created_at)}</span>
			</div>
		{:else if message.message_type === 'call_ended'}
			{@const sysData = (() => { try { return JSON.parse(message.content); } catch { return {}; } })()}
			{@const durSecs = sysData.duration_secs ?? 0}
			{@const durMin = Math.floor(durSecs / 60)}
			{@const durSec = durSecs % 60}
			<div class="system-message">
				<div class="system-message-icon ended">
					<Phone size={16} />
				</div>
				<span class="system-message-text">Call ended — {durMin}:{durSec.toString().padStart(2, '0')}</span>
				<span class="system-message-time">{formatTimestamp(message.created_at)}</span>
			</div>
		{:else}
			{@const username = message.author?.username ?? 'Unknown'}
			{@const fallbackColor = getUserColor(username)}
			{@const roleColor = membersStore.getTopRoleColor(message.author_id)}
			{@const nameColor = roleColor ?? fallbackColor}
			{@const avatarUrl = message.author?.avatar_url}
			<div class="message" class:compact={settingsStore.compactMode} oncontextmenu={(e) => handleMessageContext(e, message.id, message.channel_id)}>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div class="msg-avatar clickable" style:background-color={fallbackColor} onclick={(e) => handleAuthorClick(message.author_id, e)} role="button" tabindex="0">
					{#if avatarUrl}
						<img src={avatarUrl} alt={username} class="msg-avatar-img" />
					{:else}
						{getInitials(username)}
					{/if}
				</div>
				<div class="msg-content">
					<div class="msg-header">
						<span class="msg-author" style:color={nameColor} onclick={(e) => handleAuthorClick(message.author_id, e)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAuthorClick(message.author_id, e); }} role="button" tabindex="0">{username}</span>
						{#if isBot(message)}
							<span class="bot-tag">BOT</span>
						{/if}
						<span class="msg-timestamp">{formatTimestamp(message.created_at)}</span>
					</div>
					<div class="msg-text" style:font-size="{settingsStore.chatFontSize}px">{#each parseMarkdown(message.content, knownUsernames) as seg, i (i)}{#if seg.type === 'code-block'}<CodeBlock code={seg.code} language={seg.language} />{:else if seg.type === 'code-inline'}<code class="inline-code">{seg.code}</code>{:else if seg.type === 'bold'}<strong>{seg.text}</strong>{:else if seg.type === 'italic'}<em>{seg.text}</em>{:else if seg.type === 'strikethrough'}<s>{seg.text}</s>{:else if seg.type === 'mention'}<span class="mention" role="button" tabindex="0" onclick={(e) => { const member = membersStore.members.find(m => m.user?.username?.toLowerCase() === seg.username?.toLowerCase()); if (member) handleAuthorClick(member.user_id, e); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { const member = membersStore.members.find(m => m.user?.username?.toLowerCase() === seg.username?.toLowerCase()); if (member) handleAuthorClick(member.user_id, e); } }}>{seg.text}</span>{:else}{seg.text}{/if}{/each}</div>
				</div>
			</div>
		{/if}
	{/each}
</div>

{#if selectedMember}
	{@const sm = selectedMember}
	{@const smUsername = sm.nickname ?? sm.user?.username ?? 'Unknown'}
	{@const smStatus = presenceStore.getStatus(sm.user_id)}
	<div class="profile-card" style:left="{cardX}px" style:top="{cardY}px" bind:this={cardEl} role="dialog" aria-label="Member profile">
		<div class="pc-cover">
			{#if sm.user?.cover_url}
				<img src={sm.user.cover_url} alt="" class="pc-cover-img" />
			{/if}
		</div>
		<div class="pc-avatar-wrapper">
			<div class="pc-avatar" style:background-color={getUserColor(smUsername)}>
				{#if sm.user?.avatar_url}
					<img src={sm.user.avatar_url} alt={smUsername} class="pc-avatar-img" />
				{:else}
					{getInitials(smUsername)}
				{/if}
			</div>
			<span class="pc-status-dot" style:background-color={statusColors[smStatus]}></span>
		</div>
		<div class="pc-body">
			<div class="pc-username">{smUsername}<span class="pc-discrim">#{sm.user?.discriminator ?? '0000'}</span></div>
			{#if sm.user?.status && sm.user.status !== 'online' && sm.user.status !== 'offline' && sm.user.status !== 'idle' && sm.user.status !== 'dnd'}
				<div class="pc-custom-status">{sm.user.status}</div>
			{/if}
			<div class="pc-divider"></div>
			<div class="pc-section-label">Member Since</div>
			<div class="pc-date">{new Date(sm.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
			{#if sm.roles && sm.roles.length > 0}
				<div class="pc-divider"></div>
				<div class="pc-section-label">Roles</div>
				<div class="pc-roles">
					{#each sm.roles as role (role.id)}
						<span class="pc-role" style:border-color={role.color ?? 'rgba(255,255,255,0.15)'}>
							{#if role.color}<span class="pc-role-dot" style:background={role.color}></span>{/if}
							{role.name}
						</span>
					{/each}
				</div>
			{/if}
			{#if sm.user_id === ownerId}
				<div class="pc-owner-badge">
					<Crown size={12} color="#FF9F0A" />
					<span>Server Owner</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if ctxMenu}
	<ContextMenu
		x={ctxMenu.x}
		y={ctxMenu.y}
		items={[
			{ label: 'Delete Message', danger: true, action: () => handleDeleteMsg(ctxMenu!.channelId, ctxMenu!.messageId) },
			...(dmChannelId ? [{ label: 'Cleanup Chat', danger: true, divider: true, action: () => handlePurgeChat() }] : [])
		]}
		onclose={() => ctxMenu = null}
	/>
{/if}

<style>
	.messages-wrapper {
		flex: 1;
		overflow-y: auto;
		padding: 20px 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.messages-wrapper.compact-spacing {
		gap: 6px;
		padding: 12px 16px;
	}

	.channel-welcome {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 16px 0 24px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		margin-bottom: 8px;
	}

	.welcome-icon {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: rgba(var(--glass-light-rgb, 44, 44, 46), 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(235, 235, 245, 0.6);
		margin-bottom: 12px;
	}

	.welcome-heading {
		font-size: 28px;
		font-weight: 700;
		color: white;
		margin: 0 0 6px;
	}

	.welcome-subtitle {
		font-size: 14px;
		color: rgba(235, 235, 245, 0.4);
		margin: 0;
	}

	.message {
		display: flex;
		gap: 16px;
		animation: fadeIn 0.3s ease-out forwards;
	}

	.message.compact {
		gap: 10px;
	}

	.message.compact .msg-avatar {
		width: 28px;
		height: 28px;
		font-size: 12px;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.msg-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--bg-glass-light, rgba(44, 44, 46, 0.4));
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 16px;
		color: white;
		overflow: hidden;
	}

	.msg-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.msg-content {
		flex: 1;
	}

	.msg-header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 2px;
	}

	.msg-avatar.clickable {
		cursor: pointer;
	}

	.msg-author {
		font-weight: 600;
		font-size: 15px;
		color: white;
		cursor: pointer;
	}

	.msg-author:hover {
		text-decoration: underline;
	}

	.msg-timestamp {
		font-size: 11px;
		color: rgba(235, 235, 245, 0.3);
	}

	.msg-text {
		font-size: 15px;
		line-height: 1.5;
		color: rgba(235, 235, 245, 0.6);
	}

	.msg-text .mention {
		color: #5e9eff;
		background: rgba(88, 101, 242, 0.15);
		padding: 0 3px;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
		transition: background 0.15s ease;
	}

	.msg-text .mention:hover {
		background: rgba(88, 101, 242, 0.3);
		text-decoration: underline;
	}

	.bot-tag {
		background: #5865f2;
		font-size: 9px;
		padding: 1px 4px;
		border-radius: 4px;
		margin-left: 6px;
		color: white;
	}

	/* ===== Profile Card ===== */
	.profile-card {
		position: fixed;
		width: 300px;
		background: rgba(var(--glass-heavy-rgb, 28, 28, 30), 0.92);
		backdrop-filter: blur(40px);
		-webkit-backdrop-filter: blur(40px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
		overflow: hidden;
		z-index: 1000;
		animation: pc-in 0.15s cubic-bezier(0.2, 0, 0, 1);
	}

	@keyframes pc-in {
		from { opacity: 0; transform: translateY(-4px) scale(0.97); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.pc-cover {
		width: 100%;
		height: 90px;
		background: linear-gradient(135deg, #2c1e4a, #1a2a40);
		overflow: hidden;
	}

	.pc-cover-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pc-avatar-wrapper {
		position: relative;
		width: 64px;
		height: 64px;
		margin-top: -32px;
		margin-left: 16px;
	}

	.pc-avatar {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		border: 4px solid rgba(var(--glass-heavy-rgb, 28, 28, 30), 0.92);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
		font-weight: 700;
		color: white;
		overflow: hidden;
	}

	.pc-avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pc-status-dot {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 14px;
		height: 14px;
		border: 3px solid rgba(var(--glass-heavy-rgb, 28, 28, 30), 0.92);
		border-radius: 50%;
	}

	.pc-body {
		padding: 8px 16px 16px;
	}

	.pc-username {
		font-size: 18px;
		font-weight: 700;
		color: #fff;
	}

	.pc-discrim {
		font-weight: 400;
		color: rgba(235, 235, 245, 0.3);
	}

	.pc-custom-status {
		font-size: 13px;
		color: rgba(235, 235, 245, 0.5);
		margin-top: 2px;
	}

	.pc-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.08);
		margin: 10px 0;
	}

	.pc-section-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: rgba(235, 235, 245, 0.4);
		letter-spacing: 0.5px;
		margin-bottom: 4px;
	}

	.pc-date {
		font-size: 13px;
		color: rgba(235, 235, 245, 0.7);
	}

	.pc-roles {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.pc-role {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 4px;
		font-size: 12px;
		color: rgba(235, 235, 245, 0.8);
	}

	.pc-role-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.pc-owner-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 10px;
		font-size: 12px;
		font-weight: 600;
		color: #FF9F0A;
	}

	.msg-text .inline-code {
		background: rgba(var(--glass-light-rgb, 44, 44, 46), 0.6);
		padding: 1px 6px;
		border-radius: 4px;
		font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.9em;
		color: rgba(235, 235, 245, 0.85);
	}

	.msg-text strong {
		color: rgba(235, 235, 245, 0.9);
		font-weight: 700;
	}

	.msg-text em {
		color: rgba(235, 235, 245, 0.7);
		font-style: italic;
	}

	.msg-text s {
		color: rgba(235, 235, 245, 0.35);
	}

	/* ===== System Messages (missed call, call ended) ===== */
	.system-message {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.03);
	}

	.system-message-icon {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.system-message-icon.missed {
		background: rgba(255, 69, 58, 0.15);
		color: #ff453a;
	}

	.system-message-icon.ended {
		background: rgba(48, 209, 88, 0.15);
		color: #30d158;
	}

	.system-message-text {
		font-size: 14px;
		font-weight: 500;
		color: rgba(235, 235, 245, 0.5);
	}

	.system-message-time {
		font-size: 11px;
		color: rgba(235, 235, 245, 0.25);
		margin-left: auto;
		white-space: nowrap;
	}
</style>
