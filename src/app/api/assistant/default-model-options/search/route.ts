import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';
import type { DefaultModelOption } from '@/types/assistants/assistant';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const usage = request.nextUrl.searchParams.get('usage') || 'actor';
  if (usage !== 'actor' && usage !== 'slow_brain') {
    return NextResponse.json({ detail: "usage must be 'actor' or 'slow_brain'" }, { status: 400 });
  }

  const q = request.nextUrl.searchParams.get('q') || '';
  const limit = request.nextUrl.searchParams.get('limit') || '50';

  try {
    const params = new URLSearchParams({ usage, q, limit });
    const response = await fetch(
      `${ORCHESTRA_BASE_URL}/assistant/default-model-options/search?${params}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    const options = snakeToCamelObject<DefaultModelOption[]>(data.info ?? []);
    return NextResponse.json(options, { status: response.status });
  } catch {
    return NextResponse.json({ detail: 'Failed to search default model options' }, { status: 500 });
  }
}
