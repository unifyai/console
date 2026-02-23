import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, response } = await client.POST('/v0/user/assistant-hiring-approval');

    if (!response.ok) {
      console.error(`Orchestra API Error (assistant-hiring-approval - ${response.status}):`, data);
      return NextResponse.json(data ?? { detail: 'Request failed' }, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    console.error('Error proxying to Orchestra API (assistant-hiring-approval):', e);
    return NextResponse.json(
      {
        detail: 'Failed to connect to backend API',
        errorDetails: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
