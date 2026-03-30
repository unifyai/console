/**
 * API Route: GET /api/organizations/[orgId]/members/[userId]/spending
 *
 * Proxies to Orchestra: GET /v0/organizations/{org_id}/members/{user_id}/spend
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
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

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

  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid organization ID format. Must be an integer.');
  }

  if (!userId || typeof userId !== 'string') {
    return badRequest('Invalid user ID format.');
  }

  const url = new URL(request.url);
  const month = url.searchParams.get('month');

  if (!month) {
    return badRequest('Missing required query parameter: month (format: YYYY-MM)');
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return badRequest('Invalid month format. Expected: YYYY-MM');
  }

  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${organizationId}/members/${encodeURIComponent(userId)}/spend?month=${month}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          {
            orgId: organizationId,
            userId,
            month,
            cumulativeSpend: 0,
            limit: null,
            percentUsed: 0,
          },
          { status: 200 }
        );
      }
      return NextResponse.json(data || { detail: 'Failed to fetch member spending data' }, {
        status: response.status,
      });
    }

    const transformed = snakeToCamelObject(data) as Record<string, unknown>;

    if ('organizationId' in transformed) {
      transformed.orgId = transformed.organizationId;
      delete transformed.organizationId;
    }

    if (transformed.percentUsed === null && transformed.limit === null) {
      transformed.percentUsed = 0;
    }

    return NextResponse.json(transformed, { status: 200 });
  } catch (e: unknown) {
    console.error(
      '[API /api/organizations/[orgId]/members/[userId]/spending GET] Error:',
      e instanceof Error ? e.message : e
    );
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}
