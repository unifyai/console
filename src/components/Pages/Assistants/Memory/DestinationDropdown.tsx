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

export const MEMORY_DESTINATION_ALL = 'all';
export const MEMORY_DESTINATION_PERSONAL = 'personal';

export type MemoryDestinationValue =
  | typeof MEMORY_DESTINATION_ALL
  | typeof MEMORY_DESTINATION_PERSONAL
  | `team:${number}`;

interface DestinationDropdownProps {
  assistant: Assistant;
  value: MemoryDestinationValue;
  onValueChange: (value: MemoryDestinationValue) => void;
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

export function memoryDestinationRoot(value: MemoryDestinationValue): ContextRoot | null {
  if (value === MEMORY_DESTINATION_ALL) return null;
  if (value === MEMORY_DESTINATION_PERSONAL) return { kind: 'personal' };

  const teamId = Number(value.slice('team:'.length));
  return { kind: 'team', teamId };
}

export function DestinationDropdown({ assistant, value, onValueChange }: DestinationDropdownProps) {
  const teamIds = useMemo(() => currentTeamIds(assistant), [assistant]);

  const { data: teams = [] } = useQuery({
    queryKey: ['assistant-teams', assistant.agentId, teamIds.join(',')],
    queryFn: () => fetchAssistantTeams(assistant.agentId),
    enabled: teamIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const teamNames = useMemo(() => {
    const names = new Map<number, string>();
    for (const summary of assistant.teamSummaries ?? []) {
      names.set(summary.teamId, summary.name);
    }
    for (const team of teams) {
      names.set(team.teamId, team.name);
    }
    return names;
  }, [assistant.teamSummaries, teams]);

  if (teamIds.length === 0) {
    return null;
  }

  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as MemoryDestinationValue)}>
      <SelectTrigger
        className="h-7 w-[8.5rem] shrink-0 px-2 text-xs"
        aria-label="Memory destination"
        data-testid="memory-destination-dropdown"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={MEMORY_DESTINATION_ALL} data-testid="memory-destination-all">
          All
        </SelectItem>
        <SelectItem value={MEMORY_DESTINATION_PERSONAL} data-testid="memory-destination-personal">
          Personal
        </SelectItem>
        {teamIds.map((teamId) => (
          <SelectItem
            key={teamId}
            value={`team:${teamId}`}
            data-testid={`memory-destination-team-${teamId}`}
          >
            {teamNames.get(teamId) ?? `Team ${teamId}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
