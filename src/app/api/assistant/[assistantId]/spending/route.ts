/**
 * API Route: GET /api/assistant/[assistantId]/spending
 *
 * Proxies to Orchestra's admin endpoint: GET /v0/admin/assistant/{id}/spend
 * Returns the assistant's cumulative spending for a given month.
 *
 * Query Parameters:
 *   - month: Month in YYYY-MM format (required)
 *
 * Response:
 *   {
 *     agentId: string,
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
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const { assistantId } = await params;

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
    // Call Orchestra admin endpoint for spending data
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/admin/assistant/${assistantId}/spend?month=${month}`,
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
      return NextResponse.json(data || { detail: 'Failed to fetch spending data' }, {
        status: response.status,
      });
    }

    // Transform snake_case to camelCase for frontend
    const transformed = snakeToCamelObject(data);

    return NextResponse.json(transformed, { status: 200 });
  } catch (e: unknown) {
    console.error(
      '[API /api/assistant/[assistantId]/spending GET] Error:',
      e instanceof Error ? e.message : e
    );
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}
