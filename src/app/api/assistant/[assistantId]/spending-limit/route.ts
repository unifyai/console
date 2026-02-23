/**
 * API Route: GET/PUT /api/assistant/[assistantId]/spending-limit
 *
 * Proxies to Orchestra endpoints:
 *   - GET /v0/assistant/{id}/spending-limit
 *   - PUT /v0/assistant/{id}/spending-limit
 *
 * GET Response:
 *   {
 *     agentId: string,
 *     monthlySpendingCap: number | null,
 *     effectiveLimit: number | null
 *   }
 *
 * PUT Request Body:
 *   { monthlySpendingCap: number | null }
 *
 * PUT Response:
 *   Same as GET response
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';
import { snakeToCamelObject, camelToSnakeObject } from '@/utils/casing';

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

  try {
    const response = await fetch(`${ORCHESTRA_URL}/v0/assistant/${assistantId}/spending-limit`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to fetch spending limit' }, {
        status: response.status,
      });
    }

    // Transform snake_case to camelCase for frontend
    const transformed = snakeToCamelObject(data);

    return NextResponse.json(transformed, { status: 200 });
  } catch (e: unknown) {
    console.error(
      '[API /api/assistant/[assistantId]/spending-limit GET] Error:',
      e instanceof Error ? e.message : e
    );
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const { assistantId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body');
  }

  // Validate body contains monthlySpendingCap (can be null or number)
  if (!('monthlySpendingCap' in body)) {
    return badRequest('Missing required field: monthlySpendingCap');
  }

  const { monthlySpendingCap } = body;

  // Validate value type
  if (monthlySpendingCap !== null && typeof monthlySpendingCap !== 'number') {
    return badRequest('monthlySpendingCap must be a number or null');
  }

  // Validate non-negative
  if (monthlySpendingCap !== null && monthlySpendingCap < 0) {
    return badRequest('monthlySpendingCap must be non-negative');
  }

  try {
    // Transform camelCase to snake_case for Orchestra
    const snakeCaseBody = camelToSnakeObject({ monthlySpendingCap });

    const response = await fetch(`${ORCHESTRA_URL}/v0/assistant/${assistantId}/spending-limit`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snakeCaseBody),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to set spending limit' }, {
        status: response.status,
      });
    }

    // Transform snake_case to camelCase for frontend
    const transformed = snakeToCamelObject(data);

    return NextResponse.json(transformed, { status: 200 });
  } catch (e: unknown) {
    console.error(
      '[API /api/assistant/[assistantId]/spending-limit PUT] Error:',
      e instanceof Error ? e.message : e
    );
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}
