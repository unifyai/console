"use server";

import { TileProps } from "@/types/evals/grid";
import { LogFieldsProps } from "@/types/evals/logs";
import { sanitizeKey } from "./utils";

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
            { method: "GET", headers: { apiKey: apiKey } }
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

// get logs
export const getLogs = async (apiKey: string) => {
    return async (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number | null, _timestamp: string | null) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs?project=${project}`
            + (context ? `&context=${context}` : "")
            + (filterExpression ? `&filter_expr=${encodeURIComponent(filterExpression)}` : "")
            + (sortingExpression ? `&sorting=${encodeURIComponent(sortingExpression)}` : "")
            + (from_fields ? `&from_fields=${from_fields}` : "")
            + (limit ? `&limit=${limit}` : "")
            + (offset ? `&offset=${offset}` : ""),
            { method: "GET", headers: { apiKey: apiKey }, next: { tags: [`logs_${_timestamp}`] } },
        );
        return await response.json();
    };
};

// get log fields
export const getLogFields = async (apiKey: string) => {
    return async (project: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs/fields?project=${project}`,
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

export const getLogMetrics = async (apiKey: string) => {
    return async (
        project: string,
        filterExpression: string | null,
        metricName: string,
        keyName: string,
    ) => {
        "use server";

        // Sanitize the keyName before using it in the request
        const sanitizedKey = sanitizeKey(keyName);

        const response = await fetch(
            (
                `${process.env.NEXTAUTH_URL}/api/logs/${metricName}?project=${project}&key=${sanitizedKey}`
                +  (filterExpression ? `&filter_expr=${encodeURIComponent(filterExpression)}` : "")
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
    return async (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number | null) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs/latest_timestamp?project=${project}`
            + (context ? `&context=${context}` : "")
            + (filterExpression ? `&filter_expr=${filterExpression}` : "")
            + (sortingExpression ? `&sorting=${encodeURIComponent(sortingExpression)}` : "")
            + (from_fields ? `&from_fields=${from_fields}` : "")
            + (limit ? `&limit=${limit}` : "")
            + (offset ? `&offset=${offset}` : ""),
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

// delete logs
export const deleteLogs = async (apiKey: string) => {
    return async (ids_and_fields: LogFieldsProps) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ ids_and_fields })
            }
        );
        return await response.json();
    };
};

// create interface
export const createInterface = async (apiKey: string) => {
    return async (name: string, project: string, items: TileProps[], new_counter: number, temporary: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ name, project, items, new_counter, temporary })
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
            { method: "GET", headers: { apiKey: apiKey } }
        );
        if (!response.ok)
            return null;
        return await response.json();
    };
};

// update interface
export const updateInterface = async (apiKey: string) => {
    return async (name: string, project: string, items: TileProps[], new_counter: number, new_name: string | undefined = undefined, temporary: boolean = false) => {
        "use server";

        const body = { name, project, items, new_counter, temporary };
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
            `${process.env.NEXTAUTH_URL}/api/interface`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ name, project, temporary })
            },
        );
        return await response.json();
    };
};
