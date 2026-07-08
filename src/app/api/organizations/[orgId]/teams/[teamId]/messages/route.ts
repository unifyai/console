import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

interface RouteParams {
  params: Promise<{ orgId: string; teamId: string }>;
}

function parseIds(orgId: string, teamId: string): { organizationId: number; team: number } | null {
  const organizationId = parseInt(orgId, 10);
  const team = parseInt(teamId, 10);
  if (isNaN(organizationId) || isNaN(team)) return null;
  return { organizationId, team };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId, teamId } = await params;
  const ids = parseIds(orgId, teamId);
  if (!ids) {
    return badRequest('Invalid organization or team ID format. Must be integers.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const searchParams = new URLSearchParams();
  const limit = request.nextUrl.searchParams.get('limit');
  const beforeMessageId = request.nextUrl.searchParams.get('before_message_id');
  if (limit) searchParams.set('limit', limit);
  if (beforeMessageId) searchParams.set('before_message_id', beforeMessageId);
  const query = searchParams.toString();

  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${ids.organizationId}/teams/${ids.team}/messages${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to fetch team messages' }, {
        status: response.status,
      });
    }

    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ detail: 'Failed to fetch team messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId, teamId } = await params;
  const ids = parseIds(orgId, teamId);
  if (!ids) {
    return badRequest('Invalid organization or team ID format. Must be integers.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let body: { content?: string; mentions?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }
  if (typeof body.content !== 'string' || !body.content.trim()) {
    return badRequest('Missing content');
  }

  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${ids.organizationId}/teams/${ids.team}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: body.content,
          ...(body.mentions !== undefined ? { mentions: body.mentions } : {}),
        }),
      }
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to send team message' }, {
        status: response.status,
      });
    }

    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ detail: 'Failed to send team message' }, { status: 500 });
  }
}
