import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function DELETE(
  request: NextRequest,
  { params }: { params: { assistantId: string } }
) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  try {
    const orchestraResponse = await fetch(`${baseUrl}/assistant/${params.assistantId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const responseText = await orchestraResponse.text();
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { detail: responseText || 'Unknown response' };
    }

    return NextResponse.json(snakeToCamelObject(responseData), {
      status: orchestraResponse.status,
    });
  } catch (error: any) {
    console.error('[API /api/assistant/[assistantId] DELETE] Error:', error.message);
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { assistantId: string } }) {
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
    console.error('Failed to parse JSON body in PATCH /api/assistant/[assistantId]:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCaseBody = camelToSnakeObject(requestBody);

  try {
    const orchestraResponse = await fetch(`${baseUrl}/assistant/${params.assistantId}/config`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snakeCaseBody),
    });

    const responseText = await orchestraResponse.text();
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { detail: responseText || 'Unknown response' };
    }

    return NextResponse.json(snakeToCamelObject(responseData), {
      status: orchestraResponse.status,
    });
  } catch (error: any) {
    console.error('[API /api/assistant/[assistantId] PATCH] Error:', error.message);
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}
