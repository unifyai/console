import { NextRequest, NextResponse } from 'next/server';

const ORCHESTRA_BASE_URL = process.env.ORCHESTRA_URL;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

export async function DELETE(request: NextRequest, { params }: { params: { linkId: string } }) {
  if (!ORCHESTRA_ADMIN_KEY) {
    return NextResponse.json({ detail: 'Admin key not configured' }, { status: 500 });
  }

  const { linkId } = params;
  if (!linkId) {
    return NextResponse.json({ detail: 'Link ID is required' }, { status: 400 });
  }

  const backendUrl = `${ORCHESTRA_BASE_URL}/v0/admin/assistant-hiring-one-time-link/${linkId}`;

  try {
    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        Accept: 'application/json',
      },
    });

    if (response.status === 204) {
      // No Content is a success for DELETE
      return new NextResponse(null, { status: 204 });
    }

    // If not 204, try to parse JSON for error details
    const data = await response
      .json()
      .catch(() => ({ detail: `Orchestra API Error: ${response.statusText}` }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`[API Admin One Time Link DELETE ${linkId}] Error proxying to Orchestra:`, error);
    return NextResponse.json({ detail: 'Failed to connect to backend service' }, { status: 503 });
  }
}
