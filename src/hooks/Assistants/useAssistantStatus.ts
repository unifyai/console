import * as React from 'react';
import { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import { fetchAssistantStatus } from '@/lib/client/assistant';

const POLLING_INTERVAL = 60000;
/** Keep optimistic online through slow backend status polls after live signals. */
const OPTIMISTIC_ONLINE_GRACE_MS = 30_000;

export function useAssistantStatus(
  assistants: Assistant[],
  { enabled = true }: { enabled?: boolean } = {}
) {
  const [statuses, setStatuses] = React.useState<Map<string, AssistantStatus | null>>(new Map());
  const pollerRef = React.useRef<NodeJS.Timeout | null>(null);
  const optimisticOnlineUntilRef = React.useRef<Map<string, number>>(new Map());

  const assistantsRef = React.useRef<Assistant[]>(assistants);
  assistantsRef.current = assistants;

  const assistantIdsKey = React.useMemo(
    () =>
      assistants
        .map((a) => a.agentId)
        .sort()
        .join(','),
    [assistants]
  );

  const fetchAllStatuses = React.useCallback(async () => {
    const assistantList = assistantsRef.current;

    if (assistantList.length === 0) {
      setStatuses(new Map());
      return;
    }

    const results = await Promise.all(
      assistantList.map(async (assistant) => ({
        assistantId: assistant.agentId,
        status: await fetchAssistantStatus(assistant.agentId),
      }))
    );

    const now = Date.now();
    setStatuses((prev) => {
      const newStatuses = new Map(prev);
      results.forEach(({ assistantId, status }) => {
        const graceUntil = optimisticOnlineUntilRef.current.get(assistantId) ?? 0;
        if (!status?.running && graceUntil > now) {
          newStatuses.set(assistantId, {
            running: true,
            jobName: status?.jobName ?? prev.get(assistantId)?.jobName ?? null,
          });
          return;
        }
        newStatuses.set(assistantId, status);
      });
      return newStatuses;
    });
  }, []);

  const restartPoller = React.useCallback(() => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
    }
    pollerRef.current = setInterval(() => {
      fetchAllStatuses();
    }, POLLING_INTERVAL);
  }, [fetchAllStatuses]);

  const markOnline = React.useCallback(
    (assistantId: string) => {
      optimisticOnlineUntilRef.current.set(assistantId, Date.now() + OPTIMISTIC_ONLINE_GRACE_MS);
      setStatuses((prev) => {
        const existing = prev.get(assistantId);
        if (existing?.running) return prev;
        const next = new Map(prev);
        next.set(assistantId, { running: true, jobName: existing?.jobName ?? null });
        return next;
      });
      if (enabled) {
        restartPoller();
      }
    },
    [enabled, restartPoller]
  );

  React.useEffect(() => {
    if (!enabled) {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
      return;
    }
    fetchAllStatuses();
    restartPoller();

    return () => {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
      }
    };
  }, [assistantIdsKey, enabled, fetchAllStatuses, restartPoller]);

  return { statuses, markOnline };
}
