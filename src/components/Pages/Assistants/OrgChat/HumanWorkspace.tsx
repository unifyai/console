'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { useResolvedProfileImage } from '@/hooks/User/useProfileImageResolver';
import { OrgChatPanel, OrgChatPanelMessage } from './OrgChatPanel';
import { OrgChatSearchDialog } from './OrgChatSearchDialog';
import { ChatMention, OrgChatAttachment, OrgChatSearchResult, RosterHuman } from '@/types/orgChat';
import type { useOrgChat } from '@/hooks/Assistants/useOrgChat';
import { useOrgCallPills } from '@/hooks/Assistants/useOrgCallPills';
import { profileAvatarTone, profileInitials } from '@/utils/user/profileDisplay';
import { PresenceStatusDot } from '@/components/Pages/Assistants/Common/PresenceStatusDot';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';

interface HumanWorkspaceProps {
  human: RosterHuman;
  orgId: string;
  chat: ReturnType<typeof useOrgChat>;
  currentUserId: string | null;
  onStartCall?: () => void;
  isCallButtonDisabled?: boolean;
  callButtonTooltip?: string;
  isConnectingCall?: boolean;
  /** True while a call with this teammate is connected — drives pill refetch. */
  isCallActive?: boolean;
}

/**
 * DM workspace for a single human org member: presence header plus a
 * one-to-one chat panel backed by the shared org-chat engine.
 */
export function HumanWorkspace({
  human,
  orgId,
  chat,
  currentUserId,
  onStartCall,
  isCallButtonDisabled,
  callButtonTooltip,
  isConnectingCall,
  isCallActive = false,
}: HumanWorkspaceProps) {
  const { loadDmHistory, sendDmMessage, dmMessages, toggleDmReaction } = chat;
  const { voiceCalls } = useFeatures();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [highlightMessageId, setHighlightMessageId] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadDmHistory(human.userId);
  }, [human.userId, loadDmHistory]);

  const rawMessages = dmMessages[human.userId];
  const isLoading = rawMessages === undefined;

  const callPills = useOrgCallPills({
    orgId,
    scope: 'dm',
    scopeId: human.userId,
    isCallActive,
  });

  const humanImageUrl = useResolvedProfileImage(human.image);

  const messages = React.useMemo<OrgChatPanelMessage[]>(
    () =>
      (rawMessages ?? []).map((message) => {
        const isSelf = message.senderUserId !== human.userId;
        return {
          id: String(message.id),
          senderName: isSelf ? 'You' : human.name,
          senderKind: 'user' as const,
          isSelf,
          content: message.content,
          timestamp: message.createdAt,
          avatarUrl: isSelf ? null : humanImageUrl,
          attachments: message.attachments,
          reactions: message.reactions,
        };
      }),
    [rawMessages, human.userId, human.name, humanImageUrl]
  );

  const handleSend = React.useCallback(
    (content: string, _mentions: ChatMention[], attachments: OrgChatAttachment[]) =>
      sendDmMessage(human.userId, content, attachments),
    [sendDmMessage, human.userId]
  );

  const handleToggleReaction = React.useCallback(
    (messageId: string, emoji: string) => {
      void toggleDmReaction(human.userId, Number(messageId), emoji);
    },
    [toggleDmReaction, human.userId]
  );

  const handleGoToMessage = React.useCallback((result: OrgChatSearchResult) => {
    setHighlightMessageId(result.id);
    setSearchOpen(false);
  }, []);

  const callDisabled = isCallButtonDisabled ?? (!voiceCalls || !onStartCall);
  const callTooltip =
    callButtonTooltip ??
    (!voiceCalls
      ? 'Voice calls are not configured'
      : onStartCall
        ? 'Start voice call'
        : 'Call unavailable');

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="human-workspace">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarImage src={humanImageUrl ?? undefined} alt={human.name} />
            <AvatarFallback
              className="text-semibold text-primary-foreground"
              style={{ backgroundColor: profileAvatarTone(human.name) }}
            >
              {profileInitials(human.name)}
            </AvatarFallback>
          </Avatar>
          <PresenceStatusDot online={human.online} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-title truncate">{human.name}</span>
            {human.roleName && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                {human.roleName}
              </span>
            )}
          </div>
          <div className="text-caption truncate">{human.email}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <OrgChatPanel
          title={human.name}
          subtitle={human.online ? 'Online' : 'Offline'}
          hideHeader
          orgId={orgId}
          messages={messages}
          callPills={callPills}
          isLoading={isLoading}
          onSend={handleSend}
          placeholder={`Message ${human.name}…`}
          emptyState={`No messages with ${human.name} yet.`}
          onOpenSearch={() => setSearchOpen(true)}
          onStartCall={onStartCall}
          isCallButtonDisabled={callDisabled}
          callButtonTooltip={callTooltip}
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
        scope="dm"
        scopeId={human.userId}
        peerName={human.name}
        onGoToMessage={handleGoToMessage}
      />
    </div>
  );
}
