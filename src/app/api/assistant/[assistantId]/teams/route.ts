import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { listTeamsForAssistant } from '@/lib/orchestra/api/teams';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const parsedAssistantId = Number(assistantId);
  if (!Number.isInteger(parsedAssistantId)) {
    return badRequest('Invalid assistant id');
  }

  try {
    const result = await listTeamsForAssistant(apiKey, parsedAssistantId);
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
