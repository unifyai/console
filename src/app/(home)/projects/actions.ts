"use server";

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
    return async (project: string, filterExpression: string | null) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/logs?project=${project}` + (filterExpression ? `&filter_expr=${filterExpression}` : ""),
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

// get datasets
export const getDatasets = async (apiKey: string) => {
    return async () => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/datasets`,
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

// get dataset entries
export const getDatasetEntries = async (apiKey: string) => {
    return async (dataset: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/datasets/${dataset}`,
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};

// rename dataset
export const renameDataset = async (apiKey: string) => {
    return async (oldName: string, newName: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/datasets/${oldName}`,
            {
                method: "PATCH",
                headers: { apiKey: apiKey },
                body: JSON.stringify({ name: newName })
            }
        );
        return await response.json();
    };
};

// delete dataset
export const deleteDataset = async (apiKey: string) => {
    return async (name: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/datasets/${name}`,
            { method: "DELETE", headers: { apiKey: apiKey } }
        );
        return await response.json();
    };
};
