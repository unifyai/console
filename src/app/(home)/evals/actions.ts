"use server";

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
    return async (project: string, filterExpression: string | null, limit: number | null, offset: number | null) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs?project=${project}`
            + (filterExpression ? `&filter_expr=${filterExpression}` : "")
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
                `${process.env.NEXTAUTH_URL}/api/logs/${metricName}/${keyName}?project=${project}`
                +  (filterExpression ? `&filter_expr=${filterExpression}` : "")
            ),
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    }
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