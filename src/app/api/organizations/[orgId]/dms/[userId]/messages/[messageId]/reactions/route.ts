import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

interface RouteParams {
  params: Promise<{ orgId: string; userId: string; messageId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId, userId, messageId } = await params;

  const organizationId = parseInt(orgId, 10);
  const messageIdNum = parseInt(messageId, 10);
  if (isNaN(organizationId) || isNaN(messageIdNum) || !userId) {
    return badRequest('Invalid organization, user, or message ID.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let body: { emoji?: string | null };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${organizationId}/dms/${encodeURIComponent(userId)}/messages/${messageIdNum}/reactions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji: body.emoji ?? null }),
      }
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to update reaction' }, {
        status: response.status,
      });
    }

    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ detail: 'Failed to update reaction' }, { status: 500 });
  }
}
