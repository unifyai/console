"use server";

import { TileProps } from "@/types/evals/grid";
import { LogFieldsProps, LogItemProps, getLogsParameters } from "@/types/evals/logs";
import { sanitizeKey } from "./utils";
import { ResponseProps } from "@/types/common";
import { TilePosition, TableTileData, PlotTileData, ViewTileData, EditorTileData, TerminalTileData } from "@/types/evals/grid";

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
    return async (project: string, filePath: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/code`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ user_id: userId, file_path: filePath, project })
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            throw new Error(responseJson.detail || "Network error");
        }
        return responseJson;
    }
}

// run terminal
export const createTerminalSession = async (apiKey: string, userId: string) => {
    return async (
        shell: string = "bash",
        cwd: string = "/project/sandbox"
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/code/terminal`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({
                    user_id: userId,
                    shell,
                    cwd
                })
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            throw new Error(responseJson.detail || "Network error");
        }
        return responseJson; // { session_id, shell, cwd }
    };
};

export const runTerminalCommand = async (apiKey: string) => {
    return async (
        sessionId: string,
        command: string
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/code/terminal`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify({
                    session_id: sessionId,
                    command
                })
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            throw new Error(responseJson.detail || "Network error");
        }
        return responseJson; // { exitCode, output }
    };
};

export const getTerminalOutput = async (apiKey: string) => {
    return async (sessionId: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/code/terminal?session_id=${sessionId}`,
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    }
}

export const stopTerminalSession = async (apiKey: string) => {
    return async (sessionId: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/code/terminal`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ session_id: sessionId })
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            throw new Error(responseJson.detail || "Network error");
        }
        return responseJson; // { detail: "Session terminated" }
    };
};

// ----- NEW GRANULAR API ACTIONS -----
// List interfaces
export const listInterfaces = async (apiKey: string) => {
    return async (projectId: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?project=${projectId}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to list interfaces: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Get interface by name
export const getInterfaceByName = async (apiKey: string) => {
    return async (projectId: string, name: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?project=${projectId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to get interface: ${response.status}` };
        }
        
        const interfaces = await response.json();
        return interfaces.length > 0 ? interfaces[0] : null;
    };
};

// Get interface by ID
export const getInterfaceById = async (apiKey: string) => {
    return async (interface_id: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?interface_id=${interface_id}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        
        if (!response.ok) {
            return null;
        }
        
        return await response.json();
    };
};

// Unified get interface function that accepts either ID or path
export const getInterfaceUnified = async (apiKey: string) => {
    return async (params: { 
        interface_id?: string; 
        project?: string; 
        name?: string; 
        checkpoint?: boolean 
    }) => {
        "use server";
        
        const { interface_id, project, name, checkpoint = false } = params;
        
        // If interface ID is provided, use it directly
        if (interface_id) {
            const getById = await getInterfaceById(apiKey);
            return getById(interface_id, checkpoint);
        }
        
        // Otherwise use project+name
        if (project && name) {
            const getByName = await getInterfaceByName(apiKey);
            return getByName(project, name, checkpoint);
        }
        
        return null;
    };
};

