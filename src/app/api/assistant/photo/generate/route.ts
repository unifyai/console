import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    const requestBody = await request.json();

    const { data, error, response } = await client.POST('/v0/assistant/photo/generate', {
      body: requestBody,
    });

    if (error) {
      console.error(`Backend Error (photo/generate - ${response.status}):`, error);
      return NextResponse.json(
        {
          detail:
            (error as Record<string, unknown>)?.detail ||
            'Failed to generate photo via backend service',
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    console.error('Error proxying to backend (photo/generate):', e);
    return NextResponse.json(
      {
        detail: 'Failed to connect to photo generation service',
        errorDetails: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
