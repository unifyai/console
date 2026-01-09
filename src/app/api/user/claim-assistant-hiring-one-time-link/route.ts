import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }
  const requestBody = await request.json();
  const { token } = requestBody;
  if (!token) {
    return NextResponse.json({ detail: 'Missing required field: token' }, { status: 400 });
  }

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCaseBody = camelToSnakeObject({ token });

  try {
    const response = await fetch(`${baseUrl}/user/claim-assistant-hiring-one-time-link`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(snakeCaseBody),
    });

    const responseData = await response.json().catch((e) => {
      console.error(
        'Failed to parse JSON response from Orchestra API (claim-assistant-hiring-one-time-link):',
        e
      );
      return { detail: 'Invalid JSON response from backend API', status: response.status };
    });

    if (!response.ok) {
      console.error(
        `Orchestra API Error (claim-assistant-hiring-one-time-link - ${response.status}):`,
        responseData
      );
      return NextResponse.json(responseData, { status: response.status });
    }

    // Transform snake_case response to camelCase for frontend
    const camelCaseResponse = snakeToCamelObject(responseData);

    return NextResponse.json(camelCaseResponse, { status: response.status });
  } catch (error: any) {
    console.error('Error proxying to Orchestra API (claim-assistant-hiring-one-time-link):', error);
    return NextResponse.json(
      { detail: 'Failed to connect to backend API', errorDetails: error.message },
      { status: 503 }
    );
  }
}
