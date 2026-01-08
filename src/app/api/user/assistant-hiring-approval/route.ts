import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  try {
    const response = await fetch(`${baseUrl}/user/assistant-hiring-approval`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
    });

    const responseData = await response.json().catch((e) => {
      console.error(
        'Failed to parse JSON response from Orchestra API (assistant-hiring-approval):',
        e
      );
      return { detail: 'Invalid JSON response from backend API', status: response.status };
    });

    if (!response.ok) {
      console.error(
        `Orchestra API Error (assistant-hiring-approval - ${response.status}):`,
        responseData
      );
      return NextResponse.json(responseData, { status: response.status });
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error: any) {
    console.error('Error proxying to Orchestra API (assistant-hiring-approval):', error);
    return NextResponse.json(
      { detail: 'Failed to connect to backend API', errorDetails: error.message },
      { status: 503 }
    );
  }
}
