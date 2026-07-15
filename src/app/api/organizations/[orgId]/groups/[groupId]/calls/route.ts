import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

interface RouteParams {
  params: Promise<{ orgId: string; groupId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId, groupId } = await params;
  const organizationId = parseInt(orgId, 10);
  const groupIdNum = parseInt(groupId, 10);
  if (isNaN(organizationId) || isNaN(groupIdNum)) {
    return badRequest('Invalid organization or group ID');
  }
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();
  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${organizationId}/groups/${groupIdNum}/calls`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to start group call' }, {
        status: response.status,
      });
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ detail: 'Failed to start group call' }, { status: 500 });
  }
}
