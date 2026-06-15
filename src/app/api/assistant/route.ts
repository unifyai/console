import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

function unwrapInfoPayload(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'info' in payload) {
    return (payload as { info: unknown }).info;
  }
  return payload;
}

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);
  const listAllOrg = request.nextUrl.searchParams.get('list_all_org');
  const demo = request.nextUrl.searchParams.get('demo');

  try {
    const { data, error, response } = await client.GET('/v0/assistant', {
      params: {
        query: {
          list_all_org: listAllOrg === 'true' ? true : undefined,
          demo: demo === 'true' ? true : undefined,
        },
      },
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    // Orchestra wraps list responses in { info: [...] }, unwrap for cleaner client API.
    const responseData = unwrapInfoPayload(data);
    return NextResponse.json(responseData, { status: response.status });
  } catch (e: unknown) {
    console.error('[API /api/assistant GET] Error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ detail: 'Failed to connect to backend API' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);
  const requestBody = await request.json();

  try {
    const { data, error, response } = await client.POST('/v0/assistant', {
      body: requestBody,
    });

    if (error) {
      console.error(
        `[API /api/assistant POST] Timestamp: ${new Date().toISOString()} - Orchestra API Error (${response.status}):`,
        error
      );
      return NextResponse.json(error, { status: response.status });
    }

    console.log(
      `[API /api/assistant POST] Timestamp: ${new Date().toISOString()} - Successfully proxied. Returning to client action.`
    );
    return NextResponse.json(data ?? { info: 'Operation successful' }, { status: response.status });
  } catch (e: unknown) {
    console.error(
      `[API /api/assistant POST] Timestamp: ${new Date().toISOString()} - Error fetching Orchestra API:`,
      e instanceof Error ? e.message : e
    );
    return NextResponse.json(
      {
        error: 'Failed to connect to backend API',
        details: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
