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
  AdminBillingProfile,
} from '@/types/admin';
import type { ResponseProps } from '@/types/common';

const backendUrl = `${process.env.ORCHESTRA_URL}/v0`;
const adminKey = process.env.ORCHESTRA_ADMIN_KEY;

// ---------------------------------------------------------------------------
// Helper – identical to the one in lib/orchestra/api/organization.ts
// ---------------------------------------------------------------------------

const safeFetch = async (url: string, options: RequestInit, context: string): Promise<unknown> => {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
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

    // Backend returns ``billing_profile`` as a snake_case nested object;
    // safeFetch's response is already snakeToCamel-converted upstream
    // (verified by the matching keys on ``billing.billingAccountId``).
    // If for any reason it's absent we fall back to an empty profile so
    // downstream UI code can render the "Not set" path uniformly.
    const profile = (billing.billingProfile as Record<string, unknown>) ?? {};
    const profileAddress = (profile.billingAddress as Record<string, unknown> | undefined) ?? {};

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
      billingProfile: {
        billingEmail: (profile.billingEmail as string) ?? null,
        name: (profile.name as string) ?? null,
        taxId: (profile.taxId as string) ?? null,
        taxIdType: (profile.taxIdType as string) ?? null,
        billingAddress: {
          line1: (profileAddress.line1 as string) ?? '',
          line2: (profileAddress.line2 as string) ?? '',
          city: (profileAddress.city as string) ?? '',
          state: (profileAddress.state as string) ?? '',
          postalCode: (profileAddress.postalCode as string) ?? '',
          country: (profileAddress.country as string) ?? '',
        },
      },
      planGroupId: typeof billing.planGroupId === 'number' ? billing.planGroupId : 1,
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
  return async (name: string, creatorUserId: string): Promise<ResponseProps> => {
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
  return async (
    orgId: number,
    email: string,
    roleId?: number,
    roleName?: string
  ): Promise<ResponseProps> => {
    'use server';
    const body: Record<string, unknown> = { email };
    if (roleId !== undefined) {
      body.role_id = roleId;
    }
    if (roleName !== undefined) {
      body.role_name = roleName;
    }
    return safeFetch(
      `${backendUrl}/admin/organization/${orgId}/invite`,
      {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(body),
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
  return async (orgId: number, amount: number, type: string): Promise<ResponseProps> => {
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
  return async (orgId: number, freeze: boolean): Promise<ResponseProps> => {
    'use server';
    return safeFetch(
      `${backendUrl}/admin/billing/freeze?freeze=${freeze}&organization_id=${orgId}`,
      { method: 'POST', headers: adminHeaders },
      'freezeAccount'
    ) as Promise<ResponseProps>;
  };
}

/**
 * Update a billing account's business profile via the admin endpoint.
 * Partial — only fields explicitly provided are persisted.
 * ``billingAddress`` is merged with the existing dict server-side, so
 * the dialog can patch a single line without re-sending everything.
 *
 * The backend best-effort-syncs the same fields to the existing
 * Stripe Customer (if any), so the next monthly invoice picks up the
 * new addressee data.
 */
export async function updateBillingProfileAction() {
  return async (
    orgId: number,
    profile: Partial<AdminBillingProfile>
  ): Promise<AdminBillingProfile | ResponseProps> => {
    'use server';
    /* eslint-disable @typescript-eslint/naming-convention */
    const address = profile.billingAddress;
    const body: Record<string, unknown> = {
      organization_id: orgId,
      is_business: true,
    };
    if (profile.billingEmail !== undefined) body.billing_email = profile.billingEmail;
    if (profile.name !== undefined) body.name = profile.name;
    if (profile.taxId !== undefined) body.tax_id = profile.taxId;
    if (profile.taxIdType !== undefined) body.tax_id_type = profile.taxIdType;
    if (address !== undefined) {
      body.billing_address = {
        line1: address.line1 ?? '',
        line2: address.line2 ?? '',
        city: address.city ?? '',
        state: address.state ?? '',
        postal_code: address.postalCode ?? '',
        country: address.country ?? '',
      };
    }
    /* eslint-enable @typescript-eslint/naming-convention */

    const result = (await safeFetch(
      `${backendUrl}/admin/billing/profile`,
      {
        method: 'PUT',
        headers: { ...adminHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      'updateBillingProfile'
    )) as Record<string, unknown> | ResponseProps;

    if ('detail' in result) return result as ResponseProps;

    const r = result as Record<string, unknown>;
    const addr = (r.billingAddress as Record<string, unknown> | undefined) ?? {};
    return {
      billingEmail: (r.billingEmail as string) ?? null,
      name: (r.name as string) ?? null,
      taxId: (r.taxId as string) ?? null,
      taxIdType: (r.taxIdType as string) ?? null,
      billingAddress: {
        line1: (addr.line1 as string) ?? '',
        line2: (addr.line2 as string) ?? '',
        city: (addr.city as string) ?? '',
        state: (addr.state as string) ?? '',
        postalCode: (addr.postalCode as string) ?? '',
        country: (addr.country as string) ?? '',
      },
    };
  };
}
