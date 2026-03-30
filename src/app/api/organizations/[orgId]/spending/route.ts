/**
 * API Route: GET /api/organizations/[orgId]/spending
 *
 * Proxies to Orchestra: GET /v0/organizations/{id}/spend
 * Returns the organization's cumulative spending for a given month.
 *
 * Query Parameters:
 *   - month: Month in YYYY-MM format (required)
 *
 * Response:
 *   {
 *     orgId: number,
 *     month: string,
 *     cumulativeSpend: number,
 *     limit: number | null,
 *     percentUsed: number
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

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
    const orchestraUrl = `${ORCHESTRA_URL}/v0/organizations/${organizationId}/spend?month=${month}`;

    const response = await fetch(orchestraUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to fetch organization spending data' }, {
        status: response.status,
      });
    }

    // Transform snake_case to camelCase for frontend
    const transformed = snakeToCamelObject(data) as Record<string, unknown>;

    // Normalize field names to match our types
    // Orchestra returns 'organizationId' but our types use 'orgId'
    if ('organizationId' in transformed) {
      transformed.orgId = transformed.organizationId;
      delete transformed.organizationId;
    }

    // Ensure percentUsed has a sensible default if null
    if (transformed.percentUsed === null && transformed.limit === null) {
      transformed.percentUsed = 0;
    }

    return NextResponse.json(transformed, { status: 200 });
  } catch (e: unknown) {
    console.error(
      '[API /api/organizations/[orgId]/spending GET] Error:',
      e instanceof Error ? e.message : e
    );
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}
