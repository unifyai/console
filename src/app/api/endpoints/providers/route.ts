/**
 * ⚠️ DEPRECATED: Orchestra removed provider listing endpoints
 * - Orchestra commit 9318f256: "removed admin provider endpoints, endpoint_metrics..."
 * - Deleted Orchestra endpoint: /v0/providers
 * - These routes will return 404 from Orchestra until the functionality is restored
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

/**
 * Handles GET requests to retrieve a list of provider names that support a specific model.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);
  const url = new URL(request.url);
  const model = url.searchParams.get('model');

  try {
    const { data, error, response } = await client.GET('/v0/providers', {
      params: {
        query: {
          model: model || undefined,
        },
      },
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ detail: 'Failed to fetch providers' }, { status: 500 });
  }
}
