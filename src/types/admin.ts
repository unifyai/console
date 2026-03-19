import { ResponseProps } from './common';

export const ADMIN_TABLE_PAGE_SIZE = 30;

export interface OneTimeLinkResponse {
  // Used for generation response
  id: string;
  token: string;
  expiresAt: string; // ISO date string
  claimedAt?: string | null; // ISO date string
  userId?: string | null;
  organizationId?: number | null;
  creditAmount?: number | null;
}

export interface OneTimeLinkEntry {
  // Used for listing links
  id: string;
  token: string;
  expiresAt: string; // ISO date string
  claimedAt?: string | null;
  userId?: string | null;
  organizationId?: number | null;
  claimedByEmail?: string | null; // Added for displaying email
  claimedForOrg?: string | null; // Org name if claimed for an org
  creditAmount?: number | null;
}

export interface AdminCreditGrantActions {
  generateOneTimeLink: (
    expiresInDays?: number,
    creditAmount?: number | null
  ) => Promise<OneTimeLinkResponse | ResponseProps>;
  listOneTimeLinks: (limit: number, offset: number) => Promise<OneTimeLinkEntry[] | ResponseProps>;
  deleteOneTimeLink: (linkId: string) => Promise<ResponseProps>;
}

// =============================================================================
// Admin Onboarding Types
// =============================================================================

/** Organization item returned by the admin list endpoint. */
export interface AdminOrgListItem {
  id: number;
  name: string;
  ownerId: string;
  ownerEmail?: string;
  createdAt?: string;
  memberCount: number;
}

/** Paginated org list response. */
export interface AdminOrgListResponse {
  organizations: AdminOrgListItem[];
  limit: number;
  offset: number;
}

/** Enriched org detail for the admin panel. */
export interface AdminOrgDetail {
  id: number;
  name: string;
  ownerId: string;
  ownerEmail?: string;
  memberCount: number;
  createdAt?: string;
  freeTrial: boolean;
  verified: boolean;
  verifiedAt: string | null;
  // Billing fields (may be null if no billing account)
  billingAccountId: number | null;
  credits: number;
  accountStatus: string;
  tier: string | null;
  stripeCustomerId: string | null;
}

/** User lookup result from admin endpoint. */
export interface AdminUserLookup {
  id: string;
  email: string;
  name: string;
  lastName?: string;
  image?: string | null;
  organizations?: Array<{ id: number; name: string; roleName?: string }>;
}

/** Pending invite entry returned by the admin list-invites endpoint. */
export interface AdminOrgInvite {
  id: string;
  email: string;
  status: 'pending' | 'expired';
  createdAt: string | null;
  expiresAt: string | null;
}

/** Actions available on the admin onboarding page. */
export interface AdminOnboardingActions {
  // Organization browsing
  listOrganizations: (
    nameFilter?: string,
    limit?: number,
    offset?: number
  ) => Promise<AdminOrgListResponse | ResponseProps>;
  getOrganizationDetail: (orgId: number) => Promise<AdminOrgDetail | ResponseProps>;

  // User lookup + org creation
  lookupUserByEmail: (email: string) => Promise<AdminUserLookup | ResponseProps>;
  createOrganizationForUser: (
    name: string,
    creatorUserId: string
  ) => Promise<ResponseProps>;

  // Invite user to org + list invites
  inviteUserToOrg: (orgId: number, email: string, roleId?: number, roleName?: string) => Promise<ResponseProps>;
  listOrgInvites: (orgId: number) => Promise<AdminOrgInvite[] | ResponseProps>;

  // Free trial
  enableFreeTrial: (orgId: number) => Promise<ResponseProps>;
  disableFreeTrial: (orgId: number) => Promise<ResponseProps>;

  // Verification
  verifyOrganization: (orgId: number) => Promise<ResponseProps>;
  unverifyOrganization: (orgId: number) => Promise<ResponseProps>;

  // Billing management
  addCredits: (
    orgId: number,
    amount: number,
    type: string
  ) => Promise<ResponseProps>;
  freezeAccount: (orgId: number, freeze: boolean) => Promise<ResponseProps>;
}
