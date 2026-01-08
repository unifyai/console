import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    const response = await fetch(`${ORCHESTRA_BASE_URL}/assistant/video/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Content-Type is set automatically by fetch for FormData
      },
      body: formData,
    });

    const responseData = await response.json().catch((e) => {
      console.error('Failed to parse JSON response from backend (video/upload):', e);
      if (response.ok)
        return { detail: 'Video upload initiated, but response was not valid JSON.' };
      return { detail: 'Invalid JSON response from video upload service', status: response.status };
    });

    if (!response.ok) {
      console.error(`Backend Error (video/upload - ${response.status}):`, responseData);
      return NextResponse.json(
        { detail: responseData.detail || 'Failed to upload video via backend service' },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error: any) {
    console.error('Error proxying to backend (video/upload):', error);
    return NextResponse.json(
      { detail: 'Failed to connect to video upload service', errorDetails: error.message },
      { status: 503 }
    );
  }
}
