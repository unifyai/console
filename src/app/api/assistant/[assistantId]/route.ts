import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';

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

  return await fetch(`${baseUrl}/assistant/${params.assistantId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
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
  return await fetch(`${baseUrl}/assistant/${params.assistantId}/config`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
}
