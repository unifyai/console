import { ResponseProps } from "@/types/common";
import { GroupedLogPropsRaw, LogItemProps, LogsResponseProps } from "@/types/interfaces/logs";

export const getTasks = async (apiKey: string, userContext: string) => {
    return async (assistantContext: string, filterExpression: string | null, limit: number | null, offset: number | null): Promise<LogsResponseProps | ResponseProps> => {
        "use server";

        try {

            let url = `${process.env.NEXTAUTH_URL}/api/logs?project_name=Assistants&context=${userContext}/${assistantContext}/Tasks`;
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
                    console.error(`[task.ts getTasks] Received non-JSON response with status ${response.status}`);
                    return { detail: "Received an invalid response from the server." };
                }
            } catch (parseError) {
                console.error(`[task.ts getTasks] Failed to parse JSON response ${parseError}`);
                return { detail: "Received an invalid response from the server." };
            }


            if (!response.ok) {
                const errorMessage = data.detail || `Failed to get tasks: ${response.statusText}`;
                return { detail: errorMessage };
            }

            return data as LogsResponseProps

        } catch (error) {
            console.error(`[task.ts getTasks] Error fetching tasks:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }

    };
};

export const getUniqueFieldValues = async (apiKey: string, userContext: string) => {
    return async (assistantContext: string, groupByField: string): Promise<string[] | ResponseProps> => {
        "use server";

        try {
            let url = `${process.env.NEXTAUTH_URL}/api/logs?project_name=Assistants&context=${userContext}/${assistantContext}/Tasks`;
            url += `&group_by=${encodeURIComponent(groupByField)}`;
            url += `&group_depth=0`;

            const response = await fetch(
                url,
                { method: "GET", headers: { apiKey: apiKey } },
            );

            let data: LogsResponseProps | ResponseProps;
            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    data = await response.json();
                } else {
                    console.error(`[task.ts getTaskGroups] Received non-JSON response with status ${response.status}`);
                    return { detail: "Received an invalid response from the server." };
                }
            } catch (parseError) {
                console.error(`[task.ts getTaskGroups] Failed to parse JSON response: ${parseError}`);
                return { detail: "Received an invalid response from the server." };
            }

            if (!response.ok) {
                const errorMessage = (data as ResponseProps).detail || `Failed to get task groups for ${groupByField}: ${response.statusText}`;
                return { detail: errorMessage };
            }

            const groupData = ((
                (data as LogsResponseProps)
                    .logs as GroupedLogPropsRaw
                        )?.[groupByField] as {group: {key: string, value: number}[], group_count: number, count: number}
                            )?.group;

            if (groupData && Array.isArray(groupData)) {
                // Filter out null/undefined keys and ensure uniqueness
                const uniqueKeys = Array.from(new Set(groupData.flatMap(item => item.key).filter(key => key != null)));
                return uniqueKeys;
            } else {
                console.warn(`[task.ts getTaskGroups] Response format unexpected or missing group data for field '${groupByField}'. Data:`, data);
                // Return empty array if structure is not as expected but response was OK
                return [];
            }

        } catch (error) {
            console.error(`[task.ts getTaskGroups] Error fetching task groups for ${groupByField}:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }
    };
};

export const updateTask = async (apiKey: string, userContext: string) => {
    return async (assistantContext: string, logs: number[], entries: LogItemProps): Promise<ResponseProps> => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/logs`,
                {
                    method: "PUT",
                    headers: { 
                        apiKey: apiKey,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        logs: logs,
                        project_name: "Assistants",
                        context: `${userContext}/${assistantContext}/Tasks`,
                        params: {},
                        entries: entries,
                        overwrite: true
                    })
                }
            );

            let data;
            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    data = await response.json();
                } else {
                    console.error(`[task.ts updateTask] Received non-JSON response with status ${response.status}`);
                    return { detail: "Received an invalid response from the server." };
                }
            } catch (parseError) {
                console.error(`[task.ts updateTask] Failed to parse JSON response ${parseError}`);
                return { detail: "Received an invalid response from the server." };
            }

            if (!response.ok) {
                const errorMessage = data.detail || `Failed to update tasks ${logs}: ${response.statusText}`;
                return { detail: errorMessage };
            }

            const successMessage = data.info || `Tasks ${logs} successfully updated.`;
            return { info: successMessage }

        } catch (error) {
            console.error(`[task.ts updateTask] Error updating task ${logs}:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }

    }
}