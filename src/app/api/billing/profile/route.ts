import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, internalError, getWorkspaceBillingContext } from '../../_utils/auth';

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

/**
 * Billing Profile API route
 *
 * Proxies GET and PATCH to the backend's billing-profile endpoints:
 * - Personal workspace: /v0/user/billing/billing-profile
 * - Organization workspace: /v0/organizations/{org_id}/billing/billing-profile
 *
 * This replaces the old account-type + business-info + client-side Stripe sync flow
 * with a single backend-managed endpoint that handles all billing profile fields
 * and Stripe synchronisation.
 */

function buildUrl(ctx: NonNullable<Awaited<ReturnType<typeof getWorkspaceBillingContext>>>) {
  if (ctx.type === 'organization' && ctx.organizationId) {
    return `${ORCHESTRA_BASE_URL}/v0/organizations/${ctx.organizationId}/billing/billing-profile`;
  }
  return `${ORCHESTRA_BASE_URL}/v0/user/billing/billing-profile`;
}

/**
 * GET /api/billing/profile
 *
 * Returns the billing profile for the current workspace.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  const ctx = await getWorkspaceBillingContext();
  if (!ctx) return unauthorized('No workspace context');

  try {
    const url = buildUrl(ctx);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(data ?? { detail: 'Unknown error' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('Error fetching billing profile:', e);
    return internalError('Failed to fetch billing profile');
  }
}

/**
 * PATCH /api/billing/profile
 *
 * Updates the billing profile for the current workspace.
 * Accepts partial fields: individual_name, billing_email, tax_id,
 * tax_id_type, billing_address.
 */
export async function PATCH(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  const ctx = await getWorkspaceBillingContext();
  if (!ctx) return unauthorized('No workspace context');

  try {
    const body = await request.json();
    const url = buildUrl(ctx);

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(data ?? { detail: 'Unknown error' }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('Error updating billing profile:', e);
    return internalError('Failed to update billing profile');
  }
}
