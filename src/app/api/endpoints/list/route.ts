/**
 * ⚠️ DEPRECATED: Orchestra removed universal API endpoints
 * - Orchestra commit 2f638213 (Jan 9, 2026): "removed the universal api related endpoints"
 * - Deleted Orchestra endpoint: /v0/endpoints
 * - These routes will return 404 from Orchestra until the functionality is restored
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

/**
 * Handles GET requests to retrieve a list of endpoint names supported by a specific provider and model.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);
  const provider = request.nextUrl.searchParams.get('provider');
  const model = request.nextUrl.searchParams.get('model');

  try {
    const { data, error, response } = await client.GET('/v0/endpoints', {
      params: {
        query: {
          provider: provider || undefined,
          model: model || undefined,
        },
      },
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ detail: 'Failed to fetch endpoints' }, { status: 500 });
  }
}
