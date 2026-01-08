import {
  Organization,
  OrganizationMember,
  OrganizationRole,
  OrganizationInvite,
} from '@/types/organization';
import { Team } from '@/types/team';
import { Permission, Role } from '@/types/role';

export const mockUser = {
  id: 'user_1',
  email: 'test@unify.ai',
  name: 'Test User',
};

export const mockPermissions: Permission[] = [
  {
    id: 1,
    name: 'View Org',
    resourceType: 'organization',
    action: 'read',
    description: 'View organization details',
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Edit Org',
    resourceType: 'organization',
    action: 'write',
    description: 'Edit organization details',
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: 'Delete Org',
    resourceType: 'organization',
    action: 'delete',
    description: 'Delete organization',
    createdAt: new Date().toISOString(),
  },
  {
    id: 4,
    name: 'Manage Teams',
    resourceType: 'team',
    action: 'write',
    description: 'Create and edit teams',
    createdAt: new Date().toISOString(),
  },
];

// We cast permissions to any here because OrganizationRole expects OrganizationPermission
// which might be slightly different than Permission from @/types/role, but for mocking purposes they are compatible.
export const mockRoles: OrganizationRole[] = [
  {
    id: 1,
    name: 'Owner',
    isSystemRole: true,
    permissions: mockPermissions as any,
  },
  {
    id: 2,
    name: 'Member',
    isSystemRole: true,
    permissions: [mockPermissions[0]] as any,
  },
  {
    id: 3,
    name: 'Custom Manager',
    isSystemRole: false,
    permissions: [mockPermissions[0], mockPermissions[3]] as any,
  },
];

export const mockOrganizations: Organization[] = [
  {
    id: 1,
    name: 'Acme Corp',
    ownerId: mockUser.id,
    roleId: 1,
    roleName: 'Owner',
    apiKey: 'key_123',
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Stark Industries',
    ownerId: 'other_user',
    roleId: 2,
    roleName: 'Member',
    apiKey: 'key_456',
    createdAt: new Date().toISOString(),
  },
];

export const mockMembers: OrganizationMember[] = [
  {
    id: 1,
    userId: mockUser.id,
    organizationId: 1,
    roleId: 1,
    roleName: 'Owner',
    createdAt: new Date().toISOString(),
    name: mockUser.name,
    email: mockUser.email,
    jobTitle: 'CTO',
  },
  {
    id: 2,
    userId: 'user_2',
    organizationId: 1,
    roleId: 2,
    roleName: 'Member',
    createdAt: new Date().toISOString(),
    name: 'Jane Doe',
    email: 'jane@acme.com',
    jobTitle: 'Engineer',
  },
];

export const mockInvites: OrganizationInvite[] = [
  {
    id: 'inv_1',
    token: 'token_123',
    organizationId: 1,
    organizationName: 'Acme Corp',
    inviteeEmail: 'pending@acme.com',
    invitedByUserId: mockUser.id,
    roleId: 2,
    roleName: 'Member',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

export const mockTeams: Team[] = [
  {
    id: 101,
    name: 'Engineering',
    description: 'Core dev team',
    organizationId: 1,
    createdAt: new Date().toISOString(),
    memberCount: 2,
    members: [mockUser.id, 'user_2'],
  },
  {
    id: 102,
    name: 'Sales',
    description: 'Go to market',
    organizationId: 1,
    createdAt: new Date().toISOString(),
    memberCount: 0,
    members: [],
  },
];
