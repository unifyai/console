import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { assistantId: string } }
) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.DELETE('/v0/assistant/{assistant_id}', {
      params: {
        path: { assistant_id: parseInt(params.assistantId, 10) },
      },
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data ?? { success: true }, { status: response.status });
  } catch (e: unknown) {
    console.error(
      '[API /api/assistant/[assistantId] DELETE] Error:',
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch {
    return badRequest('Invalid request body');
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.PATCH('/v0/assistant/{assistant_id}/config', {
      params: {
        path: { assistant_id: parseInt(params.assistantId, 10) },
      },
      body: requestBody,
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    console.error(
      '[API /api/assistant/[assistantId] PATCH] Error:',
      e instanceof Error ? e.message : e
    );
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}
