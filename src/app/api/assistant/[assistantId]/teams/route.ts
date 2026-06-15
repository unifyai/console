import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { listTeamsForAssistant } from '@/lib/orchestra/api/teams';

export async function GET(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const assistantId = Number(params.assistantId);
  if (!Number.isInteger(assistantId)) {
    return badRequest('Invalid assistant id');
  }

  try {
    const result = await listTeamsForAssistant(apiKey, assistantId);
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
