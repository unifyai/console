/**
 * API Routes: GET/PUT /api/organizations/[orgId]/members/[userId]/spending-limit
 *
 * GET: Fetches the member's spending limit within the organization.
 *      Proxies to Orchestra: GET /v0/organizations/{org_id}/members/{user_id}/spending-limit
 *      Returns: { orgId, userId, monthlySpendingCap }
 *
 * PUT: Updates the member's monthly spending limit within the organization.
 *      Proxies to Orchestra: PUT /v0/organizations/{org_id}/members/{user_id}/spending-limit
 *      Body: { monthlySpendingCap: number | null }
 *      Returns: { orgId, userId, monthlySpendingCap, cascadedUpdates? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

/**
 * GET /api/organizations/[orgId]/members/[userId]/spending-limit
 *
 * Fetches the member's spending limit configuration.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const { orgId, userId } = await params;

  // Validate org ID is a valid integer
  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid organization ID format. Must be an integer.');
  }

  // Validate userId is present
  if (!userId || typeof userId !== 'string') {
    return badRequest('Invalid user ID format.');
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.GET(
      '/v0/organizations/{organization_id}/members/{member_user_id}/spending-limit',
      {
        params: {
          path: { organization_id: organizationId, member_user_id: userId },
        },
      }
    );

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    // Data is already camelCase from the responseMiddleware
    type MemberSpendingLimitData = {
      organizationId?: number;
      userId?: string;
      monthlySpendingCap?: number | null;
    };
    const responseData = data as MemberSpendingLimitData;

    const spendingLimitResponse = {
      orgId: responseData?.organizationId ?? organizationId,
      userId: responseData?.userId ?? userId,
      monthlySpendingCap: responseData?.monthlySpendingCap ?? null,
    };

    return NextResponse.json(spendingLimitResponse, { status: 200 });
  } catch (e: unknown) {
    console.error(
      '[API /api/organizations/[orgId]/members/[userId]/spending-limit GET] Error:',
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ detail: 'Failed to fetch member spending limit' }, { status: 500 });
  }
}

/**
 * PUT /api/organizations/[orgId]/members/[userId]/spending-limit
 *
 * Updates the member's monthly spending limit.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const { orgId, userId } = await params;

  // Validate org ID is a valid integer
  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid organization ID format. Must be an integer.');
  }

  // Validate userId is present
  if (!userId || typeof userId !== 'string') {
    return badRequest('Invalid user ID format.');
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
      '/v0/organizations/{organization_id}/members/{member_user_id}/spending-limit',
      {
        params: {
          path: { organization_id: organizationId, member_user_id: userId },
        },
        body: { monthly_spending_cap: monthlySpendingCap },
      }
    );

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    // Data is already camelCase from the responseMiddleware
    type MemberSpendingLimitData = {
      organizationId?: number;
      userId?: string;
      monthlySpendingCap?: number | null;
      cascadedUpdates?: { assistantsCapped?: number } | null;
    };
    const responseData = data as MemberSpendingLimitData;

    const spendingLimitResponse = {
      orgId: responseData?.organizationId ?? organizationId,
      userId: responseData?.userId ?? userId,
      monthlySpendingCap: responseData?.monthlySpendingCap ?? null,
      cascadedUpdates: responseData?.cascadedUpdates
        ? { assistantsCapped: responseData.cascadedUpdates.assistantsCapped ?? 0 }
        : null,
      info: 'Member spending limit updated successfully',
    };

    return NextResponse.json(spendingLimitResponse, { status: 200 });
  } catch (e: unknown) {
    console.error(
      '[API /api/organizations/[orgId]/members/[userId]/spending-limit PUT] Error:',
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ detail: 'Failed to update member spending limit' }, { status: 500 });
  }
}
