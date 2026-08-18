'use client';

import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/UI/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { OrgChatPanel, OrgChatPanelMessage } from './OrgChatPanel';
import { OrgChatSearchDialog } from './OrgChatSearchDialog';
import { GroupFaceStack } from './GroupFaceStack';
import { CreateGroupDialog, type GroupDialogAssistantOption } from './CreateGroupDialog';
import {
  ChatMention,
  OrgChatAttachment,
  OrgChatSearchResult,
  RosterGroup,
  RosterHuman,
} from '@/types/orgChat';
import type { useOrgChat } from '@/hooks/Assistants/useOrgChat';
import { useOrgCallPills } from '@/hooks/Assistants/useOrgCallPills';
import { formatRealVirtualSubtitle } from '@/utils/orgChat/memberSubtitle';
import { toast } from 'sonner';

interface GroupWorkspaceProps {
  group: RosterGroup;
  orgId: string;
  humansById: Record<string, RosterHuman>;
  assistantsById: Record<string, GroupDialogAssistantOption>;
  allHumans: RosterHuman[];
  allAssistants: GroupDialogAssistantOption[];
  currentUserId: string | null;
  chat: ReturnType<typeof useOrgChat>;
  onStartCall?: () => void;
  onJoinCall?: () => void;
  isCallButtonDisabled?: boolean;
  callButtonTooltip?: string;
  isConnectingCall?: boolean;
  canJoinActiveCall?: boolean;
  /** True while this group's call is connected — drives pill refetch. */
  isCallActive?: boolean;
  onGroupUpdated?: (group: RosterGroup) => void;
  onLeftOrDeleted?: () => void;
  onRefreshRoster?: () => void;
}

/**
 * Chat workspace for an org chat group: face-stack header, @mentions over
 * members, call button, and overflow actions (manage / leave / delete).
 */
