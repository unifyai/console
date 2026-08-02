import { NextRequest, NextResponse } from 'next/server';
import {
  getApiKeyFromRequest,
  unauthorized,
  badRequest,
  internalError,
} from '../../../_utils/auth';
import { dispatchUnitySystemEvent } from '@/lib/assistants/system-event';
import { buildConsoleGuidance } from '@/lib/agent-guidance/consoleGuidance';

export const dynamic = 'force-dynamic';

/**
 * Reasons that carry the full orientation text rather than just its version.
 *
 * `selection` fires once when a teammate is opened and `keepwarm` every few
 * minutes, so the runtime converges on the current text shortly after a pod
 * restart or a console deploy without every heartbeat paying for ~10KB.
 */
const FULL_PAYLOAD_REASONS = new Set(['selection', 'keepwarm']);

/**
 * Console presence heartbeat.
 *
 * Tells the runtime the user is looking at the console right now, and carries
 * the console's own orientation text along with it. The two travel together on
 * purpose: the text is only worth injecting into a prompt while the user is
 * actually here, and pairing them means the runtime never has to ask.
 *
 * The text is attached here rather than by the caller so the browser never
 * ships prompt content it would have to be trusted not to alter.
 */
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
  const reason = typeof body?.reason === 'string' ? body.reason : '';
  if (!reason) return badRequest('reason is required');

  const guidance = buildConsoleGuidance();
  const carriesText = FULL_PAYLOAD_REASONS.has(reason);

  const result = await dispatchUnitySystemEvent({
    assistantId: parsedAssistantId,
    eventType: 'assistant_presence_observed',
    message: 'User presence observed in Console.',
    extraEventFields: {
      reason,
      source: typeof body?.source === 'string' ? body.source : 'console',
      pageVisibility: typeof body?.pageVisibility === 'string' ? body.pageVisibility : '',
      occurredAt: typeof body?.occurredAt === 'string' ? body.occurredAt : new Date().toISOString(),
      consoleGuidanceVersion: guidance.version,
      consoleGuidanceBrief: carriesText ? guidance.brief : '',
      consoleGuidanceFull: carriesText ? guidance.full : '',
    },
  });

  if (!result.ok) {
    if (result.status === 500) return internalError(result.detail || 'Failed to send presence');
    return NextResponse.json({ detail: result.detail }, { status: 502 });
  }
  return NextResponse.json({ ok: true, guidanceVersion: guidance.version }, { status: 202 });
}
