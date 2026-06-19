import { NextRequest, NextResponse } from 'next/server';
import { AxiosError } from 'axios';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * GET /api/assistant/[assistantId]/workspace-files/children?provider=&driveId=&itemId=
 *
 * Proxies to: GET /v0/assistant/{assistant_id}/workspace-files/children
 *
 * Lazily lists the children of a folder in the connected account.
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

  const search = new URL(request.url).searchParams;
  const provider = search.get('provider');
  const driveId = search.get('driveId');
  const itemId = search.get('itemId');
  if (!provider || !driveId || !itemId) {
    return badRequest('Missing provider, driveId, or itemId');
  }

  const client = await getOrchestraUserClient(apiKey);
  try {
    const response = await client.get(
      `/assistant/${parseInt(assistantId, 10)}/workspace-files/children`,
      { params: { provider, driveId, itemId } }
    );
    return NextResponse.json(response.data ?? {}, { status: response.status });
  } catch (e: unknown) {
    if (e instanceof AxiosError && e.response) {
      return NextResponse.json(e.response.data, { status: e.response.status });
    }
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}
