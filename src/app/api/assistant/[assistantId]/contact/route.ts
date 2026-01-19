import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

// This route handles deleting a specific contact method from an assistant.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { assistantId: string } }
) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch {
    return badRequest('Invalid JSON body for contact deletion');
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.DELETE('/v0/assistant/{assistant_id}/contact', {
      params: {
        path: { assistant_id: parseInt(params.assistantId, 10) },
      },
      body: requestBody,
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data ?? { success: true }, { status: response.status });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        detail: 'Failed to connect to backend',
        error: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
