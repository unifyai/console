import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId } = await params;
  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid organization ID format. Must be an integer.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const response = await fetch(`${ORCHESTRA_URL}/v0/organizations/${organizationId}/groups`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to fetch groups' }, {
        status: response.status,
      });
    }
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ detail: 'Failed to fetch groups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId } = await params;
  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid organization ID format. Must be an integer.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let body: { name?: string | null; userIds?: string[]; assistantIds?: number[] };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  try {
    const response = await fetch(`${ORCHESTRA_URL}/v0/organizations/${organizationId}/groups`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: typeof body.name === 'string' ? body.name : body.name === null ? null : undefined,
        user_ids: Array.isArray(body.userIds) ? body.userIds : [],
        assistant_ids: Array.isArray(body.assistantIds) ? body.assistantIds : [],
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to create group' }, {
        status: response.status,
      });
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ detail: 'Failed to create group' }, { status: 500 });
  }
}
