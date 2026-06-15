import { NextRequest, NextResponse } from 'next/server';
import {
  getApiKeyFromRequest,
  unauthorized,
  badRequest,
  internalError,
} from '../../../_utils/auth';
import { dispatchUnitySystemEvent } from '@/lib/assistants/system-event';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { assistantId: string } }) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  const assistantId = Number.parseInt(params.assistantId, 10);
  if (!Number.isFinite(assistantId)) {
    return badRequest('assistantId must be numeric');
  }

  const body = await request.json().catch(() => ({}));
  const eventType = body?.eventType;
  if (!eventType || typeof eventType !== 'string') {
    return badRequest('eventType is required');
  }

  const result = await dispatchUnitySystemEvent({
    assistantId,
    eventType,
    message: typeof body?.message === 'string' ? body.message : '',
    extraEventFields:
      body?.extraEventFields && typeof body.extraEventFields === 'object'
        ? body.extraEventFields
        : {},
  });

  if (!result.ok) {
    if (result.status === 500) return internalError(result.detail || 'Failed to send system event');
    return NextResponse.json({ detail: result.detail }, { status: 502 });
  }
  return NextResponse.json({ ok: true, data: result.data }, { status: 202 });
}
