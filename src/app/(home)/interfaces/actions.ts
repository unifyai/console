"use server";

import { TileProps } from "@/types/evals/grid";
import { LogFieldsProps, LogItemProps, getLogsParameters } from "@/types/evals/logs";
import { sanitizeKey } from "./utils";
import { ResponseProps } from "@/types/common";

// create project
export const createProject = async (apiKey: string) => {
    return async (name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/projects`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ name: name })
            }
        );
        return await response.json();
    };
};


// get projects
export const getProjects = async (apiKey: string) => {
    return async () => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/projects`,
            { method: "GET", headers: { apiKey: apiKey }, cache: "no-store" }
        );
        return await response.json();
    };
};

// rename project
export const renameProject = async (apiKey: string) => {
    return async (oldName: string, newName: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/projects/${oldName}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ name: newName })
            }
        );
        return await response.json();
    };
};

// delete project
export const deleteProject = async (apiKey: string) => {
    return async (name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/projects/${name}`,
            { method: "DELETE", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

// create logs
export const createLogs = async (apiKey: string) => {
    return async (
        project: string,
        context: string | null,
        params: { [param: string]: string }[],
        entries: { [entry: string | number]: string }[]
    ) => {
        "use server";

        const contextBody = context ? { context: { name: context } } : {};
        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ project, ...contextBody, params, entries })
            }
        );
        return await response.json();
    }
}

// get logs
export const getLogs = async (apiKey: string) => {
    return async (project: string, context: string | null, columnContext: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, groupSortingExpression: string | null, from_ids: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number | null, group_depth: number | null, return_ids_only: string | null, _timestamp: string | null) => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/logs?project=${project}`
                + (context ? `&context=${context}` : "")
                + (columnContext ? `&column_context=${columnContext}` : "")
                + (filterExpression ? `&filter_expr=${encodeURIComponent(filterExpression)}` : "")
                + (sortingExpression ? `&sorting=${encodeURIComponent(sortingExpression)}` : "")
                + (groupingExpression 
                    ? groupingExpression
                        .split(",")  // Split into individual grouping expressions
                        .map(expr => `&group_by=${encodeURIComponent(expr.trim())}`) // Encode separately
                        .join("")  // Concatenate each `group_by` separately
                    : "")
                + (groupSortingExpression ? `&group_sorting=${encodeURIComponent(groupSortingExpression)}` : "")
                + (from_ids ? `&from_ids=${encodeURIComponent(from_ids)}` : "")
                + (from_fields ? `&from_fields=${encodeURIComponent(from_fields)}` : "")
                + (exclude_fields ? `&exclude_fields=${encodeURIComponent(exclude_fields)}` : "")
                + (limit ? `&limit=${limit}` : "")
                + (offset ? `&offset=${offset}` : "")
                + (group_depth !== null && group_depth !== undefined ? `&group_depth=${group_depth}` : "")
                + (return_ids_only ? `&return_ids_only=${return_ids_only}` : ""),
                { method: "GET", headers: { apiKey: apiKey }, next: { tags: [`logs_${_timestamp}`] } },
            );
            const json = await response.json();
            if (!response.ok)
                return { params: {}, logs: [], count: 0, groups: [], detail: json.detail };
            return await json;
        } catch (e) {
            console.log(`Failed to get logs error: ${e}`)
            return {"params":{},"logs":[],"count":0, "groups": []}
        }
    };
};

