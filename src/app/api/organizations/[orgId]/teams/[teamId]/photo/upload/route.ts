import { NextRequest, NextResponse } from 'next/server';
import {
  getApiKeyFromRequest,
  unauthorized,
  badRequest,
  internalError,
} from '../../../../../../_utils/auth';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; teamId: string }> }
) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const { orgId, teamId } = await params;
  if (!orgId || !teamId) {
    return badRequest('Missing orgId or teamId');
  }

  try {
    const formData = await request.formData();

    const response = await fetch(
      `${ORCHESTRA_BASE_URL}/organizations/${orgId}/teams/${teamId}/photo/upload`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      }
    );

    const responseData = await response.json().catch(() => ({
      detail: 'Invalid response from photo upload service',
    }));

    if (!response.ok) {
      return NextResponse.json(
        { detail: responseData.detail || 'Failed to upload photo' },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error: unknown) {
    console.error('Error proxying to backend (team/photo/upload):', error);
    return internalError('Failed to connect to photo upload service');
  }
}
