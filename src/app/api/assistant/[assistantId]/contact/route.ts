import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';

// This route handles deleting a specific contact method from an assistant.
// Note: We use direct fetch instead of openapi-fetch client.DELETE() because
// openapi-fetch doesn't reliably send bodies for DELETE requests.
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

  const orchestraUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';
  const assistantId = parseInt(params.assistantId, 10);

  try {
    // Use direct fetch for DELETE because openapi-fetch doesn't properly send body for DELETE requests
    const response = await fetch(`${orchestraUrl}/v0/assistant/${assistantId}/contact`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
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
