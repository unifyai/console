/**
 * API Route: GET /api/user/spending
 *
 * Fetches the current user's cumulative spend for a given month.
 * Proxies to Orchestra: GET /v0/admin/user/{userId}/spend?month=YYYY-MM
 *
 * Query params:
 *   - month: YYYY-MM format (required)
 *
 * Returns: { userId, month, cumulativeSpend, limit, percentUsed }
 */

import { NextRequest, NextResponse } from 'next/server';
import { AxiosError } from 'axios';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { createOrchestraClient } from '@/lib/orchestra/client';

/**
 * GET /api/user/spending
 *
 * Fetches the authenticated user's cumulative spend for a given month.
 */
export async function GET(request: NextRequest) {
  // Get API key from request (session or header)
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  // Get the user ID by calling Orchestra's /user/basic-info endpoint
  const userClient = createOrchestraClient(apiKey);
  let userId: string;

  try {
    // Type assertion needed as /v0/user/basic-info may not be in the local schema
    const { data, error } = await (userClient.GET as any)('/v0/user/basic-info', {});
    if (error || !data) {
      console.error('[API /api/user/spending GET] Failed to get user info:', error);
      return NextResponse.json({ detail: 'Failed to authenticate user' }, { status: 401 });
    }
    // Type assertion since the schema types might vary
    userId = (data as { userId?: string }).userId || '';
    if (!userId) {
      console.error('[API /api/user/spending GET] User ID not found in response:', data);
      return NextResponse.json({ detail: 'Failed to get user ID' }, { status: 401 });
    }
  } catch (e) {
    console.error('[API /api/user/spending GET] Failed to get user info:', e);
    return NextResponse.json({ detail: 'Failed to authenticate user' }, { status: 401 });
  }

  // Get month from query params
  const url = new URL(request.url);
  const month = url.searchParams.get('month');

  if (!month) {
    return NextResponse.json(
      { detail: 'Missing required query parameter: month (format: YYYY-MM)' },
      { status: 400 }
    );
  }

  // Validate month format
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json(
      { detail: 'Invalid month format. Expected: YYYY-MM' },
      { status: 400 }
    );
  }

  try {
    // Call Orchestra admin endpoint using the admin client
    // OrchestraAdminClient automatically handles camelCase ↔ snake_case transformation
    const response = await OrchestraAdminClient.get(`/user/${encodeURIComponent(userId)}/spend`, {
      params: { month },
    });

    // Response data is already transformed to camelCase by the client interceptor
    const spendResponse = {
      userId: response.data.userId ?? userId,
      month: response.data.month ?? month,
      cumulativeSpend: response.data.cumulativeSpend ?? 0,
      limit: response.data.limit ?? null,
      percentUsed: response.data.percentUsed ?? 0,
    };

    return NextResponse.json(spendResponse, { status: 200 });
  } catch (e: unknown) {
    if (e instanceof AxiosError) {
      // 404 means no spend data yet - return zero spend
      if (e.response?.status === 404) {
        return NextResponse.json(
          {
            userId,
            month,
            cumulativeSpend: 0,
            limit: null,
            percentUsed: 0,
          },
          { status: 200 }
        );
      }
      console.error('[API /api/user/spending GET] Axios error:', e.message);
      return NextResponse.json(e.response?.data || { detail: 'Failed to fetch spending data' }, {
        status: e.response?.status ?? 500,
      });
    }
    console.error('[API /api/user/spending GET] Error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ detail: 'Failed to fetch user spending data' }, { status: 500 });
  }
}
