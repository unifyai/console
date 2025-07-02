import * as React from 'react';
import { Assistant, AssistantStatus } from '@/types/team/assistant';
import { ResponseProps } from '@/types/common';

export function useAssistantStatus(
    assistants: Assistant[],
    getStatusAction: (id: string) => Promise<(AssistantStatus & ResponseProps) | ResponseProps>
) {
    const [statuses, setStatuses] = React.useState<Map<string, AssistantStatus | null>>(new Map());
    const timersRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

    React.useEffect(() => {
        const currentTimers = timersRef.current;
        
        // Function to fetch status and schedule the next fetch
        const fetchAndSchedule = async (assistantId: string) => {
            try {
                const result = await getStatusAction(assistantId);
                let status: AssistantStatus | null = null;
                
                if (result && 'running' in result) {
                    status = result as AssistantStatus;
                } else {
                    console.warn(`Could not retrieve status for assistant ${assistantId}:`, (result as ResponseProps).detail);
                }

                setStatuses(prev => new Map(prev).set(assistantId, status));

                if (status && status.inactivity_timeout_minutes > 0) {
                    const nextFetchDelay = status.inactivity_timeout_minutes * 60 * 1000;
                    const timerId = setTimeout(() => fetchAndSchedule(assistantId), nextFetchDelay);
                    currentTimers.set(assistantId, timerId);
                }
            } catch (error) {
                console.error(`Error fetching status for assistant ${assistantId}:`, error);
                setStatuses(prev => new Map(prev).set(assistantId, null));
            }
        };

        const assistantIds = new Set(assistants.map(a => a.agent_id));

        // Clear timers for assistants that are no longer in the list
        currentTimers.forEach((timerId, assistantId) => {
            if (!assistantIds.has(assistantId)) {
                clearTimeout(timerId);
                currentTimers.delete(assistantId);
            }
        });

        // Start polling for new assistants
        assistants.forEach(assistant => {
            if (!currentTimers.has(assistant.agent_id)) {
                fetchAndSchedule(assistant.agent_id);
            }
        });

        // Cleanup on unmount
        return () => {
            currentTimers.forEach(timerId => clearTimeout(timerId));
        };

    }, [assistants, getStatusAction]);

    return { statuses };
}