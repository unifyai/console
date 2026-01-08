"use server";

import { ResponseProps } from "@/types/common";
import { ResourceAccessGrant, ResourceAccessRevoke, ResourceAccessUpdate, ResourceAccessResponse } from "@/types/resource";

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
        console.error(`[ResourceAccess] ${context} error:`, error);
        return { detail: "Network error", status: 500 };
    }
};

const getHeaders = (apiKey: string) => ({
    "Content-Type": "application/json",
    "accept": "application/json",
    "Authorization": `Bearer ${apiKey}`
});

export interface ResourceAccessListResponse {
    resource_type: string;
    resource_id: number;
    access_entries: ResourceAccessResponse[];
}

/**
 * Grant access to a resource (project or org).
 * Only works for organizational resources.
 */
export const grantResourceAccessAction = (apiKey: string) => async (
    resourceType: "project" | "org",
    resourceId: number,
    grantData: ResourceAccessGrant
): Promise<ResourceAccessResponse | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/resources/${resourceType}/${resourceId}/access`, {
        method: "POST",
        headers: getHeaders(apiKey),
        body: JSON.stringify(grantData),
    }, "grantResourceAccess");
};

/**
 * Revoke access to a resource (project or org).
 */
export const revokeResourceAccessAction = (apiKey: string) => async (
    resourceType: "project" | "org",
    resourceId: number,
    revokeData: ResourceAccessRevoke
): Promise<void | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/resources/${resourceType}/${resourceId}/access`, {
        method: "DELETE",
        headers: getHeaders(apiKey),
        body: JSON.stringify(revokeData),
    }, "revokeResourceAccess");
};

/**
 * Update an existing resource access grant (change role).
 */
export const updateResourceAccessAction = (apiKey: string) => async (
    resourceType: "project" | "org",
    resourceId: number,
    accessId: number,
    updateData: ResourceAccessUpdate
): Promise<ResourceAccessResponse | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/resources/${resourceType}/${resourceId}/access/${accessId}`, {
        method: "PATCH",
        headers: getHeaders(apiKey),
        body: JSON.stringify(updateData),
    }, "updateResourceAccess");
};

/**
 * List all access entries for a resource (project or org).
 */
export const listResourceAccessAction = (apiKey: string) => async (
    resourceType: "project" | "org",
    resourceId: number
): Promise<ResourceAccessListResponse | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/resources/${resourceType}/${resourceId}/access`, {
        method: "GET",
        headers: getHeaders(apiKey),
    }, "listResourceAccess");
};
