import { NextRequest, NextResponse } from 'next/server';
import { AxiosError } from 'axios';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * GET /api/assistant/[assistantId]/workspace-files/roots?provider=
 *
 * Proxies to: GET /v0/assistant/{assistant_id}/workspace-files/roots
 *
 * Lists the connected account's top-level drives/corpora for the picker.
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
      `/assistant/${parseInt(assistantId, 10)}/workspace-files/roots`,
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
