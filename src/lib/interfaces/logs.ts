"use server";

import { LogFieldsProps, LogItemProps, getLogsParameters } from "@/types/interfaces/logs";
import { sanitizeKey } from "../../app/(home)/interfaces/utils";
import { ResponseProps } from "@/types/common";

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
    return async (project: string, context: string | null, columnContext: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, groupSortingExpression: string | null, from_ids: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number | null, group_limit: number | null, group_offset: number | null, group_depth: number | null, return_ids_only: string | null, randomize: string | null, _timestamp: string | null, signal?: AbortSignal) => {
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
                + (group_limit ? `&group_limit=${group_limit}` : "")
                + (group_offset ? `&group_offset=${group_offset}` : "")
                + (group_depth !== null && group_depth !== undefined ? `&group_depth=${group_depth}` : "")
                + (return_ids_only ? `&return_ids_only=${return_ids_only}` : "")
                + (randomize ? `&randomize=${randomize}` : ""),
                { method: "GET", headers: { apiKey: apiKey }, next: { tags: [`logs_${_timestamp}`] }, signal },
            );
            
            // Handle 404 - context not found
            if (response.status === 404) {
                console.warn(`[getLogs] Context not found: ${context} in project ${project}`);
                return { params: {}, logs: [], count: 0, groups: [], contextNotFound: true };
            }
            
            const json = await response.json();
            if (!response.ok)
                return { params: {}, logs: [], count: 0, groups: [], detail: json.detail };
            return await json;
        } catch (e: any) {
            console.log(`Failed to get logs error: ${e?.message || e}`)
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
            // Validate inputs before sending to server to avoid 400s
            if (!project || typeof project !== 'string' || project.trim() === '') {
                return { detail: "Missing 'project' when updating logs." };
            }
            const isValidLogsArray = Array.isArray(logs) && logs.length > 0 && logs.every((id) => Number.isInteger(id));
            if (!isValidLogsArray) {
                return { detail: "Invalid 'logs' payload. Expected a non-empty array of integer IDs." };
            }
            const hasEntries = entries && Object.keys(entries).length > 0;
            const hasParams = params && Object.keys(params).length > 0;
            if (!hasEntries && !hasParams) {
                return { detail: "No changes provided. 'entries' or 'params' must include at least one field to update." };
            }

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
    return async (project: string, context: string | null, signal?: AbortSignal) => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/logs/fields?project=${project}`
                + (context ? `&context=${context}` : ""),
                { method: "GET", headers: { apiKey: apiKey }, signal }
            );
            
            // Return empty object for 404 (context not found) or other errors
            if (response.status === 404) {
                console.warn(`[getLogFields] Context not found: ${context}`);
                return {};
            }
            if (!response.ok) {
                console.error(`[getLogFields] Error: ${response.status}`);
                return {};
            }
            
            return await response.json();
        } catch (e) {
            console.error(`[getLogFields] Network error:`, e);
            return {};
        }
    };
};

// rename log field
export const renameLogFields = async (apiKey: string) => {
    return async (
        project: string,
        context: string | null,
        oldFieldName: string,
        newFieldName: string
    ): Promise<ResponseProps> => {
        "use server";

        try {
            const response = await fetch(
                `${process.env.NEXTAUTH_URL}/api/logs/fields`,
                {
                    method: "PATCH",
                    headers: {
                        apiKey: apiKey,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        project,
                        context,
                        old_field_name: oldFieldName,
                        new_field_name: newFieldName,
                    }),
                }
            );
            return await response.json();
        } catch (error) {
            console.error(`[actions.ts renameLogField] Error renaming field ${oldFieldName} -> ${newFieldName}:`, error);
            return { detail: "Failed to rename log field. Please try again." };
        }
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
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok) {
            let detail = `${response.status} ${response.statusText}`;
            if (contentType.includes("application/json")) {
                try {
                    const j = await response.json();
                    if (j?.detail) detail = j.detail;
                } catch { /* ignore parse errors */ }
            }
            throw new Error(`Upstream error: ${detail}`);
        }
        if (!contentType.includes("application/json")) {
            throw new Error(`Upstream error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }
};

// get latest timestamp
export const getLatestTimestamp = async (apiKey: string) => {
    return async (project: string, context: string | null, columnContext: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, groupSortingExpression: string | null, from_ids: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number | null, group_depth: number | null, return_ids_only: string | null, randomize: string | null, _timestamp: string | null, signal?: AbortSignal) => {
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
            { method: "GET", headers: { apiKey: apiKey }, signal }
        );
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok) {
            let detail = `${response.status} ${response.statusText}`;
            if (contentType.includes("application/json")) {
                try {
                    const j = await response.json();
                    if (j?.detail) detail = j.detail;
                } catch { /* ignore */ }
            }
            throw new Error(`Upstream error: ${detail}`);
        }
        if (!contentType.includes("application/json")) {
            throw new Error(`Upstream error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    };
};

// delete logs
export const deleteLogs = async (apiKey: string) => {
    return async (project: string, context: string | null, ids_and_fields: LogFieldsProps) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ project, context, ids_and_fields, source_type: "all", delete_empty_logs: true, delete_empty_fields: true })
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
