import { ResponseProps } from "@/types/common";
import { LogProps, LogsResponseProps } from "@/types/interfaces/logs";
import { ActivitySummary } from "@/types/assistants/activity";

export const getActivitySummary = async (apiKey: string) => {
    return async (assistant_id: string): Promise<ActivitySummary | ResponseProps> => {
        "use server";

        try {
            let url = `${process.env.NEXTAUTH_URL}/api/logs?project=Assistants&context=${assistant_id}/RollingActivity`;
            
            const response = await fetch(
                url,
                { method: "GET", headers: { apiKey: apiKey } },
            );

            let data;
            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    data = await response.json();
                } else {
                    console.error(`[activity.ts getActivitySummary] Received non-JSON response with status ${response.status}`);
                    return { detail: "Received an invalid response from the server (activity summary)." };
                }
            } catch (parseError) {
                console.error(`[activity.ts getActivitySummary] Failed to parse JSON response ${parseError}`);
                return { detail: "Received an invalid response from the server (activity summary parsing)." };
            }

            if (!response.ok) {
                const errorMessage = data.detail || `Failed to get activity summary: ${response.statusText}`;
                return { detail: errorMessage };
            }

            const logsResponse = data as LogsResponseProps;
            const logs = logsResponse.logs as LogProps[];
            const latestLog = logs?.[0];

            if (latestLog && latestLog.entries && typeof latestLog.entries.time_based_activity === 'string') {
                return {
                    summary: latestLog.entries.time_based_activity,
                };
            }
            
            // If no log is found, it's not an error. Return a default message.
            return { summary: "No recent activity recorded." };

        } catch (error) {
            console.error(`[activity.ts getActivitySummary] Error fetching summary:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred while fetching activity summary.";
            return { detail: errorMessage };
        }
    };
};