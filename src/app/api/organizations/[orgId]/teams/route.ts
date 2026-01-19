import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';
import { buildCacheControl } from '../../../_utils/cacheResponse';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // Validate org ID is a valid integer
  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return NextResponse.json(
      { detail: 'Invalid organization ID format. Must be an integer.' },
      { status: 400 }
    );
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.GET(
      '/v0/organizations/{organization_id}/teams',
      {
        params: {
          path: { organization_id: organizationId },
        },
      }
    );

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    // Build response with caching headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const cacheControl = buildCacheControl('SHORT');
    if (cacheControl) {
      headers['Cache-Control'] = cacheControl;
    }

    return NextResponse.json(data, { status: response.status, headers });
  } catch {
    return NextResponse.json({ detail: 'Failed to fetch teams' }, { status: 500 });
  }
}
