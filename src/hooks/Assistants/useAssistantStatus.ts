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

    const fetchAllStatuses = React.useCallback(async (assistantList: Assistant[]) => {
        if (assistantList.length === 0) {
            setStatuses(new Map()); // Clear statuses if no assistants
            return;
        }

        const promises = assistantList.map(async (assistant) => {
            try {
                const result = await getStatusAction(assistant.agent_id);
                if (result && 'running' in result) {
                    return { assistantId: assistant.agent_id, status: result as AssistantStatus };
                }
                // Don't log error here as it can be noisy, the action itself logs.
                return { assistantId: assistant.agent_id, status: null };
            } catch (error) {
                return { assistantId: assistant.agent_id, status: null };
            }
        });

        const results = await Promise.all(promises);
        
        setStatuses(prev => {
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

        // Immediately fetch statuses when assistants list changes
        fetchAllStatuses(assistants);

        // Then start polling at a fixed interval
        pollerRef.current = setInterval(() => {
            fetchAllStatuses(assistants);
        }, POLLING_INTERVAL);

        // Cleanup on unmount or when dependencies change
        return () => {
            if (pollerRef.current) {
                clearInterval(pollerRef.current);
            }
        };

    }, [assistants, fetchAllStatuses]);

    return { statuses };
}
