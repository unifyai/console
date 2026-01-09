import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function DELETE(request: NextRequest, { params }: { params: { voiceId: string } }) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  const provider = request.nextUrl.searchParams.get('provider');
  if (!provider) {
    return NextResponse.json({ detail: "Missing 'provider' query parameter." }, { status: 400 });
  }

  try {
    const orchestraResponse = await fetch(
      `${baseUrl}/assistant/voice/${params.voiceId}?provider=${provider}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

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
    console.error('[API /api/assistant/voice/[voiceId] DELETE] Error:', error.message);
    return NextResponse.json({ detail: 'Failed to connect to backend' }, { status: 500 });
  }
}
