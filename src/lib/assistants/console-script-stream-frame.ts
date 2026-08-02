import { snakeToCamelObject } from '@/utils/casing';

/**
 * Console moves arriving outside a Unify Meet.
 *
 * In a Meet the moves ride the LiveKit data channel, because the console is a
 * participant in that room and receives the transcript they are timed against.
 * Nowhere else is: a phone call's room is the SIP leg, and a text thread has no
 * room at all. So on every other medium they arrive here instead, on the
 * assistant's event stream, and are walked in order rather than timed.
 */
export function consoleScriptFrame(
  payload: Record<string, unknown>
): { type: string; data: { steps: Array<{ target: string }> } } | null {
  if (payload.thread !== 'unity_system_event') return null;

  const event = snakeToCamelObject<Record<string, unknown>>(payload.event ?? {});
  if (event.eventType !== 'console_script') return null;
  if (!Array.isArray(event.steps)) return null;

  const steps: Array<{ target: string }> = [];
  for (const raw of event.steps) {
    if (typeof raw !== 'object' || raw === null) continue;
    const target = (raw as Record<string, unknown>).target;
    if (typeof target === 'string' && target.trim()) steps.push({ target });
  }
  if (steps.length === 0) return null;

  return { type: 'ConsoleScript', data: { steps } };
}

export function encodeConsoleScriptSse(payload: Record<string, unknown>): string | null {
  const frame = consoleScriptFrame(payload);
  if (!frame) return null;
  return `data: ${JSON.stringify(frame)}\n\n`;
}
