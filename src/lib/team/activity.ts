import { ResponseProps } from "@/types/common";
import { LogsResponseProps } from "@/types/evals/logs";

export const getMessages = async (apiKey: string) => {
    return async (filterExpression: string | null, limit: number | null, offset: number | null): Promise<LogsResponseProps | ResponseProps> => {
        "use server";

        try {
            let url = `${process.env.NEXTAUTH_URL}/api/logs?project=Unity&context=Events/Messages`;
            if (filterExpression) {
                url += `&filter_expr=${encodeURIComponent(filterExpression)}`;
            }
            if (limit !== null) {
                url += `&limit=${limit}`;
            }
            if (offset !== null) {
                url += `&offset=${offset}`;
            }
            
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
                    console.error(`[activity.ts getMessages] Received non-JSON response with status ${response.status}`);
                    return { detail: "Received an invalid response from the server (activity logs)." };
                }
            } catch (parseError) {
                console.error(`[activity.ts getMessages] Failed to parse JSON response ${parseError}`);
                return { detail: "Received an invalid response from the server (activity logs parsing)." };
            }

            if (!response.ok) {
                const errorMessage = data.detail || `Failed to get messages: ${response.statusText}`;
                return { detail: errorMessage };
            }

            return data as LogsResponseProps;

        } catch (error) {
            console.error(`[activity.ts getMessages] Error fetching messages:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred while fetching messages.";
            return { detail: errorMessage };
        }
    };
};