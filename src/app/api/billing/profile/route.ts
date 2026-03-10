import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, internalError } from '../../_utils/auth';

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

/**
 * Billing Profile API route
 *
 * Proxies GET and PATCH to the backend's unified billing-profile endpoint:
 *   /v0/billing/billing-profile
 *
 * Context (personal vs org) is derived from the API key on the backend.
 */

function buildUrl() {
  return `${ORCHESTRA_BASE_URL}/v0/billing/billing-profile`;
}

/**
 * GET /api/billing/profile
 *
 * Returns the billing profile for the current workspace.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  try {
    const url = buildUrl();
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

  try {
    const body = await request.json();
    const url = buildUrl();

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
