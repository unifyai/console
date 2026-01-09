import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.GET('/v0/providers');

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ detail: 'Failed to fetch providers' }, { status: 500 });
  }
}
