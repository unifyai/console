
export interface ResourceAccessGrant {
    roleId: number;
    granteeType: "user" | "team";
    granteeId: string;
}

export interface ResourceAccessRevoke {
    granteeType: "user" | "team";
    granteeId: string;
    roleId?: number;
}

export interface ResourceAccessUpdate {
    roleId: number;
}

export interface ResourceAccessResponse {
    id: number;
    resourceType: string;
    resourceId: number;
    roleId: number;
    roleName: string;
    granteeType: string;
    granteeId: string;
    granteeName?: string;
    createdAt: string;
}

export interface ResourceAccessListResponse {
    accessEntries: ResourceAccessResponse[];
}

export interface ResourcesActions {
    grantAccess: (resourceType: "project" | "org", resourceId: number, grantData: ResourceAccessGrant) => Promise<any>;
    revokeAccess: (resourceType: "project" | "org", resourceId: number, revokeData: ResourceAccessRevoke) => Promise<any>;
    updateAccess: (resourceType: "project" | "org", resourceId: number, accessId: number, updateData: ResourceAccessUpdate) => Promise<any>;
    listAccess: (resourceType: "project" | "org", resourceId: number) => Promise<ResourceAccessListResponse | any>;
    listRoles: (orgId: number) => Promise<any>;
}
