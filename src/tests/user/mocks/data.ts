import { Organization, OrganizationMember, OrganizationRole, OrganizationInvite } from "@/types/organization";
import { Team } from "@/types/team";
import { Permission, Role } from "@/types/role";

export const mockUser = {
    id: "user_1",
    email: "test@unify.ai",
    name: "Test User"
};

export const mockPermissions: Permission[] = [
    { 
        id: 1, 
        name: "View Org", 
        resource_type: "organization", 
        action: "read", 
        description: "View organization details",
        created_at: new Date().toISOString()
    },
    { 
        id: 2, 
        name: "Edit Org", 
        resource_type: "organization", 
        action: "write", 
        description: "Edit organization details",
        created_at: new Date().toISOString()
    },
    { 
        id: 3, 
        name: "Delete Org", 
        resource_type: "organization", 
        action: "delete", 
        description: "Delete organization",
        created_at: new Date().toISOString()
    },
    { 
        id: 4, 
        name: "Manage Teams", 
        resource_type: "team", 
        action: "write", 
        description: "Create and edit teams",
        created_at: new Date().toISOString()
    },
];

// We cast permissions to any here because OrganizationRole expects OrganizationPermission 
// which might be slightly different than Permission from @/types/role, but for mocking purposes they are compatible.
export const mockRoles: OrganizationRole[] = [
    { 
        id: 1, 
        name: "Owner", 
        is_system_role: true, 
        permissions: mockPermissions as any 
    },
    { 
        id: 2, 
        name: "Member", 
        is_system_role: true, 
        permissions: [mockPermissions[0]] as any
    },
    { 
        id: 3, 
        name: "Custom Manager", 
        is_system_role: false, 
        permissions: [mockPermissions[0], mockPermissions[3]] as any
    },
];

export const mockOrganizations: Organization[] = [
    {
        id: 1,
        name: "Acme Corp",
        owner_id: mockUser.id,
        role_id: 1,
        role_name: "Owner",
        apiKey: "key_123",
        created_at: new Date().toISOString()
    },
    {
        id: 2,
        name: "Stark Industries",
        owner_id: "other_user",
        role_id: 2,
        role_name: "Member",
        apiKey: "key_456",
        created_at: new Date().toISOString()
    }
];

export const mockMembers: OrganizationMember[] = [
    {
        id: 1,
        user_id: mockUser.id,
        organization_id: 1,
        role_id: 1,
        role_name: "Owner",
        created_at: new Date().toISOString(),
        name: mockUser.name,
        email: mockUser.email,
        jobTitle: "CTO"
    },
    {
        id: 2,
        user_id: "user_2",
        organization_id: 1,
        role_id: 2,
        role_name: "Member",
        created_at: new Date().toISOString(),
        name: "Jane Doe",
        email: "jane@acme.com",
        jobTitle: "Engineer"
    }
];

export const mockInvites: OrganizationInvite[] = [
    {
        id: "inv_1",
        token: "token_123",
        organization_id: 1,
        organization_name: "Acme Corp",
        invitee_email: "pending@acme.com",
        invited_by_user_id: mockUser.id,
        role_id: 2,
        role_name: "Member",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString()
    }
];

export const mockTeams: Team[] = [
    {
        id: 101,
        name: "Engineering",
        description: "Core dev team",
        organization_id: 1,
        created_at: new Date().toISOString(),
        member_count: 2,
        members: [mockUser.id, "user_2"]
    },
    {
        id: 102,
        name: "Sales",
        description: "Go to market",
        organization_id: 1,
        created_at: new Date().toISOString(),
        member_count: 0,
        members: []
    }
];