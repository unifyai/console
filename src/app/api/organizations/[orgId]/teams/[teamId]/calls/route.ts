import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

interface RouteParams {
  params: Promise<{ orgId: string; teamId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId, teamId } = await params;
  const organizationId = parseInt(orgId, 10);
  const teamIdNum = parseInt(teamId, 10);
  if (isNaN(organizationId) || isNaN(teamIdNum)) {
    return badRequest('Invalid organization or team ID');
  }
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();
  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${organizationId}/teams/${teamIdNum}/calls`,
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
      return NextResponse.json(data || { detail: 'Failed to start team call' }, {
        status: response.status,
      });
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ detail: 'Failed to start team call' }, { status: 500 });
  }
}
