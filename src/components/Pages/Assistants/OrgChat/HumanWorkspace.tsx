import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { OrgChatPanel, OrgChatPanelMessage } from './OrgChatPanel';
import { RosterHuman } from '@/types/orgChat';
import type { useOrgChat } from '@/hooks/Assistants/useOrgChat';
import { profileAvatarTone, profileInitials } from '@/utils/user/profileDisplay';
import { PresenceStatusDot } from '@/components/Pages/Assistants/Common/PresenceStatusDot';

interface HumanWorkspaceProps {
  human: RosterHuman;
  orgId: string;
  chat: ReturnType<typeof useOrgChat>;
}

/**
 * DM workspace for a single human org member: presence header plus a
 * one-to-one chat panel backed by the shared org-chat engine.
 */
export function HumanWorkspace({ human, chat }: HumanWorkspaceProps) {
  const { loadDmHistory, sendDmMessage, dmMessages } = chat;

  React.useEffect(() => {
    loadDmHistory(human.userId);
  }, [human.userId, loadDmHistory]);

  const rawMessages = dmMessages[human.userId];
  const isLoading = rawMessages === undefined;

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
          avatarUrl: isSelf ? null : human.image,
        };
      }),
    [rawMessages, human.userId, human.name, human.image]
  );

  const handleSend = React.useCallback(
    (content: string) => sendDmMessage(human.userId, content),
    [sendDmMessage, human.userId]
  );

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="human-workspace">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="relative">
          <Avatar className="h-10 w-10">
            {human.image && <AvatarImage src={human.image} alt={human.name} />}
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
          messages={messages}
          isLoading={isLoading}
          onSend={handleSend}
          placeholder={`Message ${human.name}…`}
          emptyState={`No messages with ${human.name} yet.`}
        />
      </div>
    </div>
  );
}
