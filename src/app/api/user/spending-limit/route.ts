/**
 * API Routes: GET/PUT /api/user/spending-limit
 *
 * GET: Fetches the current user's spending limit configuration.
 *      Proxies to Orchestra: GET /v0/user/spending-limit
 *      Returns: { userId, monthlySpendingCap }
 *
 * PUT: Updates the current user's spending limit.
 *      Proxies to Orchestra: PUT /v0/user/spending-limit
 *      Body: { monthlySpendingCap: number | null }
 *      Returns: { userId, monthlySpendingCap, assistantsCapped }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

/**
 * GET /api/user/spending-limit
 *
 * Fetches the current user's spending limit configuration.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    // Type assertion needed as this endpoint may not be in the local schema
    const { data, error, response } = await (client.GET as any)('/v0/user/spending-limit', {});

    if (error) {
      return NextResponse.json(error, { status: response?.status ?? 500 });
    }

    // Orchestra client middleware already transforms response to camelCase
    type SpendingLimitData = {
      userId?: string;
      monthlySpendingCap?: number | null;
      assistantsCapped?: number;
    };
    const responseData = data as SpendingLimitData;

    const spendingLimitResponse = {
      userId: responseData?.userId ?? '',
      monthlySpendingCap: responseData?.monthlySpendingCap ?? null,
      assistantsCapped: responseData?.assistantsCapped ?? 0,
    };

    return NextResponse.json(spendingLimitResponse, { status: 200 });
  } catch (e: unknown) {
    console.error('[API /api/user/spending-limit GET] Error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ detail: 'Failed to fetch user spending limit' }, { status: 500 });
  }
}

/**
 * PUT /api/user/spending-limit
 *
 * Updates the current user's spending limit.
 */
export async function PUT(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
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
    // Type assertion needed as this endpoint may not be in the local schema
    const { data, error, response } = await (client.PUT as any)('/v0/user/spending-limit', {
      body: { monthly_spending_cap: monthlySpendingCap },
    });

    if (error) {
      return NextResponse.json(error, { status: response?.status ?? 500 });
    }

    // Orchestra client middleware already transforms response to camelCase
    type SpendingLimitData = {
      userId?: string;
      monthlySpendingCap?: number | null;
      assistantsCapped?: number;
    };
    const responseData = data as SpendingLimitData;

    const spendingLimitResponse = {
      userId: responseData?.userId ?? '',
      monthlySpendingCap: responseData?.monthlySpendingCap ?? null,
      assistantsCapped: responseData?.assistantsCapped ?? 0,
      info: 'Spending limit updated successfully',
    };

    return NextResponse.json(spendingLimitResponse, { status: 200 });
  } catch (e: unknown) {
    console.error('[API /api/user/spending-limit PUT] Error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ detail: 'Failed to update user spending limit' }, { status: 500 });
  }
}
