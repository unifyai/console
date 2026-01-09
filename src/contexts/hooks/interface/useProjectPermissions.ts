"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
    ResourceAccessListResponse,
    ResourceAccessResponse
} from "@/types/resource";
import { Role, Permission } from "@/types/role";
import { Team } from "@/types/team";
import { OrganizationMember } from "@/types/organization";

export interface ProjectPermissions {
    /** Whether the user has project:write permission */
    hasWrite: boolean;
    /** Whether the user has project:delete permission */
    hasDelete: boolean;
    /** Whether the user is the owner of the project (for personal projects or explicit Owner role) */
    isOwner: boolean;
    /** The role name if user has explicit access */
    roleName: string | null;
    /** Whether the project is an organization project */
    isOrgProject: boolean;
    /** Organization ID if org project */
    organizationId: number | null;
    /** Project ID */
    projectId: number | null;
    /** Whether permissions are loading */
    isLoading: boolean;
    /** Whether there was an error fetching permissions */
    isError: boolean;
    /** Error message if any */
    error: string | null;
    /** All access entries for the project (for sharing UI) */
    accessEntries: ResourceAccessResponse[];
    /** All available roles in the organization (for role selection) */
    availableRoles: Role[];
    /** All teams in the organization (for sharing UI) */
    availableTeams: Team[];
    /** All members in the organization (for sharing UI) */
    availableMembers: OrganizationMember[];
}

export interface UseProjectPermissionsOptions {
    /** Current user ID */
    userId: string;
    /** Active project name */
    selectedProject: string | null;
    /** Function to fetch project details */
    getProject: (name: string) => Promise<any>;
    /** Function to fetch permissions */
    fetchPermissions: (resourceType: "project" | "org", resourceId: number) => Promise<any>;
    /** Function to fetch organization roles */
    fetchRoles: (orgId: number) => Promise<any>;
}

/**
 * Hook to fetch and resolve project permissions for the current user.
 * 
 * Takes the active project name and resolves:
 * 1. Project details (ID, org ID, owner ID) via getProject
 * 2. Resource access (if org project)
 * 3. Organization roles (if org project)
 * 4. Computed permissions
 */
