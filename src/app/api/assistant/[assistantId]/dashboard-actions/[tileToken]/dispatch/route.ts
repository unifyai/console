import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, internalError } from '@/app/api/_utils/auth';

const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

type RouteContext = {
  params: Promise<{ assistantId: string; tileToken: string }>;
};

function communicationBaseUrl(): string {
  const baseUrl =
    process.env.COMMUNICATION_URL ||
    process.env.UNITY_COMMS_URL ||
    process.env.LOCAL_ADAPTERS_URL ||
    process.env.UNITY_ADAPTERS_URL;
  if (!baseUrl) {
    throw new Error('Communication service URL is not configured');
  }
  return baseUrl.replace(/\/$/, '');
}

/**
 * Dispatch one dashboard action via Communication infra (authenticated).
 *
 * User session auth gates the Console route; the server uses the platform
 * admin key for the /infra dispatch endpoint.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  if (!ORCHESTRA_ADMIN_KEY) {
    return internalError('ORCHESTRA_ADMIN_KEY not configured');
  }

  const { assistantId, tileToken } = await context.params;
  if (!assistantId || !tileToken) {
    return NextResponse.json({ detail: 'assistantId and tileToken are required' }, { status: 400 });
  }

  let body: { actionName?: string; payload?: Record<string, unknown> } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const actionName = String(body.actionName || '').trim();
  if (!actionName) {
    return NextResponse.json({ detail: 'actionName is required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${communicationBaseUrl()}/infra/dashboard-action/dispatch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        assistant_id: assistantId,
        tile_token: tileToken,
        action_name: actionName,
        payload: body.payload || {},
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(payload, { status: response.status });
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[dashboard-actions dispatch]', error);
    return internalError('Failed to dispatch dashboard action');
  }
}
