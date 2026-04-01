import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const requestBody = await request.json();
  const { token } = requestBody;
  if (!token) {
    return badRequest('Missing required field: token');
  }

  try {
    // Path not yet in generated OpenAPI types — use raw fetch via the client's base URL
    const baseUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';
    const res = await fetch(`${baseUrl}/v0/user/claim-credit-grant-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ token }),
    });

    const responseData = await res.json().catch(() => null);

    if (!res.ok) {
      console.error(`Orchestra API Error (claim-credit-grant-link - ${res.status}):`, responseData);
      return NextResponse.json(responseData ?? { detail: 'Unknown error' }, {
        status: res.status,
      });
    }

    return NextResponse.json(responseData, { status: res.status });
  } catch (e: unknown) {
    console.error('Error proxying to Orchestra API (claim-credit-grant-link):', e);
    return NextResponse.json(
      {
        detail: 'Failed to connect to backend API',
        errorDetails: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
