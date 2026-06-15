import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  const { voiceId } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const provider = request.nextUrl.searchParams.get('provider');
  if (!provider) {
    return badRequest("Missing 'provider' query parameter.");
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.DELETE('/v0/assistant/voice/{voice_id}', {
      params: {
        path: { voice_id: voiceId },
        query: { provider },
      },
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data ?? { success: true }, { status: response.status });
  } catch (e: unknown) {
    console.error(
      '[API /api/assistant/voice/[voiceId] DELETE] Error:',
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}
