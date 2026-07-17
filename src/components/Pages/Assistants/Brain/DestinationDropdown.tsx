'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import type { Assistant } from '@/types/assistants/assistant';
import type { SharedTeamSummary } from '@/types/teams/sharedTeam';
import { currentTeamIds, type ContextRoot } from '@/lib/assistants/scope';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { resolveManagedTeamDisplayName } from '@/utils/teams/managedTeamDisplay';

export const BRAIN_DESTINATION_ALL = 'all';
export const BRAIN_DESTINATION_PERSONAL = 'personal';

export type BrainDestinationValue =
  | typeof BRAIN_DESTINATION_ALL
  | typeof BRAIN_DESTINATION_PERSONAL
  | `team:${number}`;

interface DestinationDropdownProps {
  assistant: Assistant;
  value: BrainDestinationValue;
  onValueChange: (value: BrainDestinationValue) => void;
}

async function fetchAssistantTeams(assistantId: string): Promise<SharedTeamSummary[]> {
  const response = await fetch(`/api/assistant/${assistantId}/teams`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load teams');
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Unexpected teams response');
  }
  return data as SharedTeamSummary[];
}

export function brainDestinationRoot(value: BrainDestinationValue): ContextRoot | null {
  if (value === BRAIN_DESTINATION_ALL) return null;
  if (value === BRAIN_DESTINATION_PERSONAL) return { kind: 'personal' };

  const teamId = Number(value.slice('team:'.length));
  return { kind: 'team', teamId };
}

export function DestinationDropdown({ assistant, value, onValueChange }: DestinationDropdownProps) {
  const teamIds = useMemo(() => currentTeamIds(assistant), [assistant]);
  const { activeWorkspace } = useWorkspace();
  const orgName = activeWorkspace?.type === 'organization' ? activeWorkspace.name : null;

  const { data: teams = [] } = useQuery({
    queryKey: ['assistant-teams', assistant.agentId, teamIds.join(',')],
    queryFn: () => fetchAssistantTeams(assistant.agentId),
    enabled: teamIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const teamNames = useMemo(() => {
    const names = new Map<number, string>();
    for (const summary of assistant.teamSummaries ?? []) {
      names.set(summary.teamId, resolveManagedTeamDisplayName(summary, orgName));
    }
    for (const team of teams) {
      names.set(team.teamId, resolveManagedTeamDisplayName(team, orgName));
    }
    return names;
  }, [assistant.teamSummaries, orgName, teams]);

  if (teamIds.length === 0) {
    return null;
  }

  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as BrainDestinationValue)}>
      <SelectTrigger
        className="h-7 w-[8.5rem] shrink-0 px-2 text-xs"
        aria-label="Brain destination"
        data-testid="brain-destination-dropdown"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={BRAIN_DESTINATION_ALL} data-testid="brain-destination-all">
          All
        </SelectItem>
        <SelectItem value={BRAIN_DESTINATION_PERSONAL} data-testid="brain-destination-personal">
          Personal
        </SelectItem>
        {teamIds.map((teamId) => (
          <SelectItem
            key={teamId}
            value={`team:${teamId}`}
            data-testid={`brain-destination-team-${teamId}`}
          >
            {teamNames.get(teamId) ?? `Team ${teamId}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
