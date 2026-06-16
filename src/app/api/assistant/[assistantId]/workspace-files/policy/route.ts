import { NextRequest, NextResponse } from 'next/server';
import { AxiosError } from 'axios';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * GET /api/assistant/[assistantId]/workspace-files/policy?provider=
 *
 * Proxies to: GET /v0/assistant/{assistant_id}/workspace-files/policy
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const provider = new URL(request.url).searchParams.get('provider');
  if (!provider) {
    return badRequest('Missing provider');
  }

  const client = await getOrchestraUserClient(apiKey);
  try {
    const response = await client.get(
      `/assistant/${parseInt(assistantId, 10)}/workspace-files/policy`,
      { params: { provider } }
    );
    return NextResponse.json(response.data ?? {}, { status: response.status });
  } catch (e: unknown) {
    if (e instanceof AxiosError && e.response) {
      return NextResponse.json(e.response.data, { status: e.response.status });
    }
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}

/**
 * PATCH /api/assistant/[assistantId]/workspace-files/policy?provider=
 *
 * Proxies to: PATCH /v0/assistant/{assistant_id}/workspace-files/policy
 *
 * Replaces the allowlist for the provider. Body: { defaultAllow, decisions }.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const provider = new URL(request.url).searchParams.get('provider');
  if (!provider) {
    return badRequest('Missing provider');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const client = await getOrchestraUserClient(apiKey);
  try {
    const response = await client.patch(
      `/assistant/${parseInt(assistantId, 10)}/workspace-files/policy`,
      body,
      { params: { provider } }
    );
    return NextResponse.json(response.data ?? {}, { status: response.status });
  } catch (e: unknown) {
    if (e instanceof AxiosError && e.response) {
      return NextResponse.json(e.response.data, { status: e.response.status });
    }
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}
