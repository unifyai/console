import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest, internalError } from '../../_utils/auth';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function DELETE(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const orgId = request.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return badRequest('Missing orgId query parameter');
  }

  try {
    const response = await fetch(`${ORCHESTRA_BASE_URL}/organizations/${orgId}/photo`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const responseData = await response.json().catch(() => ({
      detail: 'Invalid response from photo removal service',
    }));

    if (!response.ok) {
      return NextResponse.json(
        { detail: responseData.detail || 'Failed to remove photo' },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData, { status: 200 });
  } catch (error: any) {
    console.error('Error proxying to backend (org/photo DELETE):', error);
    return internalError('Failed to connect to photo service');
  }
}
