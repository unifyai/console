"use server";

import { TileProps } from "@/types/evals/grid";
import { LogFieldsProps, getLogsParameters } from "@/types/evals/logs";
import { sanitizeKey } from "./utils";
import { ResponseProps } from "@/types/common";
import { TilePosition, TableTileData, PlotTileData, ViewTileData, EditorTileData } from "@/types/evals/grid";

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
    return async (project: string, context: string | null, columnContext: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, groupSortingExpression: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number | null, group_depth: number | null, return_ids_only: string | null, _timestamp: string | null) => {
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
    return async (project: string, context: string | null, columnContext: string | null, filterExpression: string | null, sortingExpression: string | null, groupingExpression: string | null, groupSortingExpression: string | null, from_fields: string | null, exclude_fields: string | null, limit: number | null, offset: number | null, group_depth: number | null) => {
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

// ----- NEW GRANULAR API ACTIONS -----
// List interfaces
export const listInterfaces = async (apiKey: string) => {
    return async (projectId: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interfaces?project_id=${projectId}&checkpoint=${checkpoint}`,
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
            `${process.env.NEXTAUTH_URL}/api/interfaces?project_id=${projectId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
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

// Create interface (new version)
export const createNewInterface = async (apiKey: string) => {
    return async (projectId: string, name: string, color?: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interfaces`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({
                    project_id: projectId,
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

// Update interface by name (new version)
export const updateInterfaceByName = async (apiKey: string) => {
    return async (projectId: string, name: string, data: { name?: string, active_tab_id?: string, color?: string }, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interfaces?project_id=${projectId}&name=${encodeURIComponent(name)}&checkpoint=${checkpoint}`,
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

// Delete interface by name (new version)
export const deleteInterfaceByName = async (apiKey: string) => {
    return async (projectId: string, name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interfaces?project_id=${projectId}&name=${encodeURIComponent(name)}`,
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

// Create checkpoint for interface
export const createInterfaceCheckpoint = async (apiKey: string) => {
    return async (projectId: string, name: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interfaces/checkpoint?project_id=${projectId}&name=${encodeURIComponent(name)}`,
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

// List tabs by interface
export const listTabs = async (apiKey: string) => {
    return async (projectId: string, interfaceName: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?project_id=${projectId}&interface_name=${encodeURIComponent(interfaceName)}&checkpoint=${checkpoint}`,
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
    return async (projectId: string, interfaceName: string, tabName: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?project_id=${projectId}&interface_name=${encodeURIComponent(interfaceName)}&name=${encodeURIComponent(tabName)}&checkpoint=${checkpoint}`,
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

// Create tab
export const createTab = async (apiKey: string) => {
    return async (projectId: string, interfaceName: string, tabName: string, data: {
        visible?: boolean,
        active?: boolean,
        order?: number,
        global_context?: string,
        color?: string
    }) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({
                    project_id: projectId,
                    interface_name: interfaceName,
                    name: tabName,
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
export const updateTab = async (apiKey: string) => {
    return async (projectId: string, interfaceName: string, tabName: string, data: {
        name?: string,
        visible?: boolean,
        active?: boolean,
        order?: number,
        global_context?: string,
        color?: string
    }, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?project_id=${projectId}&interface_name=${encodeURIComponent(interfaceName)}&name=${encodeURIComponent(tabName)}&checkpoint=${checkpoint}`,
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

// Delete tab by name
export const deleteTab = async (apiKey: string) => {
    return async (projectId: string, interfaceName: string, tabName: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab?project_id=${projectId}&interface_name=${encodeURIComponent(interfaceName)}&name=${encodeURIComponent(tabName)}`,
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

// Create checkpoint for tab
export const createTabCheckpoint = async (apiKey: string) => {
    return async (projectId: string, interfaceName: string, tabName: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tab/checkpoint?project_id=${projectId}&interface_name=${encodeURIComponent(interfaceName)}&name=${encodeURIComponent(tabName)}`,
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

// List tiles by tab
export const listTiles = async (apiKey: string) => {
    return async (projectId: string, interfaceName: string, tabName: string, type?: string, checkpoint: boolean = false) => {
        "use server";

        let url = `${process.env.NEXTAUTH_URL}/api/tile?project_id=${projectId}&interface_name=${encodeURIComponent(interfaceName)}&tab_name=${encodeURIComponent(tabName)}&checkpoint=${checkpoint}`;
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
    return async (projectId: string, interfaceName: string, tabName: string, tileName: string, checkpoint: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?project_id=${projectId}&interface_name=${encodeURIComponent(interfaceName)}&tab_name=${encodeURIComponent(tabName)}&name=${encodeURIComponent(tileName)}&checkpoint=${checkpoint}`,
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

// Create tile
export const createTile = async (apiKey: string) => {
    return async (
        projectId: string, 
        interfaceName: string, 
        tabName: string, 
        tileName: string, 
        tileType: string,
        position: TilePosition,
        data: {
            min_width?: number,
            min_height?: number,
            visible?: boolean,
            locked?: boolean,
            moved?: boolean,
            static?: boolean,
            context?: string,
            table?: string,
            auto_update?: string,
            freeze?: string,
            filters?: string,
            common_filter?: string,
            metric?: string,
            table_tile?: TableTileData,
            plot_tile?: PlotTileData,
            view_tile?: ViewTileData,
            editor_tile?: EditorTileData
        }
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({
                    project_id: projectId,
                    interface_name: interfaceName,
                    tab_name: tabName,
                    name: tileName,
                    type: tileType,
                    position,
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
export const updateTile = async (apiKey: string) => {
    return async (
        projectId: string,
        interfaceName: string,
        tabName: string,
        tileName: string,
        data: {
            name?: string,
            position?: TilePosition,
            min_width?: number,
            min_height?: number,
            visible?: boolean,
            locked?: boolean,
            context?: string,
            table?: string,
            auto_update?: string,
            freeze?: string,
            filters?: string,
            common_filter?: string,
            metric?: string,
            table_tile?: TableTileData,
            plot_tile?: PlotTileData,
            view_tile?: ViewTileData,
            editor_tile?: EditorTileData
        },
        checkpoint: boolean = false
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?project_id=${projectId}&interface_name=${encodeURIComponent(interfaceName)}&tab_name=${encodeURIComponent(tabName)}&name=${encodeURIComponent(tileName)}&checkpoint=${checkpoint}`,
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

// Patch tile by name
export const patchTile = async (apiKey: string) => {
    return async (
        projectId: string,
        interfaceName: string,
        tabName: string,
        tileName: string,
        updateData: {
            name?: string,
            position?: TilePosition,
            min_width?: number,
            min_height?: number,
            visible?: boolean,
            locked?: boolean,
            moved?: boolean,
            static?: boolean,
            context?: string,
            table?: string,
            auto_update?: string,
            freeze?: string,
            filters?: string,
            common_filter?: string,
            metric?: string,
            table_tile?: TableTileData,
            plot_tile?: PlotTileData,
            view_tile?: ViewTileData,
            editor_tile?: EditorTileData
        },
        checkpoint: boolean = false
    ) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?project_id=${projectId}&interface_name=${encodeURIComponent(interfaceName)}&tab_name=${encodeURIComponent(tabName)}&name=${encodeURIComponent(tileName)}&checkpoint=${checkpoint}`,
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

// Patch specialized tile by name
export const patchSpecializedTile = async (apiKey: string) => {
    return async (
        projectId: string,
        interfaceName: string,
        tabName: string,
        tileName: string,
        tileType: "Table" | "Plot" | "View" | "Editor",
        updateData: Record<string, any>,
        checkpoint: boolean = false,
    ) => {
        "use server";

        // Build query parameters
        const queryParams = new URLSearchParams();
        
        // Required parameters
        queryParams.append("tile_type", tileType);
        queryParams.append("project_id", projectId);
        queryParams.append("interface_name", encodeURIComponent(interfaceName));
        queryParams.append("tab_name", encodeURIComponent(tabName));
        queryParams.append("name", encodeURIComponent(tileName));
        queryParams.append("checkpoint", checkpoint.toString());

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile/specialized?${queryParams.toString()}`,
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

// Delete tile by name
export const deleteTile = async (apiKey: string) => {
    return async (projectId: string, interfaceName: string, tabName: string, tileName: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile?project_id=${projectId}&interface_name=${encodeURIComponent(interfaceName)}&tab_name=${encodeURIComponent(tabName)}&name=${encodeURIComponent(tileName)}`,
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

// Create checkpoint for tile
export const createTileCheckpoint = async (apiKey: string) => {
    return async (projectId: string, interfaceName: string, tabName: string, tileName: string, description: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/tile/checkpoint?project_id=${projectId}&interface_name=${encodeURIComponent(interfaceName)}&tab_name=${encodeURIComponent(tabName)}&name=${encodeURIComponent(tileName)}`,
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
