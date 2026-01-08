import { Team } from "@/types/team";
import { ResponseProps } from "@/types/common";

const backendUrl = `${process.env.ORCHESTRA_URL}/v0`;

const safeFetch = async (url: string, options: RequestInit, context: string): Promise<any> => {
    try {
        const response = await fetch(url, options);
        if (response.status === 204) return {};
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (!response.ok) {
                return { detail: data.detail || "Operation failed", status: response.status };
            }
            return data;
        }
        if (!response.ok) return { detail: response.statusText, status: response.status };
        return {};
    } catch (error) {
        console.error(`[Teams] ${context} error:`, error);
        return { detail: "Network error", status: 500 };
    }
}

const getHeaders = (apiKey: string) => ({
    "Content-Type": "application/json",
    "accept": "application/json",
    "Authorization": `Bearer ${apiKey}`
});

export const createTeamAction = (apiKey: string) => async (orgId: number, name: string, description?: string): Promise<Team | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}/teams`, {
        method: "POST",
        headers: getHeaders(apiKey),
        body: JSON.stringify({ name, description }),
    }, "createTeam");
};

export const updateTeamAction = (apiKey: string) => async (orgId: number, teamId: number, name: string, description?: string): Promise<Team | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}/teams/${teamId}`, {
        method: "PATCH",
        headers: getHeaders(apiKey),
        body: JSON.stringify({ name, description }),
    }, "updateTeam");
};

export const getTeamsAction = (apiKey: string) => async (orgId: number): Promise<Team[] | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}/teams`, {
        method: "GET",
        headers: getHeaders(apiKey),
    }, "getTeams");
};

export const getTeamDetailsAction = (apiKey: string) => async (orgId: number, teamId: number): Promise<Team | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}/teams/${teamId}`, {
        method: "GET",
        headers: getHeaders(apiKey),
    }, "getTeamDetails");
};

export const deleteTeamAction = (apiKey: string) => async (orgId: number, teamId: number): Promise<void | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}/teams/${teamId}`, {
        method: "DELETE",
        headers: getHeaders(apiKey),
    }, "deleteTeam");
};

export const addTeamMemberAction = (apiKey: string) => async (orgId: number, teamId: number, userId: string): Promise<void | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}/teams/${teamId}/members`, {
        method: "POST",
        headers: getHeaders(apiKey),
        body: JSON.stringify({ user_ids: [userId] }),
    }, "addTeamMember");
};

export const removeTeamMemberAction = (apiKey: string) => async (orgId: number, teamId: number, userId: string): Promise<void | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}/teams/${teamId}/members/${userId}`, {
        method: "DELETE",
        headers: getHeaders(apiKey),
    }, "removeTeamMember");
};