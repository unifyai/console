import { ResponseProps } from './common';
import { SpendingDisplayProps } from './assistants/spending';

// Re-export spending display types for organization spending
export type { SpendingDisplayProps } from './assistants/spending';
export { formatSpendAmount, getCurrentMonth } from './assistants/spending';

// Re-export OpenAPI-generated types for new code
// These are auto-generated from Orchestra's OpenAPI spec
export type {
  Organization as ApiOrganization,
  OrganizationMember as ApiOrganizationMember,
  InviteResponse,
  RoleResponse,
} from './orchestra';

/**
 * Organization type used in the frontend.
 * Note: Consider migrating to ApiOrganization from '@/types/orchestra' for type safety.
 * This type includes frontend-specific fields (roleId, roleName, apiKey) not in the API.
 */
export interface Organization {
  id: number;
  name: string;
  ownerId?: string;
  billingUserId?: string;
  createdAt?: string;
  roleId?: number;
  roleName?: string;
  apiKey?: string;
  image?: string | null;
  timezone?: string | null;
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
  updateOrg: (
    orgId: number,
    name: string,
    timezone?: string | null
  ) => Promise<Organization | ResponseProps>;
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

// =============================================================================
// Organization Spending Types
// =============================================================================

/**
 * Cumulative spend data for an organization in a given month.
 * Returned by GET /admin/organization/{id}/spend
 */
export interface OrgSpend {
  /** Organization ID */
  orgId: number;
  /** Month in YYYY-MM format */
  month: string;
  /** Total spend for the month in dollars (aggregated from all members/assistants) */
  cumulativeSpend: number;
  /** Monthly spending limit in dollars (null = unlimited) */
  limit: number | null;
  /** Percentage of limit used (0-100+, can exceed 100 for soft limits) */
  percentUsed: number;
}

/**
 * Spending limit configuration for an organization.
 * Retrieved via GET /organization/{id} or PATCH /organization/{id}
 */
export interface OrgSpendingLimitResponse {
  /** Organization ID */
  orgId: number;
  /** Configured monthly spending cap in dollars (null = no limit) */
  monthlySpendingCap: number | null;
}

/**
 * Request payload for setting an organization spending limit.
 * Used with PATCH /organization/{id}
 */
export interface OrgSpendingLimitRequest {
  /** Monthly spending cap in dollars (null to remove limit) */
  monthlySpendingCap: number | null;
}

/**
 * Type guard to check if a response is an error.
 */
export function isOrgSpendError(response: OrgSpend | ResponseProps): response is ResponseProps {
  return 'detail' in response;
}

/**
 * Type guard to check if a response is org spend data.
 */
export function isOrgSpendData(response: OrgSpend | ResponseProps): response is OrgSpend {
  return 'cumulativeSpend' in response && 'orgId' in response;
}

/**
 * Type guard for org spending limit error.
 */
export function isOrgSpendingLimitError(
  response: OrgSpendingLimitResponse | ResponseProps
): response is ResponseProps {
  return 'detail' in response;
}

/**
 * Type guard for org spending limit data.
 */
export function isOrgSpendingLimitData(
  response: OrgSpendingLimitResponse | ResponseProps
): response is OrgSpendingLimitResponse {
  return 'monthlySpendingCap' in response && 'orgId' in response;
}

/**
 * Calculate display props from org spending data.
 * Reuses the same logic as assistant spending display.
 */
export function calculateOrgSpendingDisplay(spend: OrgSpend): SpendingDisplayProps {
  const isUnlimited = spend.limit === null;
  const isOverLimit = !isUnlimited && spend.cumulativeSpend >= spend.limit!;
  const isNearLimit = !isUnlimited && !isOverLimit && spend.percentUsed >= 80;
  return {
    currentSpend: spend.cumulativeSpend,
    limit: spend.limit,
    percentUsed: spend.percentUsed,
    isOverLimit,
    isNearLimit,
    isUnlimited,
  };
}

// =============================================================================
// Organization Member Spending Types
// =============================================================================

/**
 * Cumulative spend data for an organization member in a given month.
 * Returned by GET /admin/organization/{org_id}/members/{user_id}/spend
 */
export interface MemberSpend {
  /** Organization ID */
  orgId: number;
  /** User ID of the member */
  userId: string;
  /** Month in YYYY-MM format */
  month: string;
  /** Total spend for the month in dollars */
  cumulativeSpend: number;
  /** Monthly spending limit in dollars (null = unlimited) */
  limit: number | null;
  /** Percentage of limit used (0-100+, can exceed 100 for soft limits) */
  percentUsed: number;
}

/**
 * Spending limit configuration for an organization member.
 * Retrieved via GET /organizations/{org_id}/members/{user_id}/spending-limit
 */
export interface MemberSpendingLimitResponse {
  /** Organization ID */
  orgId: number;
  /** User ID of the member */
  userId: string;
  /** Configured monthly spending cap in dollars (null = no limit) */
  monthlySpendingCap: number | null;
  /** Number of org assistants owned by this member that were capped during cascade */
  cascadedUpdates?: { assistantsCapped?: number } | null;
}

/**
 * Request payload for setting a member spending limit.
 * Used with PUT /organizations/{org_id}/members/{user_id}/spending-limit
 */
export interface MemberSpendingLimitRequest {
  /** Monthly spending cap in dollars (null to remove limit) */
  monthlySpendingCap: number | null;
}

/**
 * Type guard to check if a response is an error.
 */
export function isMemberSpendError(
  response: MemberSpend | ResponseProps
): response is ResponseProps {
  return 'detail' in response;
}

/**
 * Type guard to check if a response is member spend data.
 */
export function isMemberSpendData(response: MemberSpend | ResponseProps): response is MemberSpend {
  return 'cumulativeSpend' in response && 'userId' in response && 'orgId' in response;
}

/**
 * Type guard for member spending limit error.
 */
export function isMemberSpendingLimitError(
  response: MemberSpendingLimitResponse | ResponseProps
): response is ResponseProps {
  return 'detail' in response;
}

/**
 * Type guard for member spending limit data.
 */
export function isMemberSpendingLimitData(
  response: MemberSpendingLimitResponse | ResponseProps
): response is MemberSpendingLimitResponse {
  return 'monthlySpendingCap' in response && 'userId' in response && 'orgId' in response;
}

/**
 * Calculate display props from member spending data.
 */
export function calculateMemberSpendingDisplay(spend: MemberSpend): SpendingDisplayProps {
  const isUnlimited = spend.limit === null;
  const isOverLimit = !isUnlimited && spend.cumulativeSpend >= spend.limit!;
  const isNearLimit = !isUnlimited && !isOverLimit && spend.percentUsed >= 80;
  return {
    currentSpend: spend.cumulativeSpend,
    limit: spend.limit,
    percentUsed: spend.percentUsed,
    isOverLimit,
    isNearLimit,
    isUnlimited,
  };
}
