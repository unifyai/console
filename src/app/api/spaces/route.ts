import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { listSpaces } from '@/lib/orchestra/api/spaces';

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const result = await listSpaces(apiKey);
    if (Array.isArray(result)) {
      return NextResponse.json(result, { status: 200 });
    }

    const status = typeof result.status === 'number' ? result.status : 500;
    return NextResponse.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return NextResponse.json({ detail: `Upstream error: ${message}` }, { status: 502 });
  }
}
