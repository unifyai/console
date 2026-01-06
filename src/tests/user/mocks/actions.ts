import { vi } from "vitest";
import { OrganizationActions } from "@/types/organization";
import { TeamActions } from "@/types/team";
import { RoleActions } from "@/types/role";
import { mockMembers, mockInvites, mockRoles, mockTeams, mockPermissions, mockOrganizations } from "./data";

export const mockOrgActions: OrganizationActions = {
    createOrg: vi.fn(async (name) => ({ ...mockOrganizations[0], id: 99, name })),
    deleteOrg: vi.fn(async () => undefined),
    updateOrg: vi.fn(async (id, name) => ({ ...mockOrganizations[0], id, name })),
    inviteMember: vi.fn(async () => undefined),
    removeMember: vi.fn(async () => undefined),
    updateRole: vi.fn(async () => undefined),
    transferOwnership: vi.fn(async (id, newOwnerId) => ({ ...mockOrganizations[0], owner_id: newOwnerId })),
    getMembers: vi.fn(async () => mockMembers),
    getRoles: vi.fn(async () => mockRoles),
    getAllOrganizations: vi.fn(async () => ({ organizations: [], limit: 10, offset: 0 })),
    getInvites: vi.fn(async () => ({ invites: mockInvites })),
    cancelInvite: vi.fn(async () => undefined),
};

export const mockTeamActions: TeamActions = {
    createTeam: vi.fn(async (orgId, name, description) => ({ 
        id: Math.floor(Math.random() * 1000), 
        name, 
        description, 
        organization_id: orgId, 
        created_at: new Date().toISOString(), 
        members: [] 
    })),
    updateTeam: vi.fn(async (orgId, teamId, name, description) => ({ ...mockTeams[0], id: teamId, name, description })),
    deleteTeam: vi.fn(async () => undefined),
    addTeamMember: vi.fn(async () => undefined),
    removeTeamMember: vi.fn(async () => undefined),
    getTeams: vi.fn(async () => mockTeams),
    getTeamDetails: vi.fn(async (orgId, teamId) => mockTeams.find(t => t.id === teamId) || mockTeams[0]),
};

export const mockRoleActions: RoleActions = {
    getRoles: vi.fn(async () => mockRoles),
    createRole: vi.fn(async (orgId, name, description, permissionIds) => ({
        id: 999,
        name,
        description,
        is_system_role: false,
        organization_id: orgId,
        permissions: mockPermissions.filter(p => permissionIds.includes(p.id))
    })),
    updateRole: vi.fn(async (orgId, roleId, name, description) => ({ ...mockRoles[0], id: roleId, name, description })),
    deleteRole: vi.fn(async () => undefined),
    getAllPermissions: vi.fn(async () => mockPermissions),
    addPermissionsToRole: vi.fn(async () => mockRoles[2]),
    removePermissionFromRole: vi.fn(async () => mockRoles[2]),
};