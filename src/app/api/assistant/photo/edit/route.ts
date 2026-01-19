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
    // Validate Content-Type - this endpoint requires multipart/form-data
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { detail: 'Content-Type must be multipart/form-data with file upload' },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    const response = await fetch(`${ORCHESTRA_BASE_URL}/assistant/photo/edit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Content-Type is set automatically by fetch for FormData
      },
      body: formData,
    });

    const responseData = await response.json().catch((e) => {
      console.error('Failed to parse JSON response from backend (photo/edit):', e);
      if (response.ok) return { detail: 'Photo edit initiated, but response was not valid JSON.' };
      return {
        detail: 'Invalid JSON response from photo editing service',
        status: response.status,
      };
    });

    if (!response.ok) {
      console.error(`Backend Error (photo/edit - ${response.status}):`, responseData);
      return NextResponse.json(
        { detail: responseData.detail || 'Failed to edit photo via backend service' },
        { status: response.status }
      );
    }

    return NextResponse.json(snakeToCamelObject(responseData), { status: response.status });
  } catch (error: any) {
    console.error('Error proxying to backend (photo/edit):', error);
    return internalError('Failed to connect to photo editing service');
  }
}
