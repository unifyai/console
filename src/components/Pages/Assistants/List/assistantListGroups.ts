import { currentSpaceIds } from '@/lib/assistants/scope';
import type { Assistant } from '@/types/assistants/assistant';
import type { SpaceSummary } from '@/types/spaces/space';

export interface AssistantListEntry {
  assistant: Assistant;
  isPrimarySpaceListing: boolean;
  alsoInSpaceLabels: string[];
}

export type AssistantListGroup =
  | {
      id: 'pinned';
      kind: 'pinned';
      label: 'Pinned';
      rows: AssistantListEntry[];
    }
  | {
      id: `space:${number}`;
      kind: 'space';
      spaceId: number;
      label: string;
      rows: AssistantListEntry[];
    }
  | {
      id: 'solo';
      kind: 'solo';
      label: 'Solo';
      rows: AssistantListEntry[];
    };

type CoordinatorAssistant = Assistant & { isCoordinator?: boolean };

function assistantSortKey(assistant: Assistant): string {
  return [assistant.firstName, assistant.surname, assistant.agentId].join('\u0000').toLowerCase();
}

function sortEntries(left: AssistantListEntry, right: AssistantListEntry): number {
  return assistantSortKey(left.assistant).localeCompare(assistantSortKey(right.assistant));
}

function isCoordinator(assistant: Assistant): boolean {
  return (assistant as CoordinatorAssistant).isCoordinator === true;
}

function spaceLabel(spaceId: number, spacesById: Record<number, SpaceSummary>): string {
  return spacesById[spaceId]?.name ?? `Space ${spaceId}`;
}

function rowsForSpace(
  rowsBySpace: Map<number, AssistantListEntry[]>,
  spaceId: number
): AssistantListEntry[] {
  const existingRows = rowsBySpace.get(spaceId);
  if (existingRows) {
    return existingRows;
  }
  const rows: AssistantListEntry[] = [];
  rowsBySpace.set(spaceId, rows);
  return rows;
}

export function groupAssistantsBySpace(
  assistants: readonly Assistant[],
  spacesById: Record<number, SpaceSummary>
): AssistantListGroup[] {
  const pinnedRows: AssistantListEntry[] = [];
  const soloRows: AssistantListEntry[] = [];
  const rowsBySpace = new Map<number, AssistantListEntry[]>();

  for (const assistant of assistants) {
    if (isCoordinator(assistant)) {
      pinnedRows.push({ assistant, isPrimarySpaceListing: true, alsoInSpaceLabels: [] });
      continue;
    }

    const spaceIds = currentSpaceIds(assistant);
    if (spaceIds.length === 0) {
      soloRows.push({ assistant, isPrimarySpaceListing: true, alsoInSpaceLabels: [] });
      continue;
    }

    const primarySpaceId = spaceIds[0];
    for (const spaceId of spaceIds) {
      rowsForSpace(rowsBySpace, spaceId).push({
        assistant,
        isPrimarySpaceListing: spaceId === primarySpaceId,
        alsoInSpaceLabels: spaceIds
          .filter((otherSpaceId) => otherSpaceId !== spaceId)
          .map((otherSpaceId) => spaceLabel(otherSpaceId, spacesById)),
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

  const sortedSpaceEntries = Array.from(rowsBySpace.entries()).sort(
    ([leftSpaceId], [rightSpaceId]) => leftSpaceId - rightSpaceId
  );
  for (const [spaceId, rows] of sortedSpaceEntries) {
    groups.push({
      id: `space:${spaceId}`,
      kind: 'space',
      spaceId,
      label: spaceLabel(spaceId, spacesById),
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
