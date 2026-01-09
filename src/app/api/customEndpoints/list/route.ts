import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  try {
    const res = await fetch(`${baseUrl}/custom_endpoint/list`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(snakeToCamelObject(data), { status: res.status });
  } catch (error) {
    return NextResponse.json({ detail: 'Failed to fetch custom endpoints' }, { status: 500 });
  }
}
