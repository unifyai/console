
export interface ResourceAccessGrant {
    role_id: number;
    grantee_type: "user" | "team";
    grantee_id: string;
}

export interface ResourceAccessRevoke {
    grantee_type: "user" | "team";
    grantee_id: string;
    role_id?: number;
}

export interface ResourceAccessUpdate {
    role_id: number;
}

export interface ResourceAccessResponse {
    id: number;
    resource_type: string;
    resource_id: number;
    role_id: number;
    role_name: string;
    grantee_type: string;
    grantee_id: string;
    grantee_name?: string;
    created_at: string;
}

export interface ResourceAccessListResponse {
    access_entries: ResourceAccessResponse[];
}

export interface ResourcesActions {
    grantAccess: (resourceType: "project" | "org", resourceId: number, grantData: ResourceAccessGrant) => Promise<any>;
    revokeAccess: (resourceType: "project" | "org", resourceId: number, revokeData: ResourceAccessRevoke) => Promise<any>;
    updateAccess: (resourceType: "project" | "org", resourceId: number, accessId: number, updateData: ResourceAccessUpdate) => Promise<any>;
    listAccess: (resourceType: "project" | "org", resourceId: number) => Promise<ResourceAccessListResponse | any>;
    listRoles: (orgId: number) => Promise<any>;
}
