import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';
import type { DefaultModelOption } from '@/types/assistants/assistant';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const response = await fetch(`${ORCHESTRA_BASE_URL}/assistant/default-model-options`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Orchestra wraps list responses in { info: [...] }, unwrap for cleaner client API
    const options = snakeToCamelObject<DefaultModelOption[]>(data.info ?? []);
    return NextResponse.json(options, { status: response.status });
  } catch {
    return NextResponse.json({ detail: 'Failed to fetch default model options' }, { status: 500 });
  }
}
