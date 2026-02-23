import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch {
    return badRequest('Invalid request body');
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.POST('/v0/assistant/voice/design/create', {
      body: requestBody,
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    console.error('Error proxying to backend (voice/design/create):', e);
    return NextResponse.json(
      {
        detail: 'Failed to connect to voice design creation service',
        errorDetails: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
