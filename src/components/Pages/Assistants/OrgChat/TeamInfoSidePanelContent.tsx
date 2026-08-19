'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import type { RosterHuman, RosterTeam } from '@/types/orgChat';
import { formatRealVirtualSubtitle } from '@/utils/orgChat/memberSubtitle';
import { TeamAvatar } from './TeamAvatar';
import { TeamMembersList, type TeamMemberAssistant } from './TeamMembersList';

interface TeamInfoSidePanelContentProps {
  team: RosterTeam;
  humansById: Record<string, RosterHuman>;
  assistantsById: Record<string, TeamMemberAssistant>;
  onClose: () => void;
  hideHeaderActions?: boolean;
  className?: string;
}

/** Read-only profile side panel for a team: summary plus member roster. */
export function TeamInfoSidePanelContent({
  team,
  humansById,
  assistantsById,
  onClose,
  hideHeaderActions = false,
  className,
}: TeamInfoSidePanelContentProps) {
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

  const subtitle = formatRealVirtualSubtitle(team.memberUserIds, assistantMembers.length);
  const description = team.description?.trim() || null;

  return (
    <ScrollArea className={cn('flex-1', className)} data-testid="team-info-panel">
      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="flex items-start gap-3">
          <TeamAvatar
            name={team.name}
            imageUrl={team.image}
            isOrgWideSharing={team.isOrgWideSharing}
            className="h-14 w-14"
            iconClassName="h-6 w-6"
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-title truncate" data-testid="team-info-name">
              {team.name}
            </div>
            <div className="text-caption text-muted-foreground">{subtitle}</div>
            {team.isOrgWideSharing ? (
              <div className="text-caption text-muted-foreground">Org-wide sharing</div>
            ) : null}
          </div>
          {!hideHeaderActions && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              aria-label="Close profile"
              data-testid="team-info-close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {description ? (
          <section className="space-y-1">
            <h3 className="text-label text-semibold">About</h3>
            <p className="text-body whitespace-pre-wrap text-muted-foreground">{description}</p>
          </section>
        ) : null}

        <section className="space-y-2">
          <h3 className="text-label text-semibold">Members</h3>
          <TeamMembersList humans={humanMembers} assistants={assistantMembers} />
        </section>
      </div>
    </ScrollArea>
  );
}
