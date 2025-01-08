"use server";

import { TileProps } from "@/types/evals/grid";
import { LogFieldsProps } from "@/types/evals/logs";

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
    return async (project: string, filterExpression: string | null, sortingExpression: string | null, limit: number | null, offset: number | null) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs?project=${project}`
            + (filterExpression ? `&filter_expr=${filterExpression}` : "")
            + (sortingExpression ? `&sorting=${sortingExpression.replace("{", "%7B").replace(":", "%3A%20").replace("}", "%7D")}` : "")
            + (limit ? `&limit=${limit}` : "")
            + (offset ? `&offset=${offset}` : ""),
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

// get log columns
export const getLogColumns = async (apiKey: string) => {
    return async (project: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs/columns?project=${project}`,
            { method: "GET", headers: { apiKey: apiKey } }
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

        const response = await fetch(
            (
                `${process.env.NEXTAUTH_URL}/api/logs/${metricName}?project=${project}&key=${keyName}`
                +  (filterExpression ? `&filter_expr=${filterExpression}` : "")
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
    return async (project: string, filterExpression: string | null) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs/latest_timestamp?project=${project}` + (filterExpression ? `&filter_expr=${filterExpression}` : ""),
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

// delete logs
export const deleteLogs = async (apiKey: string) => {
    return async (ids: string[]) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ ids })
            }
        );
        return await response.json();
    };
};

// delete log fields
export const deleteLogFields = async (apiKey: string) => {
    return async (fields: LogFieldsProps) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs/fields`,
            {
                method: "DELETE",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ fields })
            }
        );
        return await response.json();
    };
};

// create interface
export const createInterface = async (apiKey: string) => {
    return async (items: TileProps[], new_counter: number, project: string | null, temporary: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ items, new_counter, project, temporary })
            }
        );
        return await response.json();
    };
};

// get interface
export const getInterface = async (apiKey: string) => {
    return async (temporary: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface?temporary=${temporary}`,
            { method: "GET", headers: { apiKey: apiKey } }
        );
        if (!response.ok)
            return null;
        return await response.json();
    };
};

// update interface
export const updateInterface = async (apiKey: string) => {
    return async (items: TileProps[], new_counter: number, project: string | null, temporary: boolean = false) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/interface`,
            {
                method: "PUT",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ items, new_counter, project, temporary })
            },
        );
        return await response.json();
    };
};
