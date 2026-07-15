import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

interface RouteParams {
  params: Promise<{ orgId: string; userId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId, userId } = await params;

  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid organization ID format. Must be an integer.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const searchParams = new URLSearchParams();
  const limit = request.nextUrl.searchParams.get('limit');
  const beforeId = request.nextUrl.searchParams.get('before_id');
  if (limit) searchParams.set('limit', limit);
  if (beforeId) searchParams.set('before_id', beforeId);
  const query = searchParams.toString();

  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${organizationId}/dms/${encodeURIComponent(userId)}/messages${query ? `?${query}` : ''}`,
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
      return NextResponse.json(data || { detail: 'Failed to fetch DM messages' }, {
        status: response.status,
      });
    }

    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ detail: 'Failed to fetch DM messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId, userId } = await params;

  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid organization ID format. Must be an integer.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let body: { content?: string; attachments?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }
  const content = typeof body.content === 'string' ? body.content : '';
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (!content.trim() && attachments.length === 0) {
    return badRequest('Missing content or attachments');
  }

  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${organizationId}/dms/${encodeURIComponent(userId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content, attachments }),
      }
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to send DM message' }, {
        status: response.status,
      });
    }

    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ detail: 'Failed to send DM message' }, { status: 500 });
  }
}
