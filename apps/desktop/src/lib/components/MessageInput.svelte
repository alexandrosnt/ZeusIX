<script lang="ts">
	import { PlusCircle, Gift, Smile } from 'lucide-svelte';
	import { channelsStore } from '$lib/stores/channels.svelte';
	import { gateway } from '$lib/services/gateway';
	import { sendMessage as apiSendMessage } from '$lib/services/api';
	import { messagesStore } from '$lib/stores/messages.svelte';
	import { membersStore } from '$lib/stores/members.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import MentionDropdown from './MentionDropdown.svelte';

	let message = $state('');
	let lastTypingTime = $state(0);
	let sending = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();

	// Mention dropdown state
	let showMention = $state(false);
	let mentionQuery = $state('');
	let mentionStart = $state(0); // cursor index of the '@'
	let mentionX = $state(0);
	let mentionY = $state(0);
	let mentionKeyHandler: ((e: KeyboardEvent) => boolean) | null = $state(null);

	let placeholder = $derived(
		`Message #${channelsStore.activeChannel?.name ?? 'general'}`
	);

	let mentionMembers = $derived(
		membersStore.members.map((m) => ({
			user_id: m.user_id,
			username: m.user?.username ?? 'Unknown',
			nickname: m.nickname,
			avatar_url: m.user?.avatar_url ?? null,
			roleColor: membersStore.getTopRoleColor(m.user_id)
		}))
	);

	function handleKeydown(event: KeyboardEvent) {
		// Let the mention dropdown consume keys first
		if (showMention && mentionKeyHandler) {
			if (mentionKeyHandler(event)) return;
		}

		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			doSend();
		}
	}

	function handleInput() {
		// Typing indicator (suppressed when hideTypingIndicator is on)
		if (!settingsStore.hideTypingIndicator) {
			const now = Date.now();
			if (now - lastTypingTime > 3000) {
				lastTypingTime = now;
				const channelId = channelsStore.activeChannelId;
				if (channelId) {
					gateway.sendTyping(channelId);
				}
			}
		}

		// Mention detection
		checkForMention();
	}

	function checkForMention() {
		if (!inputEl) return;

		const cursorPos = inputEl.selectionStart ?? 0;
		const text = message;

		// Walk backwards from cursor to find an unescaped '@'
		let atIdx = -1;
		for (let i = cursorPos - 1; i >= 0; i--) {
			const ch = text[i];
			// Stop at whitespace before we find '@' — no multi-word search
			if (ch === ' ' || ch === '\n') break;
			if (ch === '@') {
				// Valid trigger: start of string or preceded by space
				if (i === 0 || text[i - 1] === ' ') {
					atIdx = i;
				}
				break;
			}
		}

		if (atIdx >= 0) {
			const query = text.slice(atIdx + 1, cursorPos);
			mentionQuery = query;
			mentionStart = atIdx;
			positionDropdown();
			showMention = true;
		} else {
			showMention = false;
		}
	}

	function positionDropdown() {
		if (!inputEl) return;
		const rect = inputEl.getBoundingClientRect();
		// Position dropdown above the input, left-aligned
		mentionX = rect.left;
		mentionY = window.innerHeight - rect.top + 4;
	}

	function handleMentionSelect(member: { user_id: string; username: string }) {
		// Replace @query with @username + trailing space
		const before = message.slice(0, mentionStart);
		const cursorPos = inputEl?.selectionStart ?? mentionStart;
		const after = message.slice(cursorPos);
		message = `${before}@${member.username} ${after}`;
		showMention = false;

		// Restore focus and set cursor after the inserted mention
		const newCursorPos = before.length + 1 + member.username.length + 1;
		requestAnimationFrame(() => {
			inputEl?.focus();
			inputEl?.setSelectionRange(newCursorPos, newCursorPos);
		});
	}

	function handleMentionClose() {
		showMention = false;
	}

	async function doSend() {
		const trimmed = message.trim();
		if (!trimmed || sending) return;

		const channelId = channelsStore.activeChannelId;
		if (!channelId) return;

		sending = true;
		message = '';
		showMention = false;
		lastTypingTime = 0;

		try {
			const msg = await apiSendMessage(channelId, trimmed);
			messagesStore.addMessage(channelId, msg);
		} catch (err) {
			console.error('[MessageInput] Failed to send:', err);
			message = trimmed;
		} finally {
			sending = false;
			inputEl?.focus();
		}
	}
</script>

<div class="input-wrapper">
	{#if showMention}
		<MentionDropdown
			query={mentionQuery}
			members={mentionMembers}
			x={mentionX}
			y={mentionY}
			onselect={handleMentionSelect}
			onclose={handleMentionClose}
			onkeyhandler={(handler) => (mentionKeyHandler = handler)}
		/>
	{/if}

	<div class="input-bar">
		<button class="input-icon" aria-label="Attach files">
			<PlusCircle size={20} />
		</button>

		<input
			class="input-field"
			type="text"
			{placeholder}
			bind:value={message}
			bind:this={inputEl}
			onkeydown={handleKeydown}
			oninput={handleInput}
		/>

		<button class="input-icon" aria-label="Send gift">
			<Gift size={20} />
		</button>

		<button class="input-icon" aria-label="Emoji picker">
			<Smile size={20} />
		</button>
	</div>
</div>

<style>
	.input-wrapper {
		padding: 0 16px 24px 16px;
		position: relative;
	}

	.input-bar {
		background: var(--bg-glass-light, rgba(44, 44, 46, 0.4));
		border-radius: 12px;
		padding: 0 16px;
		display: flex;
		align-items: center;
		min-height: 44px;
		transition: box-shadow 0.2s;
		border: 1px solid transparent;
	}

	.input-bar:focus-within {
		background: var(--bg-glass-heavy, rgba(28, 28, 30, 0.65));
		border-color: rgba(255, 255, 255, 0.2);
		box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.2);
	}

	.input-field {
		flex: 1;
		background: transparent;
		border: none;
		color: white;
		padding: 12px 0;
		margin: 0 12px;
		font-size: 15px;
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'SF Pro Text',
			'Segoe UI',
			Roboto,
			Helvetica,
			sans-serif;
	}
	.input-field::placeholder {
		color: rgba(235, 235, 245, 0.3);
	}
	.input-field:focus {
		outline: none;
	}

	.input-icon {
		color: rgba(235, 235, 245, 0.3);
		cursor: pointer;
		transition: color 0.2s;
		background: none;
		border: none;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.input-icon:hover {
		color: rgba(235, 235, 245, 0.6);
	}
</style>
