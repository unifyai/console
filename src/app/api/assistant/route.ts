import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  // Forward query parameters to Orchestra
  const url = new URL(`${baseUrl}/assistant`);
  const listAllOrg = request.nextUrl.searchParams.get('list_all_org');
  if (listAllOrg) {
    url.searchParams.set('list_all_org', listAllOrg);
  }

  try {
    const orchestraResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
    });

    const responseText = await orchestraResponse.text();
    let responseData;

    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      return NextResponse.json(
        { detail: responseText || 'Invalid response from backend' },
        { status: orchestraResponse.status }
      );
    }

    if (!orchestraResponse.ok) {
      return NextResponse.json(snakeToCamelObject(responseData), {
        status: orchestraResponse.status,
      });
    }

    // Transform snake_case response to camelCase for frontend
    const camelCaseResponse = snakeToCamelObject(responseData);
    return NextResponse.json(camelCaseResponse, { status: orchestraResponse.status });
  } catch (error: any) {
    console.error('[API /api/assistant GET] Error:', error.message);
    return NextResponse.json({ detail: 'Failed to connect to backend API' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  const requestBody = await request.json();

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCaseBody = camelToSnakeObject(requestBody);

  try {
    const orchestraResponse = await fetch(`${baseUrl}/assistant`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(snakeCaseBody),
    });

    const responseText = await orchestraResponse.text();
    let responseData;
    if (orchestraResponse.ok && responseText) {
      // Only try to parse if OK and has content
      try {
        responseData = JSON.parse(responseText);
      } catch (e: any) {
        console.error(
          `[API /api/assistant POST] Timestamp: ${new Date().toISOString()} - Failed to parse JSON from Orchestra. Status: ${orchestraResponse.status}. Error: ${e.message}. Raw text: ${responseText}`
        );
        // Return an error response immediately if parsing fails on an OK response
        return NextResponse.json(
          {
            error: 'Invalid JSON response from backend API',
            status: orchestraResponse.status,
            raw: responseText,
          },
          { status: 502 }
        ); // Bad Gateway
      }
    } else if (!orchestraResponse.ok) {
      try {
        // Attempt to parse error detail
        responseData = JSON.parse(responseText);
      } catch (e) {
        // Use raw text if error response isn't JSON
        responseData = { detail: responseText || 'Unknown error from backend API' };
      }
      console.error(
        `[API /api/assistant POST] Timestamp: ${new Date().toISOString()} - Orchestra API Error (${orchestraResponse.status}):`,
        responseData
      );
      return NextResponse.json(responseData, { status: orchestraResponse.status });
    } else {
      // OK response but empty text
      responseData = { info: 'Operation successful, no content from backend.' };
    }

    console.log(
      `[API /api/assistant POST] Timestamp: ${new Date().toISOString()} - Successfully proxied. Returning to client action.`
    );
    // Transform snake_case response to camelCase for frontend
    const camelCaseResponse = snakeToCamelObject(responseData);
    return NextResponse.json(camelCaseResponse, { status: orchestraResponse.status });
  } catch (error: any) {
    // This catch is for fetch failing to connect to Orchestra
    console.error(
      `[API /api/assistant POST] Timestamp: ${new Date().toISOString()} - Error fetching Orchestra API:`,
      error.message,
      error.stack
    );
    return NextResponse.json(
      { error: 'Failed to connect to backend API', details: error.message },
      { status: 500 }
    );
  }
}
