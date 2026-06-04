import * as React from 'react';
import type { Assistant } from '@/types/assistants/assistant';
import { buildSortingParam, fetchMemoryContext } from '@/lib/client/memory';
import { snakeToCamelObject } from '@/utils/casing';

const COORDINATOR_STATE_CONTEXT = 'Coordinator/State';
const COORDINATOR_CHECKLIST_CONTEXT = 'Coordinator/Checklist';
const PERSONAL_ROOT = { kind: 'personal' as const };

type CoordinatorRawRow = Record<string, unknown>;

/**
 * ``Coordinator/State`` mode — the assistants-page onboarding gate.
 * ``onboarding`` shows the guided picker/chat surface, ``working``
 * means the user has graduated to the regular assistants UI.
 *
 * Intentionally distinct from the checklist's mode vocabulary
 * (``active`` / ``ready_to_go``) so a value alone tells you which
 * context it came from.
 */
export type CoordinatorMode = 'onboarding' | 'working';

export interface CoordinatorStateRow {
  mode: CoordinatorMode;
  /**
   * Persisted step marker used to resume the onboarding conversation
   * at the same point if the user closes the browser mid-flow. The
   * call-vs-chat picker is *not* persisted here — it's re-asked on
   * every entry into the onboarding view.
   */
  onboardingStep: string | null;
  startedAt: string | null;
  endedAt: string | null;
  [key: string]: unknown;
}

/**
 * ``Coordinator/Checklist`` row mode — distinct vocabulary from the
 * state context. Each checklist row is independently ``active`` (in
 * progress) or ``ready_to_go`` (queued and unblocked). Kept separate
 * from {@link CoordinatorMode} so the two concerns don't overload
 * the word ``active``.
 */
export type CoordinatorChecklistMode = 'active' | 'ready_to_go';

export interface CoordinatorChecklistRow {
  itemId: number;
  title: string;
  description: string | null;
  kind: string | null;
  status: 'pending' | 'done' | 'skipped';
  mode: CoordinatorChecklistMode | null;
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

function normalizeCoordinatorMode(value: unknown): CoordinatorMode {
  return value === 'working' ? 'working' : 'onboarding';
}

export function normalizeCoordinatorStateRow(rawRow: CoordinatorRawRow): CoordinatorStateRow {
  const row = snakeToCamelObject<CoordinatorRawRow>(rawRow);
  return {
    ...row,
    mode: normalizeCoordinatorMode(row.mode),
    onboardingStep: stringOrNull(row.onboardingStep),
    startedAt: stringOrNull(row.startedAt),
    endedAt: stringOrNull(row.endedAt),
  };
}

function normalizeChecklistStatus(value: unknown): CoordinatorChecklistRow['status'] {
  if (value === 'done' || value === 'skipped') return value;
  return 'pending';
}

function normalizeChecklistMode(value: unknown): CoordinatorChecklistMode | null {
  if (value === 'active' || value === 'ready_to_go') return value;
  return null;
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
    mode: normalizeChecklistMode(row.mode),
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
      setError(err instanceof Error ? err.message : 'Failed to load Unity workspace');
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
