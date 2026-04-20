import { NextRequest, NextResponse } from 'next/server';
import { AxiosError } from 'axios';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * GET /api/assistant/[assistantId]/granted-features
 *
 * Proxies to: GET /v0/assistant/{assistant_id}/granted-features
 *
 * Returns the connected OAuth provider and granted suite features.
 */
export async function GET(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const assistantId = parseInt(params.assistantId, 10);
  const client = await getOrchestraUserClient(apiKey);

  try {
    const response = await client.get(`/assistant/${assistantId}/granted-features`);
    return NextResponse.json(response.data ?? {}, { status: response.status });
  } catch (e: unknown) {
    if (e instanceof AxiosError && e.response) {
      return NextResponse.json(e.response.data, { status: e.response.status });
    }
    return NextResponse.json(
      {
        detail: 'Failed to connect to backend',
        error: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
