import * as React from 'react';
import { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import { fetchAssistantStatus } from '@/lib/client/assistant';

const POLLING_INTERVAL = 60000; // Poll every minute

export function useAssistantStatus(assistants: Assistant[]) {
  const [statuses, setStatuses] = React.useState<Map<string, AssistantStatus | null>>(new Map());
  const pollerRef = React.useRef<NodeJS.Timeout | null>(null);

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

    setStatuses((prev) => {
      const newStatuses = new Map(prev);
      results.forEach(({ assistantId, status }) => {
        newStatuses.set(assistantId, status);
      });
      return newStatuses;
    });
  }, []);

  React.useEffect(() => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
    }

    fetchAllStatuses();

    pollerRef.current = setInterval(() => {
      fetchAllStatuses();
    }, POLLING_INTERVAL);

    return () => {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
      }
    };
  }, [assistantIdsKey, fetchAllStatuses]);

  return { statuses };
}
