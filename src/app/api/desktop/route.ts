import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const response = await fetch(`${ORCHESTRA_BASE_URL}/desktop`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to list desktops' }, {
        status: response.status,
      });
    }

    const desktops = data?.info ?? data;
    return NextResponse.json(snakeToCamelObject(desktops), { status: 200 });
  } catch (e: unknown) {
    console.error('[API /api/desktop GET] Error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}
