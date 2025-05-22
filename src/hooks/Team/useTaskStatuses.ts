import * as React from 'react';
import { TaskActions } from '@/types/team/task';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';

export function useTaskStatuses(taskActions: TaskActions) {
    const [availableStatuses, setAvailableStatuses] = React.useState<string[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const fetchStatuses = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setAvailableStatuses([]);

        try {
            const result = await taskActions.unique('status'); // Assuming 'status' is a valid key
            if (Array.isArray(result)) {
                const uniqueStatuses = [...Array.from(new Set(result.filter(s => s != null)))];
                setAvailableStatuses(uniqueStatuses);
            } else {
                const errorResult = result as ResponseProps;
                throw new Error(errorResult.detail || "Failed to fetch statuses.");
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "An unknown error occurred fetching statuses.";
            setError(errorMsg);
            setAvailableStatuses([]);
            console.error("[useTaskStatuses.ts] Status fetch error in hook:", errorMsg);
            toast.error(`Failed to load task statuses`);
        } finally {
            setIsLoading(false);
        }
    }, [taskActions]);

    React.useEffect(() => {
        fetchStatuses();
    }, [fetchStatuses]);

    return { availableStatuses, isLoading, error, refreshStatuses: fetchStatuses };
}