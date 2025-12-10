import { ResponseProps } from "./common";

export interface Organization {
  id: number;
  name: string;
  owner_id?: string;
  billing_user_id?: string;
  created_at?: string;
  level?: string;
  apiKey?: string;
}

export interface OrganizationMember {
  id: number;
  user_id: string;
  organization_id: number;
  level: string;
  role_id: number | null;
  role_name: string | null;
  created_at: string;
  name?: string;
  email?: string;
  jobTitle?: string;
  bio?: string;
}

export interface OrganizationPermission {
  id: number;
  name: string;
  resource_type: string; // e.g., 'org'
  action: string;        // e.g., 'read', 'write', 'delete'
}

export interface OrganizationRole {
  id: number;
  name: string;
  description?: string;
  is_system_role: boolean;
  organization_id?: number;
  permissions: OrganizationPermission[];
}

export interface OrganizationListItem {
  id: number;
  name: string;
  owner_id: string;
  billing_user_id?: string;
  created_at?: string;
  member_count: number;
}

export interface OrganizationListResponse {
  organizations: OrganizationListItem[];
  limit: number;
  offset: number;
}

export interface OrganizationInvite {
  id: string;
  token: string;
  organization_id: number;
  organization_name: string;
  invitee_email: string;
  invited_by_user_id: string;
  invited_by_name?: string;
  role_id: number;
  role_name?: string;
  level: string;
  expires_at: string;
  created_at: string;
}

export interface OrganizationInviteListResponse {
  invites: OrganizationInvite[];
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
}