import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, internalError } from '../../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const formData = await request.formData();

    const response = await fetch(`${ORCHESTRA_BASE_URL}/assistant/photo/animate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Content-Type is set automatically by fetch for FormData
      },
      body: formData,
    });

    const responseData = await response.json().catch((e) => {
      console.error('Failed to parse JSON response from backend (photo/animate):', e);
      if (response.ok)
        return { detail: 'Video animation initiated, but response was not valid JSON.' };
      return {
        detail: 'Invalid JSON response from video animation service',
        status: response.status,
      };
    });

    if (!response.ok) {
      console.error(`Backend Error (photo/animate - ${response.status}):`, responseData);
      return NextResponse.json(
        { detail: responseData.detail || 'Failed to animate video via backend service' },
        { status: response.status }
      );
    }

    // Expects { info: "video_url" } from backend
    return NextResponse.json(snakeToCamelObject(responseData), { status: response.status });
  } catch (error: any) {
    console.error('Error proxying to backend (photo/animate):', error);
    return internalError('Failed to connect to video animation service');
  }
}
