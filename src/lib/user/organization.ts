import { cookies } from "next/headers";
import { Organization, OrganizationMember, OrganizationRole, OrganizationListResponse, OrganizationInviteListResponse } from "@/types/organization";
import { ResponseProps } from "@/types/common";

const backendUrl = `${process.env.ORCHESTRA_URL}/v0`;
const adminKey = process.env.ORCHESTRA_ADMIN_KEY;

const safeFetch = async (url: string, options: RequestInit, context: string): Promise<any> => {
    try {
        const response = await fetch(url, options);

        let data;
        const contentType = response.headers.get("content-type");

        // Handle 204 No Content explicitly
        if (response.status === 204) {
            return;
        }

        try {
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                const text = await response.text();
                // If OK but not JSON, return empty object (likely success message)
                if (response.ok && !text) return {}; 

                // If error and not JSON, log it
                console.error(`[actions.ts ${context}] Received non-JSON response with status ${response.status}: ${text}`);
                return { detail: text || "Received an invalid response from the server.", status: response.status };
            }
        } catch (parseError) {
            console.error(`[actions.ts ${context}] Failed to parse JSON response ${parseError}`);
            return { detail: "Received an invalid response from the server.", status: response.status };
        }

        if (!response.ok) {
            const errorMessage = data.detail || data.error || `Operation failed: ${response.statusText}`;
            return { detail: errorMessage, status: response.status };
        }

        return data;

    } catch (error) {
        console.error(`[actions.ts ${context}] Network/System Error:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown server error occurred.";
        return { detail: errorMessage, status: 500 };
    }
}

// Helper to construct headers
const getHeaders = (apiKey: string) => ({
    "Content-Type": "application/json",
    "accept": "application/json",
    "Authorization": `Bearer ${apiKey}`
});

export const createOrganizationAction = async (apiKey: string) => {
  return async (name: string): Promise<Organization | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations`, {
        method: "POST",
        headers: getHeaders(apiKey),
        body: JSON.stringify({ name }),
    }, "createOrganization");
  };
};

export const updateOrganizationAction = async (apiKey: string) => {
  return async (orgId: number, name: string): Promise<Organization | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}`, {
        method: "PATCH",
        headers: getHeaders(apiKey),
        body: JSON.stringify({ name }),
    }, "updateOrganization");
  };
};

export const deleteOrganizationAction = async (apiKey: string) => {
  return async (orgId: number): Promise<void | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}`, {
        method: "DELETE",
        headers: getHeaders(apiKey),
    }, "deleteOrganization");
  };
};

export const getMembersAction = async (apiKey: string) => {
    return async (orgId: number): Promise<OrganizationMember[] | ResponseProps> => {
        "use server";
        return safeFetch(`${backendUrl}/organizations/${orgId}/members`, {
            method: "GET",
            headers: getHeaders(apiKey),
        }, "getMembers");
    };
};

export const inviteMemberAction = async (apiKey: string) => {
  return async (orgId: number, email: string, roleId?: number): Promise<void | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}/invites`, {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify({ 
          email: email,
          level: "user"
      }),
    }, "inviteMember");
  };
};

export const acceptInviteAction = async (apiKey: string) => {
    return async (token: string): Promise<void | ResponseProps> => {
        "use server";
        const response = await safeFetch(`${backendUrl}/invites/${token}/accept`, {
            method: "POST",
            headers: getHeaders(apiKey),
        }, "acceptInvite");

        if (response && !("detail" in response) && response.organization_id) {
            cookies().set("unify_workspace_id", String(response.organization_id), {
                path: "/",
                maxAge: 60 * 60 * 24 * 30, // 30 days
                sameSite: "lax",
            });
        }
        return response;
    };
};

export const getInvitesAction = async (apiKey: string) => {
    return async (orgId: number): Promise<OrganizationInviteListResponse | ResponseProps> => {
        "use server";
        return safeFetch(`${backendUrl}/organizations/${orgId}/invites`, {
            method: "GET",
            headers: getHeaders(apiKey),
        }, "getInvites");
    };
};

export const cancelInviteAction = async (apiKey: string) => {
    return async (orgId: number, inviteId: string): Promise<void | ResponseProps> => {
        "use server";
        return safeFetch(`${backendUrl}/organizations/${orgId}/invites/${inviteId}`, {
            method: "DELETE",
            headers: getHeaders(apiKey),
        }, "cancelInvite");
    };
};

export const removeMemberAction = async (apiKey: string) => {
  return async (orgId: number, userId: string): Promise<void | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}/members/${userId}`, {
        method: "DELETE",
        headers: getHeaders(apiKey),
    }, "removeMember");
  };
};

export const getOrganizationRolesAction = async (apiKey: string) => {
    return async (orgId: number): Promise<OrganizationRole[] | ResponseProps> => {
        "use server";
        return safeFetch(`${backendUrl}/organizations/${orgId}/roles`, {
            method: "GET",
            headers: getHeaders(apiKey),
        }, "getOrganizationRoles");
    };
};

export const updateRoleAction = async (apiKey: string) => {
  return async (orgId: number, userId: string, roleId: number): Promise<void | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}/members/${userId}/role`, {
        method: "PATCH",
        headers: getHeaders(apiKey),
        body: JSON.stringify({ role_id: roleId }),
    }, "updateRole");
  };
};

export const transferOwnershipAction = async (apiKey: string) => {
  return async (orgId: number, newOwnerId: string): Promise<Organization | ResponseProps> => {
    "use server";
    return safeFetch(`${backendUrl}/organizations/${orgId}/transfer-ownership`, {
        method: "POST",
        headers: getHeaders(apiKey),
        body: JSON.stringify({ new_owner_id: newOwnerId }),
    }, "transferOwnership");
  };
};

export const createGetAllOrganizationsAction = async () => {
    return async (nameFilter?: string): Promise<OrganizationListResponse | ResponseProps> => {
        "use server";
        const query = nameFilter ? `?name=${encodeURIComponent(nameFilter)}` : "";

        return safeFetch(`${backendUrl}/admin/organizations${query}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "accept": "application/json",
                "Authorization": `Bearer ${adminKey}`
            },
        }, "getAllOrganizations");
    };
};