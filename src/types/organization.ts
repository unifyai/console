import { ResponseProps } from './common';

export interface Organization {
  id: number;
  name: string;
  ownerId?: string;
  billingUserId?: string;
  createdAt?: string;
  roleId?: number;
  roleName?: string;
  apiKey?: string;
}

export interface OrganizationMember {
  id: number;
  userId: string;
  organizationId: number;
  roleId: number | null;
  roleName: string | null;
  createdAt: string;
  name?: string;
  email?: string;
  jobTitle?: string;
  bio?: string;
}

export interface OrganizationPermission {
  id: number;
  name: string;
  resourceType: string; // e.g., 'org'
  action: string; // e.g., 'read', 'write', 'delete'
}

export interface OrganizationRole {
  id: number;
  name: string;
  description?: string;
  isSystemRole: boolean;
  organizationId?: number;
  permissions: OrganizationPermission[];
}

export interface OrganizationListItem {
  id: number;
  name: string;
  ownerId: string;
  billingUserId?: string;
  createdAt?: string;
  memberCount: number;
}

export interface OrganizationListResponse {
  organizations: OrganizationListItem[];
  limit: number;
  offset: number;
}

export interface OrganizationInvite {
  id: string;
  token: string;
  organizationId: number;
  organizationName: string;
  inviteeEmail: string;
  invitedByUserId: string;
  invitedByName?: string;
  roleId: number;
  roleName?: string;
  expiresAt: string;
  createdAt: string;
}

export interface OrganizationInviteListResponse {
  invites: OrganizationInvite[];
}

export interface UserOrganizationCheckResult {
  isInOrganization: boolean;
  organizationName?: string;
}

export interface OrganizationActions {
  createOrg: (name: string) => Promise<Organization | ResponseProps>;
  deleteOrg: (id: number) => Promise<void | ResponseProps>;
  updateOrg: (orgId: number, name: string) => Promise<Organization | ResponseProps>;
  inviteMember: (orgId: number, email: string, roleId?: number) => Promise<void | ResponseProps>;
  removeMember: (orgId: number, userId: string) => Promise<void | ResponseProps>;
  updateRole: (orgId: number, userId: string, roleId: number) => Promise<void | ResponseProps>;
  transferOwnership: (orgId: number, newOwnerId: string) => Promise<Organization | ResponseProps>;
  getMembers: (orgId: number) => Promise<OrganizationMember[] | ResponseProps>;
  getRoles: (orgId: number) => Promise<OrganizationRole[] | ResponseProps>;
  getAllOrganizations: (nameFilter?: string) => Promise<OrganizationListResponse | ResponseProps>;
  getInvites: (orgId: number) => Promise<OrganizationInviteListResponse | ResponseProps>;
  cancelInvite: (orgId: number, inviteId: string) => Promise<void | ResponseProps>;
  checkUserOrganization?: (email: string) => Promise<UserOrganizationCheckResult | ResponseProps>;
}
