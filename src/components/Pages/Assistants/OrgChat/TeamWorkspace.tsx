'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { OrgChatPanel, OrgChatPanelMessage } from './OrgChatPanel';
import { OrgChatSearchDialog } from './OrgChatSearchDialog';
import { TeamMembersList, type TeamMemberAssistant } from './TeamMembersList';
import { ChatMention, OrgChatAttachment, RosterHuman, RosterTeam } from '@/types/orgChat';
import type { useOrgChat } from '@/hooks/Assistants/useOrgChat';
import { useOrgCallPills } from '@/hooks/Assistants/useOrgCallPills';
import { formatRealVirtualSubtitle } from '@/utils/orgChat/memberSubtitle';

interface TeamWorkspaceProps {
  team: RosterTeam;
  orgId: string;
  humansById: Record<string, RosterHuman>;
  assistantsById: Record<string, TeamMemberAssistant>;
  currentUserId: string | null;
  /** Which section to render: 'chat' | 'members'. */
  activeSectionId: string;
  chat: ReturnType<typeof useOrgChat>;
  /** Opens the hire dialog with this team preset as the owning team. */
  onHireForTeam?: () => void;
  onStartCall?: () => void;
  onJoinCall?: () => void;
  isCallButtonDisabled?: boolean;
  callButtonTooltip?: string;
  isConnectingCall?: boolean;
  canJoinActiveCall?: boolean;
  /** True while this team's call is connected — drives pill refetch. */
  isCallActive?: boolean;
}

/**
 * Workspace for a team: group chat with @mention autocomplete over the
 * team's human and AI members, a members roster, and an optional data pane.
 */
export function TeamWorkspace({
  team,
  orgId,
  humansById,
  assistantsById,
  currentUserId,
  activeSectionId,
  chat,
  onHireForTeam,
  onStartCall,
  onJoinCall,
  isCallButtonDisabled,
  callButtonTooltip,
  isConnectingCall,
  canJoinActiveCall,
  isCallActive = false,
}: TeamWorkspaceProps) {
  const { loadTeamHistory, sendTeamMessage, teamMessages, toggleTeamReaction } = chat;
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [highlightMessageId, setHighlightMessageId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activeSectionId === 'chat') {
      loadTeamHistory(team.teamId);
    }
  }, [team.teamId, activeSectionId, loadTeamHistory]);

  const humanMembers = React.useMemo(
    () =>
      team.memberUserIds
        .map((userId) => humansById[userId])
        .filter((human): human is RosterHuman => Boolean(human)),
    [team.memberUserIds, humansById]
  );

  const assistantMembers = React.useMemo(
    () =>
      team.assistantMemberIds
        .map((assistantId) => assistantsById[String(assistantId)])
        .filter((assistant): assistant is TeamMemberAssistant => Boolean(assistant)),
    [team.assistantMemberIds, assistantsById]
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
        name: human.name,
      })),
    ],
    [assistantMembers, humanMembers]
  );

  const subtitle = formatRealVirtualSubtitle(team.memberUserIds, assistantMembers.length);

  const rawMessages = teamMessages[team.teamId];
  const isLoading = rawMessages === undefined;

  const callPills = useOrgCallPills({
    orgId,
    scope: 'team',
    scopeId: String(team.teamId),
    isCallActive,
    enabled: activeSectionId === 'chat',
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
      sendTeamMessage(team.teamId, content, mentions, attachments),
    [sendTeamMessage, team.teamId]
  );

  const handleToggleReaction = React.useCallback(
    (messageId: string, emoji: string) => {
      void toggleTeamReaction(team.teamId, Number(messageId), emoji);
    },
    [toggleTeamReaction, team.teamId]
  );

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="team-workspace">
      {activeSectionId === 'chat' && (
        <>
          <OrgChatPanel
            title={team.name}
            subtitle={subtitle}
            orgId={orgId}
            messages={messages}
            callPills={callPills}
            isLoading={isLoading}
            onSend={handleSend}
            mentionCandidates={mentionCandidates}
            placeholder={`Message ${team.name}…`}
            emptyState="No messages in this team yet."
            onOpenSearch={() => setSearchOpen(true)}
            onStartCall={canJoinActiveCall ? onJoinCall : onStartCall}
            isCallButtonDisabled={isCallButtonDisabled}
            callButtonTooltip={
              callButtonTooltip ?? (canJoinActiveCall ? 'Join team call' : undefined)
            }
            isConnectingCall={isConnectingCall}
            highlightMessageId={highlightMessageId}
            currentUserId={currentUserId}
            canReact={!!currentUserId}
            onToggleReaction={handleToggleReaction}
          />
          <OrgChatSearchDialog
            open={searchOpen}
            onOpenChange={setSearchOpen}
            orgId={orgId}
            scope="team"
            scopeId={team.teamId}
            peerName={team.name}
            onGoToMessage={(result) => {
              setHighlightMessageId(result.id);
              setSearchOpen(false);
            }}
          />
        </>
      )}

      {activeSectionId === 'members' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <TeamMembersList
            humans={humanMembers}
            assistants={assistantMembers}
            trailing={
              onHireForTeam ? (
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onHireForTeam}
                    data-testid="team-hire-button"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Hire for this team
                  </Button>
                </div>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
