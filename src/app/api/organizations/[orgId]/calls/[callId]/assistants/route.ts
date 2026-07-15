import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

interface RouteParams {
  params: Promise<{ orgId: string; callId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId, callId } = await params;
  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid organization ID format. Must be an integer.');
  }
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();
  let body: { assistant_id?: number; assistantId?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const assistantId = body.assistant_id ?? body.assistantId;
  if (assistantId == null || Number.isNaN(Number(assistantId))) {
    return badRequest('assistant_id is required');
  }
  try {
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/organizations/${organizationId}/calls/${encodeURIComponent(callId)}/assistants`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assistant_id: Number(assistantId) }),
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Failed to add assistant' }, {
        status: response.status,
      });
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ detail: 'Failed to add assistant' }, { status: 500 });
  }
}
