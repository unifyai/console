import * as React from 'react';
import type { Assistant } from '@/types/assistants/assistant';
import { buildSortingParam, fetchMemoryContext } from '@/lib/client/memory';
import { snakeToCamelObject } from '@/utils/casing';

const COORDINATOR_STATE_CONTEXT = 'Coordinator/State';
const COORDINATOR_CHECKLIST_CONTEXT = 'Coordinator/Checklist';
const COORDINATOR_ACTIVITY_CONTEXT = 'Events/CoordinatorActivity';
const COORDINATOR_ACTIVITY_LIMIT = 25;
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

export interface CoordinatorActivityEntity {
  type?: string | null;
  id?: string | null;
  name: string;
  [key: string]: unknown;
}

export interface CoordinatorActivityRow {
  activityId: string;
  phase: 'started' | 'progress' | 'needs_input' | 'blocked' | 'completed' | 'failed';
  stage:
    | 'discovery'
    | 'requirements'
    | 'proposal'
    | 'confirmation'
    | 'implementation'
    | 'credential_setup'
    | 'validation'
    | 'handoff';
  surfaces: string[];
  title: string;
  summary: string | null;
  checklistItemId: number | null;
  relatedEntities?: CoordinatorActivityEntity[];
  chatPrompt: string | null;
  chatPromptLabel: string | null;
  correlationId: string | null;
  occurredAt: string;
  status: 'ok' | 'error';
  error: string | null;
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

function normalizeActivityPhase(value: unknown): CoordinatorActivityRow['phase'] {
  if (
    value === 'started' ||
    value === 'progress' ||
    value === 'needs_input' ||
    value === 'blocked' ||
    value === 'completed' ||
    value === 'failed'
  ) {
    return value;
  }
  return 'progress';
}

function normalizeActivityStage(value: unknown): CoordinatorActivityRow['stage'] {
  if (
    value === 'discovery' ||
    value === 'requirements' ||
    value === 'proposal' ||
    value === 'confirmation' ||
    value === 'implementation' ||
    value === 'credential_setup' ||
    value === 'validation' ||
    value === 'handoff'
  ) {
    return value;
  }
  return 'discovery';
}

function normalizeActivityStatus(value: unknown): CoordinatorActivityRow['status'] {
  return value === 'error' ? 'error' : 'ok';
}

function normalizeActivityEntity(entity: unknown): CoordinatorActivityEntity {
  const row = entity && typeof entity === 'object' ? (entity as CoordinatorRawRow) : {};
  return {
    ...row,
    type: stringOrNull(row.type),
    id: stringOrNull(row.id),
    name: stringOrEmpty(row.name),
  };
}

function normalizeCoordinatorActivityRow(rawRow: CoordinatorRawRow): CoordinatorActivityRow {
  const row = snakeToCamelObject<CoordinatorRawRow>(rawRow);
  return {
    ...row,
    activityId: stringOrEmpty(row.activityId),
    phase: normalizeActivityPhase(row.phase),
    stage: normalizeActivityStage(row.stage),
    surfaces: Array.isArray(row.surfaces)
      ? row.surfaces.filter((item) => typeof item === 'string')
      : [],
    title: stringOrEmpty(row.title),
    summary: stringOrNull(row.summary),
    checklistItemId: numberOrNull(row.checklistItemId),
    relatedEntities: Array.isArray(row.relatedEntities)
      ? row.relatedEntities.map(normalizeActivityEntity)
      : undefined,
    chatPrompt: stringOrNull(row.chatPrompt),
    chatPromptLabel: stringOrNull(row.chatPromptLabel),
    correlationId: stringOrNull(row.correlationId),
    occurredAt: stringOrEmpty(row.occurredAt),
    status: normalizeActivityStatus(row.status),
    error: stringOrNull(row.error),
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
  activities: CoordinatorActivityRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [state, setState] = React.useState<CoordinatorStateRow | null>(null);
  const [checklist, setChecklist] = React.useState<CoordinatorChecklistRow[]>([]);
  const [activities, setActivities] = React.useState<CoordinatorActivityRow[]>([]);
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
    setActivities([]);
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
      const [stateData, checklistData, activityData] = await Promise.all([
        fetchMemoryContext<CoordinatorRawRow>(assistantForRequest, COORDINATOR_STATE_CONTEXT, {
          limit: 1,
          root: PERSONAL_ROOT,
        }),
        fetchMemoryContext<CoordinatorRawRow>(assistantForRequest, COORDINATOR_CHECKLIST_CONTEXT, {
          limit: 100,
          sorting: buildSortingParam('itemId', 'asc'),
          root: PERSONAL_ROOT,
        }),
        fetchMemoryContext<CoordinatorRawRow>(assistantForRequest, COORDINATOR_ACTIVITY_CONTEXT, {
          limit: COORDINATOR_ACTIVITY_LIMIT,
          sorting: buildSortingParam('occurredAt', 'desc'),
          root: PERSONAL_ROOT,
        }),
      ]);

      if (requestSequence.current !== requestId) return;

      setState(stateData.rows[0] ? normalizeCoordinatorStateRow(stateData.rows[0]) : null);
      setChecklist(checklistData.rows.map(normalizeCoordinatorChecklistRow));
      setActivities(activityData.rows.map(normalizeCoordinatorActivityRow));
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
    activities,
    isLoading,
    error,
    refetch,
  };
}
