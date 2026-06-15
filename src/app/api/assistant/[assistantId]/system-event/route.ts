import { NextRequest, NextResponse } from 'next/server';
import {
  getApiKeyFromRequest,
  unauthorized,
  badRequest,
  internalError,
} from '../../../_utils/auth';
import { dispatchUnitySystemEvent } from '@/lib/assistants/system-event';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  const parsedAssistantId = Number.parseInt(assistantId, 10);
  if (!Number.isFinite(parsedAssistantId)) {
    return badRequest('assistantId must be numeric');
  }

  const body = await request.json().catch(() => ({}));
  const eventType = body?.eventType;
  if (!eventType || typeof eventType !== 'string') {
    return badRequest('eventType is required');
  }

  const result = await dispatchUnitySystemEvent({
    assistantId: parsedAssistantId,
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
