import { NextRequest, NextResponse } from 'next/server';
import { AxiosError } from 'axios';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/assistant/[assistantId]/connect
 *
 * Proxies to: POST /v0/assistant/{assistant_id}/connect
 *
 * Initiates an OAuth flow for BYOD account connection.  Accepts
 * { provider, features, redirect_after } and returns { oauth_url }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch {
    return badRequest('Invalid JSON body for connect');
  }

  const assistantIdNum = parseInt(assistantId, 10);
  const client = await getOrchestraUserClient(apiKey);

  try {
    const response = await client.post(`/assistant/${assistantIdNum}/connect`, requestBody);
    return NextResponse.json(response.data ?? { success: true }, { status: response.status });
  } catch (e: unknown) {
    if (e instanceof AxiosError && e.response) {
      return NextResponse.json(e.response.data, { status: e.response.status });
    }
    return NextResponse.json(
      {
        detail: 'Failed to connect to backend',
        error: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/assistant/[assistantId]/connect
 *
 * Proxies to: DELETE /v0/assistant/{assistant_id}/connect
 *
 * Fully disconnects a BYOD account — revokes tokens, stops watches,
 * clears secrets, and removes the BYOD contact.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const assistantIdNum = parseInt(assistantId, 10);
  const orchestraUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

  try {
    const response = await fetch(`${orchestraUrl}/v0/assistant/${assistantIdNum}/connect`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
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
