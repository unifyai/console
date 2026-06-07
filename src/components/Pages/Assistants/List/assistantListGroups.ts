import { currentTeamIds } from '@/lib/assistants/scope';
import type { Assistant } from '@/types/assistants/assistant';
import type { SharedTeamSummary } from '@/types/teams/sharedTeam';

export interface AssistantListEntry {
  assistant: Assistant;
  isPrimaryTeamListing: boolean;
  alsoInTeamLabels: string[];
}

export type AssistantListGroup =
  | {
      id: 'pinned';
      kind: 'pinned';
      label: 'Pinned';
      rows: AssistantListEntry[];
    }
  | {
      id: `team:${number}`;
      kind: 'team';
      teamId: number;
      label: string;
      rows: AssistantListEntry[];
    }
  | {
      id: 'solo';
      kind: 'solo';
      label: 'Solo';
      rows: AssistantListEntry[];
    };

function assistantSortKey(assistant: Assistant): string {
  return [assistant.firstName, assistant.surname, assistant.agentId].join('\u0000').toLowerCase();
}

function sortEntries(left: AssistantListEntry, right: AssistantListEntry): number {
  return assistantSortKey(left.assistant).localeCompare(assistantSortKey(right.assistant));
}

function isCoordinator(assistant: Assistant): boolean {
  return assistant.isCoordinator === true;
}

function teamLabel(teamId: number, teamsById: Record<number, SharedTeamSummary>): string {
  return teamsById[teamId]?.name ?? `Team ${teamId}`;
}

function rowsForTeam(
  rowsByTeam: Map<number, AssistantListEntry[]>,
  teamId: number
): AssistantListEntry[] {
  const existingRows = rowsByTeam.get(teamId);
  if (existingRows) {
    return existingRows;
  }
  const rows: AssistantListEntry[] = [];
  rowsByTeam.set(teamId, rows);
  return rows;
}

export function groupAssistantsByTeam(
  assistants: readonly Assistant[],
  teamsById: Record<number, SharedTeamSummary>,
  options: { pinnedCoordinatorId?: string | null } = {}
): AssistantListGroup[] {
  const pinnedRows: AssistantListEntry[] = [];
  const soloRows: AssistantListEntry[] = [];
  const rowsByTeam = new Map<number, AssistantListEntry[]>();
  const pinnedCoordinatorId = options.pinnedCoordinatorId ?? null;

  for (const assistant of assistants) {
    const shouldPinCoordinator =
      isCoordinator(assistant) &&
      (pinnedCoordinatorId === null || assistant.agentId === pinnedCoordinatorId);

    if (shouldPinCoordinator) {
      pinnedRows.push({
        assistant,
        isPrimaryTeamListing: true,
        alsoInTeamLabels: [],
      });
      continue;
    }

    if (isCoordinator(assistant)) {
      continue;
    }

    const teamIds = currentTeamIds(assistant);
    if (teamIds.length === 0) {
      soloRows.push({
        assistant,
        isPrimaryTeamListing: true,
        alsoInTeamLabels: [],
      });
      continue;
    }

    const primaryTeamId = teamIds[0];
    for (const teamId of teamIds) {
      rowsForTeam(rowsByTeam, teamId).push({
        assistant,
        isPrimaryTeamListing: teamId === primaryTeamId,
        alsoInTeamLabels: teamIds
          .filter((otherTeamId) => otherTeamId !== teamId)
          .map((otherTeamId) => teamLabel(otherTeamId, teamsById)),
      });
    }
  }

  const groups: AssistantListGroup[] = [];
  if (pinnedRows.length > 0) {
    groups.push({
      id: 'pinned',
      kind: 'pinned',
      label: 'Pinned',
      rows: pinnedRows.sort(sortEntries),
    });
  }

  const sortedTeamEntries = Array.from(rowsByTeam.entries()).sort(
    ([leftTeamId], [rightTeamId]) => leftTeamId - rightTeamId
  );
  for (const [teamId, rows] of sortedTeamEntries) {
    groups.push({
      id: `team:${teamId}`,
      kind: 'team',
      teamId,
      label: teamLabel(teamId, teamsById),
      rows: rows.sort(sortEntries),
    });
  }

  if (soloRows.length > 0) {
    groups.push({
      id: 'solo',
      kind: 'solo',
      label: 'Solo',
      rows: soloRows.sort(sortEntries),
    });
  }

  return groups;
}
