/**
 * API Route: GET /api/user/spending
 *
 * Fetches the current user's cumulative spend for a given month.
 * Proxies to Orchestra: GET /v0/user/spend?month=YYYY-MM
 *
 * Query params:
 *   - month: YYYY-MM format (required)
 *
 * Returns: { userId, month, cumulativeSpend, limit, percentUsed }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

/**
 * GET /api/user/spending
 *
 * Fetches the authenticated user's cumulative spend for a given month.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const month = url.searchParams.get('month');

  if (!month) {
    return NextResponse.json(
      { detail: 'Missing required query parameter: month (format: YYYY-MM)' },
      { status: 400 }
    );
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json(
      { detail: 'Invalid month format. Expected: YYYY-MM' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${ORCHESTRA_URL}/v0/user/spend?month=${month}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          {
            month,
            cumulativeSpend: 0,
            limit: null,
            percentUsed: 0,
          },
          { status: 200 }
        );
      }
      return NextResponse.json(data || { detail: 'Failed to fetch spending data' }, {
        status: response.status,
      });
    }

    const transformed = snakeToCamelObject(data);

    return NextResponse.json(transformed, { status: 200 });
  } catch (e: unknown) {
    console.error('[API /api/user/spending GET] Error:', e instanceof Error ? e.message : e);
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}
