import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    return NextResponse.json({ detail: 'Invalid request body' }, { status: 400 });
  }

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCaseBody = camelToSnakeObject(requestBody);

  try {
    const orchestraResponse = await fetch(`${ORCHESTRA_BASE_URL}/assistant/voice/design/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(snakeCaseBody),
    });

    const responseData = await orchestraResponse.json();

    // Transform snake_case response to camelCase for frontend
    const camelCaseResponse = snakeToCamelObject(responseData);

    return NextResponse.json(camelCaseResponse, { status: orchestraResponse.status });
  } catch (error: any) {
    console.error('Error proxying to backend (voice/design/create):', error);
    return NextResponse.json(
      { detail: 'Failed to connect to voice design creation service', errorDetails: error.message },
      { status: 503 }
    );
  }
}
