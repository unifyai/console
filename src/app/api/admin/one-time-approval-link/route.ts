import { NextRequest, NextResponse } from 'next/server';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

export async function POST(request: NextRequest) {
  if (!ORCHESTRA_ADMIN_KEY) {
    return NextResponse.json({ detail: 'Admin key not configured' }, { status: 500 });
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    return NextResponse.json({ detail: 'Invalid request body' }, { status: 400 });
  }

  const { expiresInDays = 1 } = requestBody; // Default to 1 day

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCaseBody = camelToSnakeObject({ expiresInDays });

  const backendUrl = `${ORCHESTRA_BASE_URL}/v0/admin/assistant-hiring-one-time-link`;

  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(snakeCaseBody),
    });

    const data = await response.json();

    // Transform snake_case response to camelCase for frontend
    const camelCaseResponse = snakeToCamelObject(data);

    return NextResponse.json(camelCaseResponse, { status: response.status });
  } catch (error) {
    console.error('[API Admin One Time Link POST] Error proxying to Orchestra:', error);
    return NextResponse.json({ detail: 'Failed to connect to backend service' }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  if (!ORCHESTRA_ADMIN_KEY) {
    return NextResponse.json({ detail: 'Admin key not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '100';
  const offset = searchParams.get('offset') || '0';

  const backendUrl = `${ORCHESTRA_BASE_URL}/v0/admin/assistant-hiring-one-time-link?limit=${limit}&offset=${offset}`;

  try {
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    // Transform snake_case response to camelCase for frontend
    const camelCaseResponse = snakeToCamelObject(data);

    return NextResponse.json(camelCaseResponse, { status: response.status });
  } catch (error) {
    console.error('[API Admin One Time Link GET] Error proxying to Orchestra:', error);
    return NextResponse.json({ detail: 'Failed to connect to backend service' }, { status: 503 });
  }
}
