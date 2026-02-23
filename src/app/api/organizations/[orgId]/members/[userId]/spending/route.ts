/**
 * API Route: GET /api/organizations/[orgId]/members/[userId]/spending
 *
 * Proxies to Orchestra's admin endpoint: GET /v0/admin/organization/{org_id}/members/{user_id}/spend
 * Returns the member's cumulative spending within the organization for a given month.
 *
 * Query Parameters:
 *   - month: Month in YYYY-MM format (required)
 *
 * Response:
 *   {
 *     orgId: number,
 *     userId: string,
 *     month: string,
 *     cumulativeSpend: number,
 *     limit: number | null,
 *     percentUsed: number
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../_utils/auth';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * GET /api/organizations/[orgId]/members/[userId]/spending
 *
 * Fetches the member's cumulative spending within the organization.
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

  // Extract month from query params
  const url = new URL(request.url);
  const month = url.searchParams.get('month');

  if (!month) {
    return badRequest('Missing required query parameter: month (format: YYYY-MM)');
  }

  // Validate month format
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return badRequest('Invalid month format. Expected: YYYY-MM');
  }

  try {
    // Use OrchestraAdminClient for admin endpoints
    const response = await OrchestraAdminClient.get(
      `/organization/${organizationId}/members/${encodeURIComponent(userId)}/spend`,
      { params: { month } }
    );

    // Transform to our frontend types
    // The admin client already handles casing transformation (snake_case → camelCase)
    const data = response.data as {
      organizationId?: number;
      userId?: string;
      month?: string;
      cumulativeSpend?: number;
      limit?: number | null;
      percentUsed?: number;
    };

    // Normalize field names to match our types
    const transformed = {
      orgId: data.organizationId ?? organizationId,
      userId: data.userId ?? userId,
      month: data.month ?? month,
      cumulativeSpend: data.cumulativeSpend ?? 0,
      limit: data.limit ?? null,
      percentUsed: data.limit === null ? 0 : (data.percentUsed ?? 0),
    };

    return NextResponse.json(transformed, { status: 200 });
  } catch (e: unknown) {
    console.error(
      '[API /api/organizations/[orgId]/members/[userId]/spending GET] Error:',
      e instanceof Error ? e.message : e
    );

    // Handle axios error responses
    if (e && typeof e === 'object' && 'response' in e) {
      const axiosError = e as { response?: { status?: number; data?: unknown } };
      const status = axiosError.response?.status ?? 500;
      const data = axiosError.response?.data;

      // 404 for member not found - return empty spend data
      if (status === 404) {
        return NextResponse.json(
          {
            orgId: organizationId,
            userId: userId,
            month: month,
            cumulativeSpend: 0,
            limit: null,
            percentUsed: 0,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(data || { detail: 'Failed to fetch member spending data' }, {
        status,
      });
    }

    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}
