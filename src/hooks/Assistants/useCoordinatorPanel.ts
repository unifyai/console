import * as React from 'react';
import type { Assistant } from '@/types/assistants/assistant';
import { buildSortingParam, fetchMemoryContext } from '@/lib/client/memory';
import { snakeToCamelObject } from '@/utils/casing';

const COORDINATOR_STATE_CONTEXT = 'Coordinator/State';
const COORDINATOR_CHECKLIST_CONTEXT = 'Coordinator/Checklist';
const PERSONAL_ROOT = { kind: 'personal' as const };

type CoordinatorRawRow = Record<string, unknown>;

export interface CoordinatorStateRow {
  mode: 'active' | 'ready_to_go';
  startedAt: string | null;
  readyAt: string | null;
  [key: string]: unknown;
}

export interface CoordinatorChecklistRow {
  itemId: number;
  title: string;
  description: string | null;
  kind: string | null;
  status: 'pending' | 'done' | 'skipped';
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeCoordinatorStateRow(rawRow: CoordinatorRawRow): CoordinatorStateRow {
  const row = snakeToCamelObject<CoordinatorRawRow>(rawRow);
  const mode = row.mode === 'ready_to_go' ? 'ready_to_go' : 'active';
  return {
    ...row,
    mode,
    startedAt: stringOrNull(row.startedAt),
    readyAt: stringOrNull(row.readyAt),
  };
}

function normalizeChecklistStatus(value: unknown): CoordinatorChecklistRow['status'] {
  if (value === 'done' || value === 'skipped') return value;
  return 'pending';
}

function normalizeCoordinatorChecklistRow(rawRow: CoordinatorRawRow): CoordinatorChecklistRow {
  const row = snakeToCamelObject<CoordinatorRawRow>(rawRow);
  return {
    ...row,
    itemId: numberOrNull(row.itemId) ?? 0,
    title: stringOrEmpty(row.title),
    description: stringOrNull(row.description),
    kind: stringOrNull(row.kind),
    status: normalizeChecklistStatus(row.status),
    createdAt: stringOrEmpty(row.createdAt),
    updatedAt: stringOrEmpty(row.updatedAt),
  };
}

export function useCoordinatorPanel({
  assistant,
  enabled = true,
}: {
  assistant: Assistant;
  enabled?: boolean;
}): {
  state: CoordinatorStateRow | null;
  checklist: CoordinatorChecklistRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [state, setState] = React.useState<CoordinatorStateRow | null>(null);
  const [checklist, setChecklist] = React.useState<CoordinatorChecklistRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestSequence = React.useRef(0);
  const latestAssistantRef = React.useRef(assistant);
  latestAssistantRef.current = assistant;
  const assistantForRequest = React.useMemo(
    () => ({
      ...latestAssistantRef.current,
      agentId: assistant.agentId,
      userId: assistant.userId,
      isCoordinator: assistant.isCoordinator,
    }),
    [assistant.agentId, assistant.userId, assistant.isCoordinator]
  );
  const isEnabled = enabled && assistant.isCoordinator === true;

  const reset = React.useCallback(() => {
    setState(null);
    setChecklist([]);
    setError(null);
  }, []);

  const refetch = React.useCallback(async () => {
    requestSequence.current += 1;
    const requestId = requestSequence.current;

    if (!isEnabled) {
      reset();
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [stateData, checklistData] = await Promise.all([
        fetchMemoryContext<CoordinatorRawRow>(assistantForRequest, COORDINATOR_STATE_CONTEXT, {
          limit: 1,
          root: PERSONAL_ROOT,
        }),
        fetchMemoryContext<CoordinatorRawRow>(assistantForRequest, COORDINATOR_CHECKLIST_CONTEXT, {
          limit: 100,
          sorting: buildSortingParam('itemId', 'asc'),
          root: PERSONAL_ROOT,
        }),
      ]);

      if (requestSequence.current !== requestId) return;

      setState(stateData.rows[0] ? normalizeCoordinatorStateRow(stateData.rows[0]) : null);
      setChecklist(checklistData.rows.map(normalizeCoordinatorChecklistRow));
    } catch (err) {
      if (requestSequence.current !== requestId) return;
      setError(err instanceof Error ? err.message : 'Failed to load Coordinator workspace');
    } finally {
      if (requestSequence.current === requestId) setIsLoading(false);
    }
  }, [assistantForRequest, isEnabled, reset]);

  React.useEffect(() => {
    reset();
    void refetch();
  }, [refetch, reset]);

  return {
    state,
    checklist,
    isLoading,
    error,
    refetch,
  };
}
