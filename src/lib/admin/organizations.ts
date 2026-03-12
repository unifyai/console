/**
 * Admin Organizations Server Actions
 *
 * Wraps Orchestra admin endpoints for organization management:
 * - Browsing / searching organizations
 * - Creating organizations on behalf of users
 * - Toggling free trial & verification status
 * - Basic billing account management (credits, freeze)
 * - Inviting users to organizations
 *
 * All actions use the ORCHESTRA_ADMIN_KEY and are only callable from
 * server components / server actions (never exposed to the client).
 */

'use server';

import { snakeToCamelObject } from '@/utils/casing';
import type {
  AdminOrgListResponse,
  AdminOrgDetail,
  AdminUserLookup,
  AdminOrgInvite,
} from '@/types/admin';
import type { ResponseProps } from '@/types/common';

const backendUrl = `${process.env.ORCHESTRA_URL}/v0`;
const adminKey = process.env.ORCHESTRA_ADMIN_KEY;

// ---------------------------------------------------------------------------
// Helper – identical to the one in lib/orchestra/api/organization.ts
// ---------------------------------------------------------------------------

const safeFetch = async (
  url: string,
  options: RequestInit,
  context: string
): Promise<unknown> => {
  try {
    const response = await fetch(url, { ...options, cache: 'no-store' });

    if (response.status === 204) return {};

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        const errorMessage =
          data.detail || data.error || `Operation failed: ${response.statusText}`;
        return { detail: errorMessage, status: response.status };
      }
      return snakeToCamelObject(data as Record<string, unknown>);
    }

    if (!response.ok) return { detail: response.statusText, status: response.status };
    return {};
  } catch (error) {
    console.error(`[admin/organizations ${context}] Error:`, error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage, status: 500 };
  }
};

const adminHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  Authorization: `Bearer ${adminKey}`,
};

// =============================================================================
// Organization Browsing
// =============================================================================

export async function listOrganizationsAction() {
  return async (
    nameFilter?: string,
    limit = 100,
    offset = 0
  ): Promise<AdminOrgListResponse | ResponseProps> => {
    'use server';
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (nameFilter) params.set('name', nameFilter);

    return safeFetch(
      `${backendUrl}/admin/organizations?${params}`,
      { method: 'GET', headers: adminHeaders },
      'listOrganizations'
    ) as Promise<AdminOrgListResponse | ResponseProps>;
  };
}

export async function getOrganizationDetailAction() {
  return async (orgId: number): Promise<AdminOrgDetail | ResponseProps> => {
    'use server';

    // Fetch verification status and billing info in parallel
    const [verificationResult, billingResult] = await Promise.all([
      safeFetch(
        `${backendUrl}/admin/organization/${orgId}/verification`,
        { method: 'GET', headers: adminHeaders },
        'getOrgVerification'
      ) as Promise<Record<string, unknown> | ResponseProps>,
      safeFetch(
        `${backendUrl}/admin/billing/account-info?organization_id=${orgId}`,
        { method: 'GET', headers: adminHeaders },
        'getOrgBillingInfo'
      ) as Promise<Record<string, unknown> | ResponseProps>,
    ]);

    // Fetch the org itself (for freeTrial, name, etc.)
    const orgResult = (await safeFetch(
      `${backendUrl}/admin/organizations?name=&limit=1000&offset=0`,
      { method: 'GET', headers: adminHeaders },
      'getOrgForDetail'
    )) as Record<string, unknown> | ResponseProps;

    if ('detail' in orgResult) return orgResult as ResponseProps;

    const orgList = (orgResult as Record<string, unknown>).organizations as Array<
      Record<string, unknown>
    >;
    const org = orgList?.find((o) => o.id === orgId);

    if (!org) return { detail: 'Organization not found', status: 404 };

    const verification =
      verificationResult && !('detail' in verificationResult)
        ? (verificationResult as Record<string, unknown>)
        : {};
    const billing =
      billingResult && !('detail' in billingResult)
        ? (billingResult as Record<string, unknown>)
        : {};

    return {
      id: org.id as number,
      name: org.name as string,
      ownerId: org.ownerId as string,
      ownerEmail: (org.ownerEmail as string) ?? undefined,
      memberCount: (org.memberCount as number) ?? 0,
      createdAt: org.createdAt as string | undefined,
      freeTrial: (verification.freeTrial as boolean) ?? false,
      verified: (verification.verified as boolean) ?? false,
      verifiedAt: (verification.verifiedAt as string) ?? null,
      billingAccountId: (billing.billingAccountId as number) ?? null,
      credits: (billing.credits as number) ?? 0,
      accountStatus: (billing.accountStatus as string) ?? 'UNKNOWN',
      tier: (billing.tier as string) ?? null,
      stripeCustomerId: (billing.stripeCustomerId as string) ?? null,
    } as AdminOrgDetail;
  };
}

