import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, internalError } from '../../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

export async function GET(request: NextRequest, { params }: { params: { assistantId: string } }) {
  // Verify user is authenticated
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  // Admin endpoints require ORCHESTRA_ADMIN_KEY
  if (!ORCHESTRA_ADMIN_KEY) {
    console.error('[API /assistant/[id]/status] ORCHESTRA_ADMIN_KEY not configured');
    return internalError('Server configuration error');
  }

  try {
    const response = await fetch(
      `${ORCHESTRA_BASE_URL}/admin/assistant/${params.assistantId}/status`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
          'Content-Type': 'application/json',
        },
        // Add a no-cache header to ensure we get the latest status
        cache: 'no-store',
      }
    );

    // Read the body as text ONCE.
    const responseText = await response.text();
    let responseData;

    // Try to parse the text as JSON.
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      // If parsing fails, it's not JSON. Use the raw text as the detail.
      // This handles the case where the backend returns an HTML 404 page.
      responseData = { detail: responseText || 'Received a non-JSON response from the backend.' };
    }

    if (!response.ok) {
      console.error(
        `Backend Error (assistant status - ${response.status}) for assistant ${params.assistantId}:`,
        responseData
      );
      // Ensure responseData has a 'detail' property for the client.
      const detail = responseData.detail || JSON.stringify(responseData);
      return NextResponse.json({ detail }, { status: response.status });
    }

    // Transform snake_case response to camelCase for frontend
    const camelCaseResponse = snakeToCamelObject(responseData);

    // If everything is OK, return the parsed data.
    return NextResponse.json(camelCaseResponse, { status: response.status });
  } catch (error: any) {
    console.error(
      `Error proxying to backend for assistant status (assistant ${params.assistantId}):`,
      error
    );
    return internalError('Failed to connect to assistant status service');
  }
}
