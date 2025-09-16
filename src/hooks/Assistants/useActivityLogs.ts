import * as React from 'react';
import { ActivityLogActions, ActivitySummary } from '@/types/assistants/activity';
import { toast } from 'sonner';

export function useActivityLogs(
    activityLogActions: ActivityLogActions,
    assistantId: string | null
) {
    const [summary, setSummary] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    
    React.useEffect(() => {
        if (!assistantId) {
            setSummary(null);
            setIsLoading(false);
            setError(null);
            return;
        }

        const fetchSummary = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await activityLogActions.get(assistantId);
                if ('detail' in response) {
                    throw new Error(response.detail);
                }
                const summaryData = response as ActivitySummary;
                setSummary(summaryData.summary);
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : "An unknown error occurred.";
                setError(errorMsg);
                setSummary(null);
                console.error("Activity summary fetch error:", errorMsg);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSummary();

    }, [activityLogActions, assistantId]);

    return {
        summary,
        isLoading,
        error,
    };
}