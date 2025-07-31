"use server";

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
