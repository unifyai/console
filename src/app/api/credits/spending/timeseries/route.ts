/**
 * API Route: GET /api/credits/spending/timeseries
 *
 * Time-bucketed spending from the credit ledger.
 * Proxies to Orchestra: GET /v0/credits/spending/timeseries
 *
 * Returns the same shape as /api/logs/sum so the chart can consume
 * either source without transformation changes:
 *   { "<timestamp>": { "sum": <number> }, ... }
 *
 * Query params:
 *   - startDate: YYYY-MM-DD (required)
 *   - endDate: YYYY-MM-DD (required)
 *   - groupBy: time_day | time_hour | time_month | time_year (default: time_day)
 *   - category: Filter by category (optional)
 *   - assistantId: Filter by assistant (optional)
 *   - userId: Filter by user (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const params = new URLSearchParams();

  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const groupBy = url.searchParams.get('groupBy') || 'time_day';
  const category = url.searchParams.get('category');
  const assistantId = url.searchParams.get('assistantId');
  const userId = url.searchParams.get('userId');

  if (!startDate || !endDate) {
    return NextResponse.json(
      { detail: 'startDate and endDate are required (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  params.set('start_date', startDate);
  params.set('end_date', endDate);
  params.set('group_by', groupBy);
  if (category) params.set('category', category);
  if (assistantId) params.set('assistant_id', assistantId);
  if (userId) params.set('user_id', userId);

  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/credits/spending/timeseries?${params.toString()}`,
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
      return NextResponse.json(data || { detail: 'Failed to fetch spending timeseries' }, {
        status: response.status,
      });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e: unknown) {
    console.error(
      '[API /api/credits/spending/timeseries GET] Error:',
      e instanceof Error ? e.message : e
    );
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}
