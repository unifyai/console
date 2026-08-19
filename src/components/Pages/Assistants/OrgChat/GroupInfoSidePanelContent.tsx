'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import type { RosterGroup, RosterHuman } from '@/types/orgChat';
import { formatRealVirtualSubtitle } from '@/utils/orgChat/memberSubtitle';
import { GroupFaceStack } from './GroupFaceStack';
import { TeamMembersList, type TeamMemberAssistant } from './TeamMembersList';

interface GroupInfoSidePanelContentProps {
  group: RosterGroup;
  humansById: Record<string, RosterHuman>;
  assistantsById: Record<string, TeamMemberAssistant>;
  onClose: () => void;
  hideHeaderActions?: boolean;
  className?: string;
}

/** Read-only profile side panel for a chat group: summary plus member roster. */
export function GroupInfoSidePanelContent({
  group,
  humansById,
  assistantsById,
  onClose,
  hideHeaderActions = false,
  className,
}: GroupInfoSidePanelContentProps) {
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
        .filter((assistant): assistant is TeamMemberAssistant => Boolean(assistant)),
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

  const subtitle = formatRealVirtualSubtitle(group.memberUserIds, assistantMembers.length);

  return (
    <ScrollArea className={cn('flex-1', className)} data-testid="group-info-panel">
      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="flex items-start gap-3">
          <GroupFaceStack
            members={faceMembers}
            icon={group.icon}
            iconClassName="text-2xl"
            sizeClassName="h-12 w-12"
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-title truncate" data-testid="group-info-name">
              {group.name}
            </div>
            <div className="text-caption text-muted-foreground">{subtitle}</div>
          </div>
          {!hideHeaderActions && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              aria-label="Close profile"
              data-testid="group-info-close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <section className="space-y-2">
          <h3 className="text-label text-semibold">Members</h3>
          <TeamMembersList humans={humanMembers} assistants={assistantMembers} />
        </section>
      </div>
    </ScrollArea>
  );
}