// =============================================================================
// User Lookup + Organization Creation
// =============================================================================

export async function lookupUserByEmailAction() {
  return async (email: string): Promise<AdminUserLookup | ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/admin/user/by-email?email=${encodeURIComponent(email)}`,
      { method: 'GET', headers: adminHeaders },
      'lookupUserByEmail'
    ) as Promise<AdminUserLookup | ResponseProps>;
  };
}

export async function createOrganizationForUserAction() {
  return async (
    name: string,
    creatorUserId: string
  ): Promise<ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/admin/organizations`,
      {
        method: 'POST',
        headers: adminHeaders,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        body: JSON.stringify({ name, creator_user_id: creatorUserId }),
      },
      'createOrganizationForUser'
    ) as Promise<ResponseProps>;
  };
}

// =============================================================================
// Invite User to Organization
// =============================================================================

export async function inviteUserToOrgAction() {
  return async (orgId: number, email: string): Promise<ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/admin/organization/${orgId}/invite`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ email }),
      },
      'inviteUserToOrg'
    ) as Promise<ResponseProps>;
  };
}

export async function listOrgInvitesAction() {
  return async (orgId: number): Promise<AdminOrgInvite[] | ResponseProps> => {
    'use server';
    const result = await safeFetch(
      `${backendUrl}/admin/organization/${orgId}/invites`,
      { method: 'GET', headers: adminHeaders },
      'listOrgInvites'
    );
    if (typeof result === 'object' && result !== null && 'detail' in result) {
      return result as ResponseProps;
    }
    // Result is an array – each item needs camelCase conversion
    if (Array.isArray(result)) {
      return result.map((item) =>
        snakeToCamelObject(item as Record<string, unknown>)
      ) as unknown as AdminOrgInvite[];
    }
    return [];
  };
}

// =============================================================================
// Free Trial
// =============================================================================

export async function enableFreeTrialAction() {
  return async (orgId: number): Promise<ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/admin/organization/${orgId}/free-trial`,
      { method: 'PUT', headers: adminHeaders },
      'enableFreeTrial'
    ) as Promise<ResponseProps>;
  };
}

export async function disableFreeTrialAction() {
  return async (orgId: number): Promise<ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/admin/organization/${orgId}/free-trial`,
      { method: 'DELETE', headers: adminHeaders },
      'disableFreeTrial'
    ) as Promise<ResponseProps>;
  };
}

// =============================================================================
// Verification
// =============================================================================

export async function verifyOrganizationAction() {
  return async (orgId: number): Promise<ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/admin/organization/${orgId}/verify`,
      { method: 'PUT', headers: adminHeaders },
      'verifyOrganization'
    ) as Promise<ResponseProps>;
  };
}

export async function unverifyOrganizationAction() {
  return async (orgId: number): Promise<ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/admin/organization/${orgId}/verify`,
      { method: 'DELETE', headers: adminHeaders },
      'unverifyOrganization'
    ) as Promise<ResponseProps>;
  };
}

// =============================================================================
// Billing Management
// =============================================================================

export async function addCreditsAction() {
  return async (
    orgId: number,
    amount: number,
    type: string
  ): Promise<ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/admin/create_recharge`,
      {
        method: 'POST',
        headers: adminHeaders,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        body: JSON.stringify({ organization_id: orgId, quantity: amount, type }),
      },
      'addCredits'
    ) as Promise<ResponseProps>;
  };
}

export async function freezeAccountAction() {
  return async (
    orgId: number,
    freeze: boolean
  ): Promise<ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/admin/billing/freeze?freeze=${freeze}&organization_id=${orgId}`,
      { method: 'POST', headers: adminHeaders },
      'freezeAccount'
    ) as Promise<ResponseProps>;
  };
}

