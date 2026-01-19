import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const requestBody = await request.json();
  const { token } = requestBody;
  if (!token) {
    return badRequest('Missing required field: token');
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.POST(
      '/v0/user/claim-assistant-hiring-one-time-link',
      {
        body: { token },
      }
    );

    if (error) {
      console.error(
        `Orchestra API Error (claim-assistant-hiring-one-time-link - ${response.status}):`,
        error
      );
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    console.error('Error proxying to Orchestra API (claim-assistant-hiring-one-time-link):', e);
    return NextResponse.json(
      {
        detail: 'Failed to connect to backend API',
        errorDetails: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
