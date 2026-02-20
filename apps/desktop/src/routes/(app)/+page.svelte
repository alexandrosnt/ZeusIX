<script lang="ts">
  import ChatArea from '$lib/components/ChatArea.svelte';
  import PurgeMessagesModal from '$lib/components/PurgeMessagesModal.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { serversStore } from '$lib/stores/servers.svelte';
  import { channelsStore } from '$lib/stores/channels.svelte';
  import { membersStore } from '$lib/stores/members.svelte';
  import { messagesStore } from '$lib/stores/messages.svelte';
  import { PERMISSIONS, hasPermission } from '$lib/utils/permissions';
  import { purgeChannelMessages } from '$lib/services/api';

  let showPurgeConfirm = $state(false);

  let myRoles = $derived.by(() => {
    const userId = authStore.user?.id;
    if (!userId) return [];
    const member = membersStore.getMember(userId);
    return member?.roles ?? [];
  });
  let isOwner = $derived(serversStore.activeServer?.owner_id === authStore.user?.id);
  let canPurge = $derived(isOwner || hasPermission(myRoles, PERMISSIONS.MANAGE_MESSAGES));

  async function handlePurgeMessages() {
    const channelId = channelsStore.activeChannelId;
    if (!channelId) return;
    await purgeChannelMessages(channelId);
    messagesStore.clearChannel(channelId);
    showPurgeConfirm = false;
  }
</script>

<ChatArea
  ontogglemembers={() => {}}
  canpurge={canPurge}
  onpurge={() => showPurgeConfirm = true}
/>

{#if showPurgeConfirm && channelsStore.activeChannel}
  <PurgeMessagesModal
    channelName={channelsStore.activeChannel.name}
    onclose={() => showPurgeConfirm = false}
    onconfirm={handlePurgeMessages}
  />
{/if}
