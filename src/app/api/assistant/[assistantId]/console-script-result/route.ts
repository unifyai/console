import { NextRequest, NextResponse } from 'next/server';
import {
  getApiKeyFromRequest,
  unauthorized,
  badRequest,
  internalError,
} from '../../../_utils/auth';
import { dispatchUnitySystemEvent } from '@/lib/assistants/system-event';
import { isOfferedTarget } from '@/lib/agent-guidance/actionCatalogue';

export const dynamic = 'force-dynamic';

const OUTCOMES = new Set([
  'done',
  'clicked',
  'unknown',
  'not-found',
  'not-interactive',
  'blocked',
  'skipped',
]);

/** Cap on how much one report can carry, since it lands in a prompt. */
const MAX_STEPS = 12;

/**
 * What became of the moves the assistant asked for.
 *
 * Reported so the runtime stops steering blind: saying "and there it is" when
 * the control was missing is worse than never offering to navigate.
 *
 * The body is validated rather than forwarded, because it arrives from the
 * browser and ends up in a prompt. Targets are checked against the catalogue so
 * a report cannot describe a move this console would never have made.
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
  const scriptId = typeof body?.scriptId === 'string' ? body.scriptId : '';
  if (!Array.isArray(body?.outcomes)) return badRequest('outcomes must be an array');

  const isStep = (raw: unknown): raw is { target: string; outcome: string } => {
    if (typeof raw !== 'object' || raw === null) return false;
    const step = raw as Record<string, unknown>;
    return typeof step.target === 'string' && typeof step.outcome === 'string';
  };

  const outcomes = (body.outcomes as unknown[])
    .filter(isStep)
    .filter((step: { target: string; outcome: string }) => OUTCOMES.has(step.outcome))
    // An id this console never offered cannot have been acted on, so a report
    // naming one is not describing anything that happened here.
    .filter(
      (step: { target: string; outcome: string }) =>
        isOfferedTarget(step.target) || step.outcome === 'unknown'
    )
    .slice(0, MAX_STEPS)
    .map((step: { target: string; outcome: string }) => ({
      target: step.target,
      outcome: step.outcome,
    }));

  if (outcomes.length === 0) return badRequest('no usable outcomes');

  const result = await dispatchUnitySystemEvent({
    assistantId: parsedAssistantId,
    eventType: 'console_script_result',
    message: 'Console reported what became of the requested moves.',
    extraEventFields: { scriptId, outcomes },
  });

  if (!result.ok) {
    if (result.status === 500) return internalError(result.detail || 'Failed to report outcomes');
    return NextResponse.json({ detail: result.detail }, { status: 502 });
  }
  return NextResponse.json({ ok: true, reported: outcomes.length }, { status: 202 });
}
