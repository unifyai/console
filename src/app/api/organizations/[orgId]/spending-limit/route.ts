/**
 * API Routes: GET/PATCH /api/organizations/[orgId]/spending-limit
 *
 * GET: Fetches the organization's spending limit configuration.
 *      Proxies to Orchestra: GET /v0/organizations/{id}/spending-limit
 *      Returns: { orgId, monthlySpendingCap }
 *
 * PATCH: Updates the organization's monthly spending limit.
 *        Proxies to Orchestra: PUT /v0/organizations/{id}/spending-limit
 *        Body: { monthlySpendingCap: number | null }
 *        Returns: { orgId, monthlySpendingCap, cascadedUpdates? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

/**
 * GET /api/organizations/[orgId]/spending-limit
 *
 * Fetches the organization's spending limit configuration.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const { orgId } = await params;

  // Validate org ID is a valid integer
  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid organization ID format. Must be an integer.');
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.GET(
      '/v0/organizations/{organization_id}/spending-limit',
      {
        params: {
          path: { organization_id: organizationId },
        },
      }
    );

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    // Orchestra client middleware transforms response to camelCase at runtime
    const spendingLimitResponse = {
      orgId: organizationId,
      monthlySpendingCap:
        (data as { monthlySpendingCap?: number | null })?.monthlySpendingCap ?? null,
    };

    return NextResponse.json(spendingLimitResponse, { status: 200 });
  } catch (e: unknown) {
    console.error(
      '[API /api/organizations/[orgId]/spending-limit GET] Error:',
      e instanceof Error ? e.message : e
    );
    return NextResponse.json(
      { detail: 'Failed to fetch organization spending limit' },
      {
        status: 500,
      }
    );
  }
}

/**
 * PATCH /api/organizations/[orgId]/spending-limit
 *
 * Updates the organization's monthly spending limit.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const { orgId } = await params;

  // Validate org ID is a valid integer
  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid organization ID format. Must be an integer.');
  }

  // Parse request body
  let body: { monthlySpendingCap?: number | null };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  // Validate monthlySpendingCap field
  if (!('monthlySpendingCap' in body)) {
    return badRequest('Missing required field: monthlySpendingCap');
  }

  const { monthlySpendingCap } = body;
  if (
    monthlySpendingCap !== null &&
    (typeof monthlySpendingCap !== 'number' || monthlySpendingCap < 0)
  ) {
    return badRequest('monthlySpendingCap must be a non-negative number or null');
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.PUT(
      '/v0/organizations/{organization_id}/spending-limit',
      {
        params: {
          path: { organization_id: organizationId },
        },
        body: { monthly_spending_cap: monthlySpendingCap },
      }
    );

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    // Return the updated spending limit info (including any cascade info from Orchestra)
    // Orchestra client middleware transforms response to camelCase at runtime
    type OrgSpendingLimitData = {
      monthlySpendingCap?: number | null;
      cascadedUpdates?: { [key: string]: number } | null;
    };
    const responseData = data as OrgSpendingLimitData;
    const spendingLimitResponse = {
      orgId: organizationId,
      monthlySpendingCap: responseData?.monthlySpendingCap ?? null,
      cascadedUpdates: responseData?.cascadedUpdates ?? null,
      info: 'Spending limit updated successfully',
    };

    return NextResponse.json(spendingLimitResponse, { status: 200 });
  } catch (e: unknown) {
    console.error(
      '[API /api/organizations/[orgId]/spending-limit PATCH] Error:',
      e instanceof Error ? e.message : e
    );
    return NextResponse.json(
      { detail: 'Failed to update organization spending limit' },
      {
        status: 500,
      }
    );
  }
}
