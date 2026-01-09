import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, internalError } from '../../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const response = await fetch(
      `${ORCHESTRA_BASE_URL}/admin/assistant/${params.assistantId}/status`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