// update log
export const updateLogs = async (apiKey: string) => {
    return async (
        project: string,
        context: string | null,
        logs: number[],
        entries: LogItemProps,
        params:  LogItemProps,
        overwrite: boolean = true
    ): Promise<ResponseProps> => {
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
                    body: JSON.stringify({ logs, project, context, params, entries, overwrite })
                }
            );

            let data;
            try {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    data = await response.json();
                } else {
                    console.error(`[actions.ts updateLog] Received non-JSON response with status ${response.status}`);
                    return { detail: "Received an invalid response from the server." };
                }
            } catch (parseError) {
                console.error(`[actions.ts updateLog] Failed to parse JSON response ${parseError}`);
                return { detail: "Received an invalid response from the server." };
            }

            if (!response.ok) {
                const errorMessage = data.detail || `Failed to update logs ${logs}: ${response.statusText}`;
                return { detail: errorMessage };
            }

            const successMessage = data.info || `Tasks ${logs} successfully updated.`;
            return { info: successMessage }

        } catch (error) {
            console.error(`[actions.ts updateLog] Error updating log ${logs}:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
            return { detail: errorMessage };
        }
    };
};

// get log fields
export const getLogFields = async (apiKey: string) => {
    return async (project: string, context: string | null) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs/fields?project=${project}`
            + (context ? `&context=${context}` : ""),
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

export const getLogMetrics = async (apiKey: string) => {
    return async (
        project: string,
        context: string | null,
        filterExpression: string | null,
        groupingExpression: string | null,
        metricName: string,
        keyNames: string[]
    ) => {
        "use server";

        // Sanitize the keyName before using it in the request
        const sanitizedKeyNames = keyNames.map(sanitizeKey);

        const response = await fetch(
            (
                `${process.env.NEXTAUTH_URL}/api/logs/${metricName}?project=${project}`
                + (context ? `&context=${context}` : "")
                + `&key=${JSON.stringify(sanitizedKeyNames)}`
                + (filterExpression ? `&filter_expr=${encodeURIComponent(filterExpression)}` : "")
                + (groupingExpression ? `&group_by=${encodeURIComponent(JSON.stringify(groupingExpression.split(",")))}` : "")
            ),
            { method: "GET", headers: { apiKey: apiKey } }
        );

        if (!response.ok) {
            console.error(response);
            throw new Error("Network error");
        }

        return await response.json();
    }
};

// get latest timestamp
export const getLatestTimestamp = async (apiKey: string) => {
    return async (project: string, context: string | null, columnContext: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, groupSortingExpression: string | null, from_ids: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number | null, group_depth: number | null) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs/latest_timestamp?project=${project}`
            + (context ? `&context=${context}` : "")
            + (columnContext ? `&column_context=${columnContext}` : "")
            + (filterExpression ? `&filter_expr=${encodeURIComponent(filterExpression)}` : "")
            + (sortingExpression ? `&sorting=${encodeURIComponent(sortingExpression)}` : "")
            + (groupingExpression 
                ? groupingExpression
                    .split(",")  // Split into individual grouping expressions
                    .map(expr => `&group_by=${encodeURIComponent(expr.trim())}`) // Encode separately
                    .join("")  // Concatenate each `group_by` separately
                : "")
            + (groupSortingExpression ? `&group_sorting=${encodeURIComponent(groupSortingExpression)}` : "")
            + (from_ids ? `&from_ids=${encodeURIComponent(from_ids)}` : "")
            + (from_fields ? `&from_fields=${encodeURIComponent(from_fields)}` : "")
            + (exclude_fields ? `&exclude_fields=${encodeURIComponent(exclude_fields)}` : "")
            + (limit ? `&limit=${limit}` : "")
            + (offset ? `&offset=${offset}` : "")
            + (group_depth !== null && group_depth !== undefined ? `&group_depth=${group_depth}` : ""),
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

// delete logs
export const deleteLogs = async (apiKey: string) => {
    return async (project: string, context: string | null, ids_and_fields: LogFieldsProps, source_type: string | null = "all") => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ project, context, ids_and_fields, source_type })
            }
        );
        return await response.json();
    };
};

// create derived entry
export const createDerivedEntry = async (apiKey: string) => {
    return async (project: string, context: string | undefined, key: string, equation: string, referenced_logs: {[table_name: string]: getLogsParameters}): Promise<ResponseProps> => {
        "use server";

        try {
            const context_body = context ? { context: context } : {};
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/logs/derived`,
                {
                    method: "POST",
                    headers: { apiKey: apiKey },
                    body: JSON.stringify({ project, ...context_body, key, equation, referenced_logs })
                }
            );
            return await response.json();
        } catch (e) {
            console.log(`Failed to create derived entry with error: ${e}`)
            return {detail: "Failed to create derived entry, please try again."}
        }
    }
}

// update derived entry
export const updateDerivedEntry = async (apiKey: string) => {
    return async (project: string, context: string | undefined, key: string | null, equation: string | null, target_derived_logs: {[table_name: string]: getLogsParameters}): Promise<ResponseProps> => {
        "use server";

        try {
            const context_body = context ? { context: context } : {};
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/logs/derived`,
                {
                    method: "PUT",
                    headers: { apiKey: apiKey },
                    body: JSON.stringify({ project, ...context_body, key, equation, target_derived_logs })
                }
            );
            return await response.json();
        } catch (e) {
            console.log(`Failed to update derived entry with error: ${e}`)
            return {detail: "Failed to update derived entry, please try again."}
        }
    }
}

// create interface
export const createInterface = async (apiKey: string) => {
    return async (name: string, project: string, context: string | undefined, items: TileProps[], new_counter: number, temporary: boolean = false, color: string | undefined) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ name, project, context: context || null, items, new_counter, temporary, color: color || null })
            }
        );
        return await response.json();
    };
};

// get interface
export const getInterface = async (apiKey: string) => {
    return async (project: string, temporary: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?temporary=${temporary}&project=${project}`,
            { method: "GET", headers: { apiKey: apiKey }, cache: "no-store" }
        );
        if (!response.ok)
            return null;
        return await response.json();
    };
};

// update interface
export const updateInterface = async (apiKey: string) => {
    return async (name: string, project: string, context: string | undefined, items: TileProps[], new_counter: number, new_name: string | undefined = undefined, temporary: boolean = false, color: string | undefined) => {
        "use server";
        const body = { name, project, context: context || null, items, new_counter, temporary, color: color || null };
        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(new_name ? {...body, new_name} : body)
            },
        );
        return await response.json();
    };
};

// delete interface
export const deleteInterface = async (apiKey: string) => {
    return async (name: string, project: string, temporary: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?name=${name}&project=${project}&temporary=${temporary}`,
            { method: "DELETE", headers: { apiKey: apiKey } },
        );
        return await response.json();
    };
};

// get contexts
export const getContexts = async (apiKey: string) => {
    return async (project: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/context/${project}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
            }
        );
        return await response.json();
    };
};

// create context
export const createContext = async (apiKey: string) => {
    return async (name: string, project: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/context/${project}`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ name })
            }
        );
        return await response.json();
    };
};

// delete context
export const deleteContext = async (apiKey: string) => {
    return async (project: string, context: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/context/${project}/${encodeURIComponent(context)}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey }
            }
        );
        return await response.json();
    };
};

// get devbox
export const getDevbox = async (apiKey: string, userId: string) => {
    return async () => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/devbox?user_id=${userId}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            console.error(response);
            throw new Error("Network error");
        }
        return responseJson;
    }
}

// create devbox
export const createDevbox = async (apiKey: string, userId: string) => {
    return async () => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/devbox`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ user_id: userId })
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            console.error(response);
            throw new Error("Network error");
        }
        return responseJson;
    }
}

// run code
export const runCode = async (apiKey: string, userId: string) => {
    return async (files: { [fileName: string]: string }, filePath: string, project: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/code`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ user_id: userId, files, file_path: filePath, project })
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            throw new Error(responseJson.detail || "Network error");
        }
        return responseJson;
    }
}
