"use server";

// get devbox
export const getDevbox = async (apiKey: string, userId: string) => {
    return async () => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/devbox?userId=${userId}`,
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
                body: JSON.stringify({ userId: userId })
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
    return async (project: string, filePath: string, env?: { [key: string]: string } | { key: string; value: string }[]) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/code`,
            {
                method: "POST",
                headers: { apiKey: apiKey },
                body: JSON.stringify({
                    userId: userId,
                    filePath: filePath,
                    projectName: project,
                    env: Array.isArray(env)
                        ? Object.fromEntries((env as { key: string; value: string }[]).map(({ key, value }) => [key, value]))
                        : env
                })
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            throw new Error(responseJson.detail || "Network error");
        }
        return responseJson;
    }
}

// get code output
export const getCodeOutput = async (apiKey: string) => {
    return async (filePath: string) => {
        "use server";

        const response = await fetch(
            `${process.env.NEXTAUTH_URL}/api/code?filePath=${filePath}`,
            { method: "GET", headers: { apiKey: apiKey } }
        );
        return await response.json();
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
                    userId: userId,
                    shell,
                    cwd
                })
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            throw new Error(responseJson.detail || "Network error");
        }
        return responseJson; // { sessionId, shell, cwd }
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
                    sessionId: sessionId,
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
            `${process.env.NEXTAUTH_URL}/api/code/terminal?sessionId=${sessionId}`,
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
                body: JSON.stringify({ sessionId: sessionId })
            }
        );
        const responseJson = await response.json();
        if (!response.ok) {
            throw new Error(responseJson.detail || "Network error");
        }
        return responseJson; // { detail: "Session terminated" }
    };
};