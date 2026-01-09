import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

/**
 * Handles GET requests to retrieve a list of model names supported by the given provider.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');

  try {
    const { data, error, response } = await client.GET('/v0/models', {
      params: {
        query: {
          provider: provider || undefined,
        },
      },
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ detail: 'Failed to fetch models' }, { status: 500 });
  }
}