export function useProjectPermissions(options: UseProjectPermissionsOptions): ProjectPermissions & { refetch: () => void } {
    const { userId, selectedProject, getProject, fetchPermissions, fetchRoles } = options;
    const queryClient = useQueryClient();

    // 1. Fetch project details
    const projectQuery = useQuery({
        queryKey: ["project", "details", selectedProject],
        queryFn: async () => {
            if (!selectedProject) return null;
            return await getProject(selectedProject);
        },
        enabled: !!selectedProject,
        staleTime: 5 * 60 * 1000,
    });

    const projectData = projectQuery.data;
    const projectId = projectData?.id || null;
    const organizationId = projectData?.organizationId || null;
    const projectOwnerId = projectData?.userId || null;
    const isOrgProject = organizationId !== null && organizationId !== undefined;
    const isPersonalOwner = !!userId && !!projectOwnerId && userId === projectOwnerId;

    // 2. Fetch resource access for org projects
    const accessQuery = useQuery({
        queryKey: ["resourceAccess", "project", projectId],
        queryFn: async () => {
            if (!projectId || !isOrgProject) return null;
            const result = await fetchPermissions("project", projectId);
            if ("status" in result && result.status !== 200) {

                // If 403/404, return empty list instead of erroring, so UI can show "No Access" state?
                // But for permissions check we want to know it failed.
                throw new Error(result.detail || "Failed to fetch access");
            }
            return result as ResourceAccessListResponse;
        },
        enabled: !!projectId && isOrgProject,
        staleTime: 2 * 60 * 1000,
        retry: 2,
    });

    // 3. Fetch organization roles for org projects
    const rolesQuery = useQuery({
        queryKey: ["organizationRoles", organizationId],
        queryFn: async () => {
            if (!organizationId) return [];
            const result = await fetchRoles(organizationId);
            if ("status" in result && result.status !== 200) {
                throw new Error((result as any).detail || "Failed to fetch roles");
            }
            return result as Role[];
        },
        enabled: !!organizationId && isOrgProject,
        staleTime: 5 * 60 * 1000,
        retry: 2,
    });

    // 4. Fetch teams for the organization (for sharing dialog)
    const teamsQuery = useQuery<Team[]>({
        queryKey: ["organization", "teams", organizationId],
        queryFn: async () => {
            if (!organizationId) return [];
            try {
                const res = await fetch(`/api/organizations/${organizationId}/teams`);
                if (!res.ok) return [];
                return await res.json();
            } catch {
                return [];
            }
        },
        enabled: !!organizationId && isOrgProject,
        staleTime: 2 * 60 * 1000,
    });

    // 5. Fetch members for the organization (for sharing dialog)
    const membersQuery = useQuery<OrganizationMember[]>({
        queryKey: ["organization", "members", organizationId],
        queryFn: async () => {
            if (!organizationId) return [];
            try {
                const res = await fetch(`/api/organizations/${organizationId}/members`);
                if (!res.ok) return [];
                return await res.json();
            } catch {
                return [];
            }
        },
        enabled: !!organizationId && isOrgProject,
        staleTime: 2 * 60 * 1000,
    });

    // Resolve user's permissions
    const permissions = useMemo((): Omit<ProjectPermissions, "refetch"> => {
        // No project selected
        if (!selectedProject) {
            return {
                hasWrite: false, hasDelete: false, isOwner: false, roleName: null,
                isOrgProject: false, organizationId: null, projectId: null,
                isLoading: false, isError: false, error: null, accessEntries: [], availableRoles: [],
                availableTeams: [], availableMembers: []
            };
        }

        // Loading states
        if (projectQuery.isLoading || (isOrgProject && (accessQuery.isLoading || rolesQuery.isLoading))) {
            return {
                hasWrite: false, hasDelete: false, isOwner: false, roleName: null,
                isOrgProject, organizationId, projectId,
                isLoading: true, isError: false, error: null, accessEntries: [], availableRoles: [],
                availableTeams: [], availableMembers: []
            };
        }

        // Project fetch error
        if (projectQuery.isError) {
            return {
                hasWrite: false, hasDelete: false, isOwner: false, roleName: null,
                isOrgProject: false, organizationId: null, projectId: null,
                isLoading: false, isError: true, error: (projectQuery.error as Error).message, accessEntries: [], availableRoles: [],
                availableTeams: [], availableMembers: []
            };
        }

        // Personal project: user is full owner if IDs match
        if (isPersonalOwner || (!isOrgProject && projectData)) {
            // For safety, only assume owner if explicitly personal owner or maybe check backend logic?
            // Assuming default is personal owner if not org project for now, but strict check is better.
            const canAssumeOwner = isPersonalOwner || (!isOrgProject && userId === projectOwnerId);

            return {
                hasWrite: canAssumeOwner,
                hasDelete: canAssumeOwner,
                isOwner: canAssumeOwner,
                roleName: canAssumeOwner ? "Owner" : null,
                isOrgProject: false,
                organizationId: null,
                projectId,
                isLoading: false,
                isError: false,
                error: null,
                accessEntries: [],
                availableRoles: [],
                availableTeams: [],
                availableMembers: [],
            };
        }

        // Permissions fetch error
        if (accessQuery.isError || rolesQuery.isError) {
            const errorMsg = (accessQuery.error as Error)?.message || (rolesQuery.error as Error)?.message || "Failed to fetch permissions";
            return {
                hasWrite: false, hasDelete: false, isOwner: false, roleName: null,
                isOrgProject: true, organizationId, projectId,
                isLoading: false, isError: true, error: errorMsg, accessEntries: [], availableRoles: rolesQuery.data || [],
                availableTeams: teamsQuery.data || [], availableMembers: membersQuery.data || []
            };
        }

        const accessData = accessQuery.data;
        const roles = rolesQuery.data || [];
        const accessEntries = accessData?.accessEntries || [];

        // Find user's access entry
        const userAccess = accessEntries.find(
            (entry) => entry.granteeType === "user" && entry.granteeId === userId
        );

        let hasWrite = false;
        let hasDelete = false;
        let isOwner = false;
        let roleName: string | null = null;

        if (userAccess) {
            roleName = userAccess.roleName;
            const role = roles.find((r) => r.id === userAccess.roleId);
            if (role) {
                const permissionNames = role.permissions.map((p: Permission) => p.name);
                hasWrite = permissionNames.includes("project:write");
                hasDelete = permissionNames.includes("project:delete");
                if (role.name === "Owner") {
                    isOwner = true;
                    hasWrite = true;
                    hasDelete = true;
                }
            }
        }

        return {
            hasWrite,
            hasDelete,
            isOwner,
            roleName,
            isOrgProject: true,
            organizationId,
            projectId,
            isLoading: false,
            isError: false,
            error: null,
            accessEntries,
            availableRoles: roles,
            availableTeams: teamsQuery.data || [],
            availableMembers: membersQuery.data || [],
        };

    }, [
        selectedProject, userId, projectQuery.isLoading, projectQuery.isError, projectQuery.error, projectQuery.data,
        isOrgProject, isPersonalOwner, projectId, organizationId, projectOwnerId, projectData,
        accessQuery.isLoading, accessQuery.isError, accessQuery.error, accessQuery.data,
        rolesQuery.isLoading, rolesQuery.isError, rolesQuery.error, rolesQuery.data,
        teamsQuery.data, membersQuery.data
    ]);

    const refetch = useCallback(() => {
        projectQuery.refetch();
        if (projectId && isOrgProject) {
            queryClient.invalidateQueries({ queryKey: ["resourceAccess", "project", projectId] });
        }
        if (organizationId) {
            queryClient.invalidateQueries({ queryKey: ["organizationRoles", organizationId] });
            queryClient.invalidateQueries({ queryKey: ["organization", "teams", organizationId] });
            queryClient.invalidateQueries({ queryKey: ["organization", "members", organizationId] });
        }
    }, [projectQuery, projectId, isOrgProject, organizationId, queryClient]);

    return {
        ...permissions,
        refetch
    };
}
