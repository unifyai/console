import * as React from 'react';
import { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';

const POLLING_INTERVAL = 60000; // Poll every minute

export function useAssistantStatus(
  assistants: Assistant[],
  getStatusAction: (id: string) => Promise<(AssistantStatus & ResponseProps) | ResponseProps>
) {
  const [statuses, setStatuses] = React.useState<Map<string, AssistantStatus | null>>(new Map());
  const pollerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Use a ref to always have access to the latest assistants without triggering re-renders
  const assistantsRef = React.useRef<Assistant[]>(assistants);
  assistantsRef.current = assistants;

  // Create a stable string key based on assistant IDs to detect actual list changes
  // This prevents re-fetching when only the array reference changes (e.g., from photo URL updates)
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
      setStatuses(new Map()); // Clear statuses if no assistants
      return;
    }

    const promises = assistantList.map(async (assistant) => {
      try {
        const result = await getStatusAction(assistant.agentId);
        if (result && 'running' in result) {
          return { assistantId: assistant.agentId, status: result as AssistantStatus };
        }
        // Don't log error here as it can be noisy, the action itself logs.
        return { assistantId: assistant.agentId, status: null };
      } catch (error) {
        return { assistantId: assistant.agentId, status: null };
      }
    });

    const results = await Promise.all(promises);

    setStatuses((prev) => {
      const newStatuses = new Map(prev);
      results.forEach(({ assistantId, status }) => {
        newStatuses.set(assistantId, status);
      });
      return newStatuses;
    });
  }, [getStatusAction]);

  React.useEffect(() => {
    // Stop any existing polling
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
    }

    // Immediately fetch statuses when the actual assistant IDs change
    fetchAllStatuses();

    // Then start polling at a fixed interval
    pollerRef.current = setInterval(() => {
      fetchAllStatuses();
    }, POLLING_INTERVAL);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
      }
    };
  }, [assistantIdsKey, fetchAllStatuses]);

  return { statuses };
}