// Create interface (new version)
export const createNewInterface = async (apiKey: string) => {
    return async (projectId: string, name: string, color?: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({
                    project: projectId,
                    name,
                    color
                }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create interface: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Update interface by name
export const updateInterfaceByName = async (apiKey: string) => {
    return async (projectId: string, name: string, data: { name?: string, active_tab_id?: string, color?: string }, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?project=${projectId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to update interface: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Update interface by ID
export const updateInterfaceById = async (apiKey: string) => {
    return async (
        interface_id: string,
        data: {
            name?: string,
            active_tab_id?: string,
            color?: string
        },
        checkpoint: boolean = false
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?interface_id=${interface_id}&checkpoint=${checkpoint}`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to update interface: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified update interface function that accepts either ID or path
export const updateInterfaceUnified = async (apiKey: string) => {
    return async (params: { 
        interface_id?: string; 
        project?: string; 
        name?: string; 
        data: {
            name?: string;
            active_tab_id?: string;
            color?: string;
        };
        checkpoint?: boolean;
    }) => {
        "use server";
        
        const { interface_id, project, name, data, checkpoint = false } = params;
        
        // If interface ID is provided, use it directly
        if (interface_id) {
            const updateById = await updateInterfaceById(apiKey);
            return updateById(interface_id, data, checkpoint);
        }
        
        // Otherwise use project+name
        if (project && name) {
            const updateByName = await updateInterfaceByName(apiKey);
            return updateByName(project, name, data, checkpoint);
        }
        
        return { error: "Missing required parameters to identify the interface" };
    };
};

// Delete interface by name
export const deleteInterfaceByName = async (apiKey: string) => {
    return async (projectId: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?project=${projectId}&name=${encodeURIComponent(name)}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to delete interface: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Delete interface by ID
export const deleteInterfaceById = async (apiKey: string) => {
    return async (interface_id: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?interface_id=${interface_id}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to delete interface: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified delete interface function that accepts either ID or path
export const deleteInterfaceUnified = async (apiKey: string) => {
    return async (params: { 
        interface_id?: string; 
        project?: string; 
        name?: string; 
    }) => {
        "use server";
        
        const { interface_id, project, name } = params;
        
        // If interface ID is provided, use it directly
        if (interface_id) {
            const deleteById = await deleteInterfaceById(apiKey);
            return deleteById(interface_id);
        }
        
        // Otherwise use project+name
        if (project && name) {
            const deleteByName = await deleteInterfaceByName(apiKey);
            return deleteByName(project, name);
        }
        
        return { error: "Missing required parameters to identify the interface" };
    };
};

// Create checkpoint for interface by name
export const createInterfaceCheckpoint = async (apiKey: string) => {
    return async (projectId: string, name: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface/checkpoint?project=${projectId}&name=${encodeURIComponent(name)}`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ description }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create checkpoint: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Create checkpoint for interface by ID
export const createInterfaceCheckpointById = async (apiKey: string) => {
    return async (interface_id: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface/checkpoint?interface_id=${interface_id}`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ description }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create checkpoint: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified create checkpoint for interface function that accepts either ID or path
export const createInterfaceCheckpointUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        project?: string; 
        name?: string;
        description: string 
    }) => {
        "use server";
        
        const { id, project, name, description } = params;
        
        // If interface ID is provided, use it directly
        if (id) {
            const checkpointById = await createInterfaceCheckpointById(apiKey);
            return checkpointById(id, description);
        }
        
        // Otherwise use project+name
        if (project && name) {
            const checkpointByName = await createInterfaceCheckpoint(apiKey);
            return checkpointByName(project, name, description);
        }
        
        return { error: "Missing required parameters to identify the interface" };
    };
};

// ----- TAB ACTIONS WITH OPENAPI PATTERN -----

// List tabs in interface
export const listTabs = async (apiKey: string) => {
    return async (interface_id: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?interface_id=${interface_id}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to list tabs: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Get tab by name
export const getTabByName = async (apiKey: string) => {
    return async (interface_id: string, name: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?interface_id=${interface_id}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to get tab: ${response.status}` };
        }
        
        const tabs = await response.json();
        return tabs.length > 0 ? tabs[0] : null;
    };
};

// Get tab by ID
export const getTabById = async (apiKey: string) => {
    return async (id: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?tab_id=${id}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        
        if (!response.ok) {
            return null;
        }
        
        return await response.json();
    };
};

// Unified get tab function that accepts either ID or path
export const getTabUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        interface_id?: string; 
        name?: string; 
        checkpoint?: boolean 
    }) => {
        "use server";
        
        const { id, interface_id, name, checkpoint = false } = params;
        
        // If tab ID is provided, use it directly
        if (id) {
            const getById = await getTabById(apiKey);
            return getById(id, checkpoint);
        }
        
        // Otherwise use interface_id+name
        if (interface_id && name) {
            const getByName = await getTabByName(apiKey);
            return getByName(interface_id, name, checkpoint);
        }
        
        return null;
    };
};

// Create tab
export const createTab = async (apiKey: string) => {
    return async (interface_id: string, name: string, data: {
        visible?: boolean,
        active?: boolean,
        order?: number,
        global_context?: string,
        color?: string
    },
    tab_id?: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({
                    interface_id,
                    name,
                    tab_id,
                    ...data
                }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create tab: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Update tab by name
export const updateTabByName = async (apiKey: string) => {
    return async (interface_id: string, name: string, data: {
        name?: string,
        visible?: boolean,
        active?: boolean,
        order?: number,
        global_context?: string,
        color?: string
    }, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?interface_id=${interface_id}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to update tab: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Update tab by ID
export const updateTabById = async (apiKey: string) => {
    return async (id: string, data: {
        name?: string,
        visible?: boolean,
        active?: boolean,
        order?: number,
        global_context?: string,
        color?: string
    }, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?tab_id=${id}&checkpoint=${checkpoint}`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to update tab: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified update tab function
export const updateTabUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        interface_id?: string; 
        name?: string; 
        data: {
            name?: string;
            visible?: boolean;
            active?: boolean;
            order?: number;
            global_context?: string;
            color?: string;
        };
        checkpoint?: boolean;
    }) => {
        "use server";
        
        const { id, interface_id, name, data, checkpoint = false } = params;
        
        // If tab ID is provided, use it directly
        if (id) {
            const updateById = await updateTabById(apiKey);
            return updateById(id, data, checkpoint);
        }
        
        // Otherwise use interface_id+name
        if (interface_id && name) {
            const updateByName = await updateTabByName(apiKey);
            return updateByName(interface_id, name, data, checkpoint);
        }
        
        return { error: "Missing required parameters to identify the tab" };
    };
};

// Delete tab by name
export const deleteTabByName = async (apiKey: string) => {
    return async (interface_id: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?interface_id=${interface_id}&name=${encodeURIComponent(name)}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to delete tab: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Delete tab by ID
export const deleteTabById = async (apiKey: string) => {
    return async (id: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?tab_id=${id}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to delete tab: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified delete tab function
export const deleteTabUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        interface_id?: string; 
        name?: string; 
    }) => {
        "use server";
        
        const { id, interface_id, name } = params;
        
        // If tab ID is provided, use it directly
        if (id) {
            const deleteById = await deleteTabById(apiKey);
            return deleteById(id);
        }
        
        // Otherwise use interface_id+name
        if (interface_id && name) {
            const deleteByName = await deleteTabByName(apiKey);
            return deleteByName(interface_id, name);
        }
        
        return { error: "Missing required parameters to identify the tab" };
    };
};

// Create checkpoint for tab by name
export const createTabCheckpointByName = async (apiKey: string) => {
    return async (interface_id: string, name: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab/checkpoint?interface_id=${interface_id}&name=${encodeURIComponent(name)}`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ description }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create checkpoint: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Create checkpoint for tab by ID
export const createTabCheckpointById = async (apiKey: string) => {
    return async (id: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab/checkpoint?tab_id=${id}`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ description }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create checkpoint: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified create checkpoint for tab function
export const createTabCheckpointUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        interface_id?: string; 
        name?: string;
        description: string 
    }) => {
        "use server";
        
        const { id, interface_id, name, description } = params;
        
        // If tab ID is provided, use it directly
        if (id) {
            const checkpointById = await createTabCheckpointById(apiKey);
            return checkpointById(id, description);
        }
        
        // Otherwise use interface_id+name
        if (interface_id && name) {
            const checkpointByName = await createTabCheckpointByName(apiKey);
            return checkpointByName(interface_id, name, description);
        }
        
        return { error: "Missing required parameters to identify the tab" };
    };
};

// ----- TILE ACTIONS WITH OPENAPI PATTERN -----

// List tiles in tab
export const listTiles = async (apiKey: string) => {
    return async (tab_id: string, type?: string, checkpoint: boolean = false) => {
        "use server";

        let url = `${process.env.NEXTAUTH_URL}/api/tile?tab_id=${tab_id}&checkpoint=${checkpoint}`;
        if (type) {
            url += `&type=${type}`;
        }

        const response = await fetch(url, {
            method: "GET",
            headers: { apiKey: apiKey },
            cache: "no-store",
        });
        
        if (!response.ok) {
            return { error: `Failed to list tiles: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Get tile by name
export const getTileByName = async (apiKey: string) => {
    return async (tab_id: string, name: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tab_id=${tab_id}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to get tile: ${response.status}` };
        }
        
        const tiles = await response.json();
        return tiles.length > 0 ? tiles[0] : null;
    };
};

// Get tile by ID
export const getTileById = async (apiKey: string) => {
    return async (id: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tile_id=${id}&checkpoint=${checkpoint}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return null;
        }
        
        return await response.json();
    };
};

// Unified get tile function
export const getTileUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        tab_id?: string; 
        name?: string; 
        checkpoint?: boolean 
    }) => {
        "use server";
        
        const { id, tab_id, name, checkpoint = false } = params;
        
        // If tile ID is provided, use it directly
        if (id) {
            const getById = await getTileById(apiKey);
            return getById(id, checkpoint);
        }
        
        // Otherwise use tab_id+name
        if (tab_id && name) {
            const getByName = await getTileByName(apiKey);
            return getByName(tab_id, name, checkpoint);
        }
        
        return null;
    };
};

// Create tile
export const createTile = async (apiKey: string) => {
    return async (
        tab_id: string, 
        name: string, 
        position: TilePosition,
        data: {
            minW?: number;
            minH?: number;
            visible?: boolean;
            locked?: boolean;
            moved?: boolean;
            static?: boolean;
            color?: string;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            column_context?: string;
            grouping?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
            terminal_tile?: TerminalTileData;
        },
        tile_id?: string,
        type?: string
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({
                    tab_id,
                    name,
                    position,
                    type,
                    tile_id,
                    ...data
                }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Update tile by name
export const updateTileByName = async (apiKey: string) => {
    return async (
        tab_id: string,
        name: string,
        data: {
            name?: string;
            position?: TilePosition;
            type?: string;
            minW?: number;
            minH?: number;
            visible?: boolean;
            locked?: boolean;
            color?: string;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            column_context?: string;
            grouping?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
            terminal_tile?: TerminalTileData;
        },
        checkpoint: boolean = false
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tab_id=${tab_id}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to update tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Update tile by ID
export const updateTileById = async (apiKey: string) => {
    return async (
        id: string,
        data: {
            name?: string;
            position?: TilePosition;
            type?: string;
            minW?: number;
            minH?: number;
            visible?: boolean;
            locked?: boolean;
            color?: string;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            column_context?: string;
            grouping?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
            terminal_tile?: TerminalTileData;
        },
        checkpoint: boolean = false
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tile_id=${id}&checkpoint=${checkpoint}`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify(data),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to update tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified update tile function
export const updateTileUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        tab_id?: string; 
        name?: string; 
        data: {
            name?: string;
            position?: TilePosition;
            type?: string;
            minW?: number;
            minH?: number;
            visible?: boolean;
            locked?: boolean;
            color?: string;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            column_context?: string;
            grouping?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
            terminal_tile?: TerminalTileData;
        }; 
        checkpoint?: boolean;
    }) => {
        "use server";
        
        const { id, tab_id, name, data, checkpoint = false } = params;
        
        // If tile ID is provided, use it directly
        if (id) {
            const updateById = await updateTileById(apiKey);
            return updateById(id, data, checkpoint);
        }
        
        // Otherwise use tab_id+name
        if (tab_id && name) {
            const updateByName = await updateTileByName(apiKey);
            return updateByName(tab_id, name, data, checkpoint);
        }
        
        return { error: "Missing required parameters to identify the tile" };
    };
};

// Patch tile by name
export const patchTileByName = async (apiKey: string) => {
    return async (
        tab_id: string,
        name: string,
        updateData: {
            name?: string;
            position?: TilePosition;
            type?: string;
            minW?: number;
            minH?: number;
            visible?: boolean;
            locked?: boolean;
            moved?: boolean;
            static?: boolean;
            color?: string;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            column_context?: string;
            grouping?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
            terminal_tile?: TerminalTileData;
        },
        checkpoint: boolean = false
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tab_id=${tab_id}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify(updateData),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to patch tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Patch tile by ID
export const patchTileById = async (apiKey: string) => {
    return async (
        id: string,
        updateData: {
            name?: string;
            position?: TilePosition;
            type?: string;
            minW?: number;
            minH?: number;
            visible?: boolean;
            locked?: boolean;
            moved?: boolean;
            static?: boolean;
            color?: string;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            column_context?: string;
            grouping?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
            terminal_tile?: TerminalTileData;
        },
        checkpoint: boolean = false
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tile_id=${id}&checkpoint=${checkpoint}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify(updateData),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to patch tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified patch tile function
export const patchTileUnified = async (apiKey: string) => {
    return async (params: {
        id?: string; 
        tab_id?: string; 
        name?: string;
        updateData: {
            name?: string;
            position?: TilePosition;
            type?: string;
            minW?: number;
            minH?: number;
            visible?: boolean;
            locked?: boolean;
            moved?: boolean;
            static?: boolean;
            color?: string;
            context?: string;
            table?: string;
            auto_update?: string;
            freeze?: string;
            filters?: string;
            common_filter?: string;
            metric?: string;
            column_context?: string;
            grouping?: string;
            table_tile?: TableTileData;
            plot_tile?: PlotTileData;
            view_tile?: ViewTileData;
            editor_tile?: EditorTileData;
            terminal_tile?: TerminalTileData;
        };
        checkpoint?: boolean;
    }) => {
        "use server";
        
        const { id, tab_id, name, updateData, checkpoint = false } = params;
        
        // If tile ID is provided, use it directly
        if (id) {
            const patchById = await patchTileById(apiKey);
            return patchById(id, updateData, checkpoint);
        }
        
        // Otherwise use tab_id+name
        if (tab_id && name) {
            const patchByName = await patchTileByName(apiKey);
            return patchByName(tab_id, name, updateData, checkpoint);
        }
        
        return { error: "Missing required parameters to identify the tile" };
    };
};

// Patch specialized tile by name
export const patchSpecializedTileByName = async (apiKey: string) => {
    return async (
        tab_id: string,
        name: string,
        tileType: "Table" | "Plot" | "View" | "Editor" | "Terminal",
        updateData: Record<string, any>,
        checkpoint: boolean = false
    ) => {
        "use server";

        // Build query parameters
        const queryParams = new URLSearchParams();
        
        // Required parameters
        queryParams.append("tile_type", tileType);
        queryParams.append("tab_id", tab_id);
        queryParams.append("name", encodeURIComponent(name));
        queryParams.append("checkpoint", checkpoint.toString());

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?${queryParams.toString()}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify(updateData),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to patch ${tileType.toLowerCase()} tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Patch specialized tile by ID
export const patchSpecializedTileById = async (apiKey: string) => {
    return async (
        id: string,
        tileType: "Table" | "Plot" | "View" | "Editor" | "Terminal",
        updateData: Record<string, any>,
        checkpoint: boolean = false
    ) => {
        "use server";

        // Build query parameters
        const queryParams = new URLSearchParams();
        
        // Required parameters
        queryParams.append("id", id);
        queryParams.append("tile_type", tileType);
        queryParams.append("checkpoint", checkpoint.toString());

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?${queryParams.toString()}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify(updateData),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to patch ${tileType.toLowerCase()} tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified patch specialized tile function
export const patchSpecializedTileUnified = async (apiKey: string) => {
    return async (params: {
        id?: string; 
        tab_id?: string; 
        name?: string;
        tileType: "Table" | "Plot" | "View" | "Editor" | "Terminal";
        updateData: Record<string, any>;
        checkpoint?: boolean;
    }) => {
        "use server";
        
        const { id, tab_id, name, tileType, updateData, checkpoint = false } = params;
        
        // If tile ID is provided, use it directly
        if (id) {
            const patchSpecializedById = await patchSpecializedTileById(apiKey);
            return patchSpecializedById(id, tileType, updateData, checkpoint);
        }
        
        // Otherwise use tab_id+name
        if (tab_id && name) {
            const patchSpecializedByName = await patchSpecializedTileByName(apiKey);
            return patchSpecializedByName(tab_id, name, tileType, updateData, checkpoint);
        }
        
        return { error: "Missing required parameters to identify the tile" };
    };
};

// Delete tile by name
export const deleteTileByName = async (apiKey: string) => {
    return async (tab_id: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tab_id=${tab_id}&name=${encodeURIComponent(name)}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to delete tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Delete tile by ID
export const deleteTileById = async (apiKey: string) => {
    return async (id: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?tile_id=${id}`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to delete tile: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified delete tile function
export const deleteTileUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        tab_id?: string; 
        name?: string; 
    }) => {
        "use server";
        
        const { id, tab_id, name } = params;
        
        // If tile ID is provided, use it directly
        if (id) {
            const deleteById = await deleteTileById(apiKey);
            return deleteById(id);
        }
        
        // Otherwise use tab_id+name
        if (tab_id && name) {
            const deleteByName = await deleteTileByName(apiKey);
            return deleteByName(tab_id, name);
        }
        
        return { error: "Missing required parameters to identify the tile" };
    };
};

// Create checkpoint for tile by name
export const createTileCheckpointByName = async (apiKey: string) => {
    return async (tab_id: string, name: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile/checkpoint?tab_id=${tab_id}&name=${encodeURIComponent(name)}`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ description }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create checkpoint: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Create checkpoint for tile by ID
export const createTileCheckpointById = async (apiKey: string) => {
    return async (id: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile/checkpoint?tile_id=${id}`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ description }),
            }
        );
        
        if (!response.ok) {
            return { error: `Failed to create checkpoint: ${response.status}` };
        }
        
        return await response.json();
    };
};

// Unified create checkpoint for tile function
export const createTileCheckpointUnified = async (apiKey: string) => {
    return async (params: { 
        id?: string; 
        tab_id?: string; 
        name?: string;
        description: string; 
    }) => {
        "use server";
        
        const { id, tab_id, name, description } = params;
        
        // If tile ID is provided, use it directly
        if (id) {
            const checkpointById = await createTileCheckpointById(apiKey);
            return checkpointById(id, description);
        }
        
        // Otherwise use tab_id+name
        if (tab_id && name) {
            const checkpointByName = await createTileCheckpointByName(apiKey);
            return checkpointByName(tab_id, name, description);
        }
        
        return { error: "Missing required parameters to identify the tile" };
    };
};

// ===== Checkpoint Retrieval Helpers =====

// Interface checkpoint by name
export const getInterfaceCheckpointByName = async (apiKey: string) => {
    return async (projectId: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface/checkpoint?project=${projectId}&name=${encodeURIComponent(name)}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        if (!response.ok) {
            return { error: `Failed to get interface checkpoint: ${response.status}` };
        }
        return await response.json();
    };
};

export const getInterfaceCheckpointById = async (apiKey: string) => {
    return async (interface_id: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface/checkpoint?interface_id=${interface_id}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        if (!response.ok) {
            return { error: `Failed to get interface checkpoint: ${response.status}` };
        }
        return await response.json();
    };
};

export const getInterfaceCheckpointUnified = async (apiKey: string) => {
    return async (params: { interface_id?: string; projectId?: string; name?: string }) => {
        "use server";
        const { interface_id, projectId, name } = params;
        if (interface_id) {
            const fn = await getInterfaceCheckpointById(apiKey);
            return fn(interface_id);
        }
        if (projectId && name) {
            const fn = await getInterfaceCheckpointByName(apiKey);
            return fn(projectId, name);
        }
        return { error: "Missing parameters to identify the interface checkpoint" };
    };
};

// Tab checkpoint
export const getTabCheckpointByName = async (apiKey: string) => {
    return async (interface_id: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab/checkpoint?interface_id=${interface_id}&name=${encodeURIComponent(name)}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        if (!response.ok) {
            return { error: `Failed to get tab checkpoint: ${response.status}` };
        }
        return await response.json();
    };
};

export const getTabCheckpointById = async (apiKey: string) => {
    return async (tab_id: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab/checkpoint?tab_id=${tab_id}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        if (!response.ok) {
            return { error: `Failed to get tab checkpoint: ${response.status}` };
        }
        return await response.json();
    };
};

export const getTabCheckpointUnified = async (apiKey: string) => {
    return async (params: { id?: string; interface_id?: string; name?: string }) => {
        "use server";
        const { id, interface_id, name } = params;
        if (id) {
            const fn = await getTabCheckpointById(apiKey);
            return fn(id);
        }
        if (interface_id && name) {
            const fn = await getTabCheckpointByName(apiKey);
            return fn(interface_id, name);
        }
        return { error: "Missing parameters to identify the tab checkpoint" };
    };
};

// Tile checkpoint
export const getTileCheckpointByName = async (apiKey: string) => {
    return async (tab_id: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile/checkpoint?tab_id=${tab_id}&name=${encodeURIComponent(name)}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        if (!response.ok) {
            return { error: `Failed to get tile checkpoint: ${response.status}` };
        }
        return await response.json();
    };
};

export const getTileCheckpointById = async (apiKey: string) => {
    return async (tile_id: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile/checkpoint?tile_id=${tile_id}`,
            {
                method: "GET",
                headers: { apiKey: apiKey },
                cache: "no-store",
            }
        );
        if (!response.ok) {
            return { error: `Failed to get tile checkpoint: ${response.status}` };
        }
        return await response.json();
    };
};

export const getTileCheckpointUnified = async (apiKey: string) => {
    return async (params: { id?: string; tab_id?: string; name?: string }) => {
        "use server";
        const { id, tab_id, name } = params;
        if (id) {
            const fn = await getTileCheckpointById(apiKey);
            return fn(id);
        }
        if (tab_id && name) {
            const fn = await getTileCheckpointByName(apiKey);
            return fn(tab_id, name);
        }
        return { error: "Missing parameters to identify the tile checkpoint" };
    };
};

// ----- FILE ACTIONS -----

// write files (one or many)
export const writeFiles = async (adminKey: string, userId: string) => {
    return async (project: string, files: { [filePath: string]: string }) => {
        "use server";

        const results: any[] = [];
        for (const [filename, content] of Object.entries(files)) {
            const res = await fetch(
                `${process.env.NEXTAUTH_URL}/api/code/file`,
                {
                    method: "POST",
                    headers: { apiKey: adminKey },
                    body: JSON.stringify({ user_id: userId, project, filename, content })
                }
            );
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.detail || "Network error");
            }
            results.push(json);
        }
        return results;
    }
}

// list files
export const listFiles = async (adminKey: string, userId: string) => {
    return async (project: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/code/file?user_id=${userId}&project=${project}&isDirectory=true`,
            {
                method: "GET",
                headers: { apiKey: adminKey },
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            throw new Error(responseJson.detail || "Network error");
        }
        return responseJson;
    }
}

// read file
export const readFile = async (adminKey: string, userId: string) => {
    return async (project: string, path: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/code/file?user_id=${userId}&project=${project}&filename=${encodeURIComponent(path)}&isDirectory=false`,
            {
                method: "GET",
                headers: { apiKey: adminKey },
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            throw new Error(responseJson.detail || "Network error");
        }
        return responseJson;
    }
}

// delete file
export const deleteFile = async (adminKey: string, userId: string) => {
    return async (project: string, path: string, isDirectory: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/code/file`,
            {
                method: "DELETE",
                headers: { apiKey: adminKey },
                body: JSON.stringify({ user_id: userId, project, filename: path, isDirectory })
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            throw new Error(responseJson.detail || "Network error");
        }
        return responseJson;
    }
}

// rename file or directory
export const renameFile = async (adminKey: string, userId: string) => {
    return async (project: string, oldPath: string, newPath: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/code/file`,
            {
                method: "PUT",
                headers: { apiKey: adminKey },
                body: JSON.stringify({ user_id: userId, project, old_filename: oldPath, new_filename: newPath })
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            throw new Error(responseJson.detail || "Network error");
        }
        return responseJson;
    }
}

