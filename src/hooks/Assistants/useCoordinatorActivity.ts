import * as React from 'react';
import type { Assistant } from '@/types/assistants/assistant';
import { buildSortingParam, fetchMemoryContext } from '@/lib/client/memory';
import {
  type CoordinatorActivityRow,
  mergeCoordinatorActivities,
  normalizeCoordinatorActivityRow,
} from '@/types/assistants/coordinatorActivity';

const COORDINATOR_ACTIVITY_CONTEXT = 'Events/CoordinatorActivity';
const COORDINATOR_ACTIVITY_LIMIT = 25;
const SEEN_ACTIVITY_LIMIT = 100;
const PERSONAL_ROOT = { kind: 'personal' as const };

type CoordinatorRawRow = Record<string, unknown>;
export type CoordinatorActivityConnectionStatus = 'connecting' | 'connected' | 'error' | 'closed';

type ActionStreamFrame = {
  type?: unknown;
  data?: {
    entries?: unknown;
  };
};

export interface CoordinatorActivityState {
  activities: CoordinatorActivityRow[];
  connectionStatus: CoordinatorActivityConnectionStatus;
  activitySignal: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function activityIdentity(activity: CoordinatorActivityRow): string {
  return (
    activity.eventId?.trim() || `${activity.activityId}:${activity.phase}:${activity.occurredAt}`
  );
}

function rememberActivityId(seen: Set<string>, activity: CoordinatorActivityRow): void {
  seen.add(activityIdentity(activity));
  while (seen.size > SEEN_ACTIVITY_LIMIT) {
    const oldest = seen.values().next().value as string | undefined;
    if (oldest === undefined) break;
    seen.delete(oldest);
  }
}

function parseCoordinatorActivityFrame(event: MessageEvent<string>): CoordinatorActivityRow | null {
  let parsed: ActionStreamFrame;
  try {
    parsed = JSON.parse(event.data) as ActionStreamFrame;
  } catch {
    return null;
  }

  if (parsed.type !== 'CoordinatorActivity') return null;
  const entries = parsed.data?.entries;
  if (!entries || typeof entries !== 'object') return null;

  const activity = normalizeCoordinatorActivityRow(entries as CoordinatorRawRow);
  return activity.activityId ? activity : null;
}

export function useCoordinatorActivity({
  assistant,
  enabled = true,
  onActivity,
}: {
  assistant: Assistant;
  enabled?: boolean;
  onActivity?: (activity: CoordinatorActivityRow) => void;
}): CoordinatorActivityState {
  const [activities, setActivities] = React.useState<CoordinatorActivityRow[]>([]);
  const [connectionStatus, setConnectionStatus] =
    React.useState<CoordinatorActivityConnectionStatus>('closed');
  const [activitySignal, setActivitySignal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestSequence = React.useRef(0);
  const seenActivityIds = React.useRef(new Set<string>());
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const onActivityRef = React.useRef(onActivity);
  onActivityRef.current = onActivity;

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
    setActivities([]);
    setActivitySignal(0);
    setConnectionStatus('closed');
    setError(null);
    seenActivityIds.current.clear();
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
      const activityData = await fetchMemoryContext<CoordinatorRawRow>(
        assistantForRequest,
        COORDINATOR_ACTIVITY_CONTEXT,
        {
          limit: COORDINATOR_ACTIVITY_LIMIT,
          sorting: buildSortingParam('occurredAt', 'desc'),
          root: PERSONAL_ROOT,
        }
      );

      if (requestSequence.current !== requestId) return;

      const normalized = activityData.rows
        .map(normalizeCoordinatorActivityRow)
        .filter((activity) => activity.activityId);
      for (const activity of normalized) {
        rememberActivityId(seenActivityIds.current, activity);
      }
      setActivities((current) =>
        mergeCoordinatorActivities(current, normalized).slice(0, COORDINATOR_ACTIVITY_LIMIT)
      );
    } catch (err) {
      if (requestSequence.current !== requestId) return;
      setError(err instanceof Error ? err.message : 'Failed to load Unity activity');
    } finally {
      if (requestSequence.current === requestId) setIsLoading(false);
    }
  }, [assistantForRequest, isEnabled, reset]);

  React.useEffect(() => {
    reset();
    void refetch();
  }, [refetch, reset]);

  React.useEffect(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    if (!isEnabled || typeof EventSource === 'undefined') {
      setConnectionStatus('closed');
      return;
    }

    setConnectionStatus('connecting');
    const source = new EventSource(`/api/assistant/${assistant.agentId}/actions/stream`);
    eventSourceRef.current = source;

    source.onopen = () => {
      setConnectionStatus('connected');
    };

    source.onmessage = (event) => {
      const activity = parseCoordinatorActivityFrame(event);
      if (!activity) return;

      const identity = activityIdentity(activity);
      if (seenActivityIds.current.has(identity)) return;
      rememberActivityId(seenActivityIds.current, activity);

      setActivities((current) =>
        mergeCoordinatorActivities(current, [activity]).slice(0, COORDINATOR_ACTIVITY_LIMIT)
      );
      setActivitySignal((current) => current + 1);
      onActivityRef.current?.(activity);
    };

    source.onerror = () => {
      setConnectionStatus('error');
    };

    return () => {
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
        setConnectionStatus('closed');
      }
    };
  }, [assistant.agentId, isEnabled]);

  return {
    activities,
    connectionStatus,
    activitySignal,
    isLoading,
    error,
    refetch,
  };
}
