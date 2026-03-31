import { NextRequest, NextResponse } from 'next/server';
import { AxiosError } from 'axios';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';
import { camelToSnakeObject } from '@/utils/casing';

/**
 * POST /api/assistant/[assistantId]/contact
 *
 * Proxies to: POST /v0/assistant/{assistant_id}/contact
 *
 * Creates a new contact detail (phone, email, or WhatsApp) for the assistant.
 * This provisions the external infrastructure and creates a billing-tracked record.
 *
 * Uses getOrchestraUserClient which automatically handles snake_case ↔ camelCase.
 */
export async function POST(
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
    return badRequest('Invalid JSON body for contact creation');
  }

  const assistantId = parseInt(params.assistantId, 10);
  const client = await getOrchestraUserClient(apiKey);

  try {
    // Client interceptors handle camelCase → snake_case for request body
    // and snake_case → camelCase for response data
    const response = await client.post(`/assistant/${assistantId}/contact`, requestBody);

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
 * PUT /api/assistant/[assistantId]/contact
 *
 * Proxies to: PUT /v0/assistant/{assistant_id}/contact
 *
 * Updates metadata on an existing contact.
 *
 * Uses getOrchestraUserClient which automatically handles snake_case ↔ camelCase.
 */
export async function PUT(
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
    return badRequest('Invalid JSON body for contact update');
  }

  const assistantId = parseInt(params.assistantId, 10);
  const client = await getOrchestraUserClient(apiKey);

  try {
    const response = await client.put(`/assistant/${assistantId}/contact`, requestBody);

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

// This route handles deleting a specific contact method from an assistant.
// Note: We use direct fetch instead of the orchestra client because
// openapi-fetch/axios don't reliably send bodies for DELETE requests.
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

  const assistantId = parseInt(params.assistantId, 10);
  const orchestraUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

  try {
    // Use direct fetch for DELETE because axios/openapi-fetch don't properly send body for DELETE requests
    const response = await fetch(`${orchestraUrl}/v0/assistant/${assistantId}/contact`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(camelToSnakeObject(requestBody)),
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