export function GroupWorkspace({
  group,
  orgId,
  humansById,
  assistantsById,
  allHumans,
  allAssistants,
  currentUserId,
  chat,
  onStartCall,
  onJoinCall,
  isCallButtonDisabled,
  callButtonTooltip,
  isConnectingCall,
  canJoinActiveCall,
  isCallActive = false,
  onGroupUpdated,
  onLeftOrDeleted,
  onRefreshRoster,
}: GroupWorkspaceProps) {
  const { loadGroupHistory, sendGroupMessage, groupMessages, toggleGroupReaction } = chat;
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [highlightMessageId, setHighlightMessageId] = React.useState<string | null>(null);
  const [isMutating, setIsMutating] = React.useState(false);

  React.useEffect(() => {
    loadGroupHistory(group.groupId);
  }, [group.groupId, loadGroupHistory]);

  const humanMembers = React.useMemo(
    () =>
      group.memberUserIds
        .map((userId) => humansById[userId])
        .filter((human): human is RosterHuman => Boolean(human)),
    [group.memberUserIds, humansById]
  );

  const assistantMembers = React.useMemo(
    () =>
      group.assistantMemberIds
        .map((assistantId) => assistantsById[String(assistantId)])
        .filter((assistant): assistant is GroupDialogAssistantOption => Boolean(assistant)),
    [group.assistantMemberIds, assistantsById]
  );

  const faceMembers = React.useMemo(
    () => [
      ...humanMembers.map((human) => ({
        id: `u:${human.userId}`,
        name: human.name?.trim() || human.email || human.userId,
        image: human.image,
      })),
      ...assistantMembers.map((assistant) => ({
        id: `a:${assistant.agentId}`,
        name: assistant.name,
        image: assistant.image,
      })),
    ],
    [humanMembers, assistantMembers]
  );

  const mentionCandidates = React.useMemo<ChatMention[]>(
    () => [
      ...assistantMembers.map((assistant) => ({
        kind: 'assistant' as const,
        id: assistant.agentId,
        name: assistant.name,
      })),
      ...humanMembers.map((human) => ({
        kind: 'user' as const,
        id: human.userId,
        name: human.name?.trim() || human.email || human.userId,
      })),
    ],
    [assistantMembers, humanMembers]
  );

  const subtitle = formatRealVirtualSubtitle(group.memberUserIds, assistantMembers.length);
  const canLeave = Boolean(currentUserId && currentUserId !== group.createdByUserId);

  const rawMessages = groupMessages[group.groupId];
  const isLoading = rawMessages === undefined;

  const callPills = useOrgCallPills({
    orgId,
    scope: 'group',
    scopeId: String(group.groupId),
    isCallActive,
  });

  const messages = React.useMemo<OrgChatPanelMessage[]>(
    () =>
      (rawMessages ?? []).map((message) => {
        const isSelf = message.senderKind === 'user' && message.senderUserId === currentUserId;
        const avatarUrl =
          message.senderKind === 'user'
            ? (message.senderUserId && humansById[message.senderUserId]?.image) || null
            : (message.senderAssistantId != null &&
                assistantsById[String(message.senderAssistantId)]?.image) ||
              null;
        return {
          id: String(message.messageId),
          senderName: message.senderName,
          senderKind: message.senderKind,
          isSelf,
          content: message.content,
          timestamp: message.timestamp,
          avatarUrl,
          attachments: message.attachments,
          reactions: message.reactions,
        };
      }),
    [rawMessages, currentUserId, humansById, assistantsById]
  );

  const handleSend = React.useCallback(
    (content: string, mentions: ChatMention[], attachments: OrgChatAttachment[]) =>
      sendGroupMessage(group.groupId, content, mentions, attachments),
    [sendGroupMessage, group.groupId]
  );

  const handleToggleReaction = React.useCallback(
    (messageId: string, emoji: string) => {
      void toggleGroupReaction(group.groupId, Number(messageId), emoji);
    },
    [toggleGroupReaction, group.groupId]
  );

  const handleGoToMessage = React.useCallback((result: OrgChatSearchResult) => {
    setHighlightMessageId(result.id);
    setSearchOpen(false);
  }, []);

  const handleLeave = async () => {
    if (!currentUserId || !canLeave) return;
    setIsMutating(true);
    try {
      const nextUserIds = group.memberUserIds.filter((id) => id !== currentUserId);
      const response = await fetch(`/api/organizations/${orgId}/groups/${group.groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: nextUserIds,
          assistantIds: group.assistantMemberIds,
        }),
      });
      if (!response.ok) throw new Error('leave failed');
      onRefreshRoster?.();
      onLeftOrDeleted?.();
    } catch {
      console.error('Failed to leave chat group');
      toast('Could not leave group. Please try again.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/organizations/${orgId}/groups/${group.groupId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('delete failed');
      onRefreshRoster?.();
      onLeftOrDeleted?.();
    } catch {
      console.error('Failed to delete chat group');
      toast('Could not delete group. Please try again.');
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="group-workspace">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <GroupFaceStack members={faceMembers} sizeClassName="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="text-title truncate">{group.name}</div>
          <div className="text-caption truncate text-muted-foreground">{subtitle}</div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={isMutating}
              data-testid="group-workspace-overflow"
              aria-label="Group actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setManageOpen(true)}
              data-testid="group-manage-members"
            >
              Manage members
            </DropdownMenuItem>
            {canLeave ? (
              <DropdownMenuItem onClick={() => void handleLeave()} data-testid="group-leave">
                Leave
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => void handleDelete()}
              data-testid="group-delete"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1">
        <OrgChatPanel
          title={group.name}
          subtitle={subtitle}
          hideHeader
          orgId={orgId}
          messages={messages}
          callPills={callPills}
          isLoading={isLoading}
          onSend={handleSend}
          mentionCandidates={mentionCandidates}
          placeholder={`Message ${group.name}…`}
          emptyState="No messages in this group yet."
          onOpenSearch={() => setSearchOpen(true)}
          onStartCall={canJoinActiveCall ? onJoinCall : onStartCall}
          isCallButtonDisabled={isCallButtonDisabled}
          callButtonTooltip={
            callButtonTooltip ?? (canJoinActiveCall ? 'Join group call' : undefined)
          }
          isConnectingCall={isConnectingCall}
          highlightMessageId={highlightMessageId}
          currentUserId={currentUserId}
          canReact={!!currentUserId}
          onToggleReaction={handleToggleReaction}
        />
      </div>

      <OrgChatSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        orgId={orgId}
        scope="group"
        scopeId={group.groupId}
        peerName={group.name}
        onGoToMessage={handleGoToMessage}
      />

      <CreateGroupDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        orgId={orgId}
        currentUserId={currentUserId}
        humans={allHumans}
        assistants={allAssistants}
        editingGroup={group}
        onUpdated={(next) => {
          onGroupUpdated?.(next);
          onRefreshRoster?.();
        }}
      />
    </div>
  );
}
