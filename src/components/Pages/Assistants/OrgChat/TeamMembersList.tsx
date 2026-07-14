'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import type { RosterHuman } from '@/types/orgChat';
import { profileAvatarTone, profileInitials } from '@/utils/user/profileDisplay';

export interface TeamMemberAssistant {
  agentId: string;
  name: string;
  image?: string | null;
}

interface TeamMembersListProps {
  humans: RosterHuman[];
  assistants: TeamMemberAssistant[];
  className?: string;
  /** Optional trailing control (e.g. Hire for this team). */
  trailing?: React.ReactNode;
}

/** Shared human + AI roster list used by the team Members section and profile panel. */
export function TeamMembersList({ humans, assistants, className, trailing }: TeamMembersListProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid="team-members-list">
      {trailing}
      {humans.map((human) => (
        <div key={human.userId} className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-8 w-8">
              {human.image && <AvatarImage src={human.image} alt={human.name} />}
              <AvatarFallback
                className="text-caption text-semibold text-primary-foreground"
                style={{ backgroundColor: profileAvatarTone(human.name) }}
              >
                {profileInitials(human.name)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                'absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-background',
                human.online ? 'bg-[var(--role-green)]' : 'bg-muted-foreground/40'
              )}
              aria-label={human.online ? 'Online' : 'Offline'}
            />
          </div>
          <div className="min-w-0">
            <div className="text-title truncate">{human.name}</div>
            <div className="text-caption truncate">{human.email}</div>
          </div>
        </div>
      ))}
      {assistants.map((assistant) => (
        <div key={assistant.agentId} className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {assistant.image && <AvatarImage src={assistant.image} alt={assistant.name} />}
            <AvatarFallback
              className="text-caption text-semibold text-primary-foreground"
              style={{ backgroundColor: profileAvatarTone(assistant.name) }}
            >
              {profileInitials(assistant.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-title truncate">{assistant.name}</div>
            <div className="text-caption truncate">AI teammate</div>
          </div>
        </div>
      ))}
      {humans.length === 0 && assistants.length === 0 && (
        <div className="text-body-muted">No members in this team.</div>
      )}
    </div>
  );
}
