/**
 * API Route: GET /api/credits/transactions
 *
 * Fetches paginated credit transaction history from the ledger.
 * Proxies to Orchestra: GET /v0/credits/transactions
 *
 * Query params:
 *   - limit:  Number of transactions (1–200, default 50)
 *   - offset: Pagination offset (default 0)
 *   - category: Filter by category (optional)
 *   - assistantId: Filter by assistant (optional)
 *   - userId: Filter by user (optional)
 *   - startDate: ISO date string, inclusive lower bound (optional)
 *   - endDate: ISO date string, exclusive upper bound (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';
import { mockSimulationEnabled } from '@/lib/simulation/config';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const params = new URLSearchParams();

  const limit = url.searchParams.get('limit');
  const offset = url.searchParams.get('offset');
  const category = url.searchParams.get('category');
  const assistantId = url.searchParams.get('assistantId');
  const userId = url.searchParams.get('userId');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const groupBy = url.searchParams.get('groupBy');

  if (limit) params.set('limit', limit);
  if (offset) params.set('offset', offset);
  if (category) params.set('category', category);
  if (assistantId) params.set('assistant_id', assistantId);
  if (userId) params.set('user_id', userId);
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  if (groupBy) params.set('group_by', groupBy);

  if (mockSimulationEnabled()) {
    const { simulationFetch } = await import('@/lib/simulation/dispatch');
    const simResponse = await simulationFetch(
      `http://mock.local/v0/credits/transactions?${params.toString()}`,
      { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const simData = await simResponse.json().catch(() => ({ transactions: [] }));
    return NextResponse.json(snakeToCamelObject(simData), { status: simResponse.status });
  }

  try {
    const response = await fetch(`${ORCHESTRA_URL}/v0/credits/transactions?${params.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to fetch transactions' }, {
        status: response.status,
      });
    }

    const transformed = snakeToCamelObject(data);
    return NextResponse.json(transformed, { status: 200 });
  } catch (e: unknown) {
    console.error('[API /api/credits/transactions GET] Error:', e instanceof Error ? e.message : e);
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}
