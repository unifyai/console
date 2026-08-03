import { snakeToCamelObject } from '@/utils/casing';

/**
 * Canvas frames on the assistant action stream.
 *
 * Both canvas signals ride the `unity_system_event` thread and are told apart by
 * `event_type`. That is not a naming convenience: a triggered action is announced
 * by **two** producers on the same thread. Orchestra posts one through the adapters'
 * system-event webhook the moment it records the invocation, and unify posts another
 * when the run finishes. Reading one thread and switching on the type is what lets a
 * single consumer assemble the whole lifecycle.
 *
 * Orchestra's announcement carries no `status`, because at that point there is
 * nothing to report beyond the row existing — so an absent status is `requested`.
 */

export type CanvasInvocationStatus = 'requested' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface CanvasUpdatedFrame {
  type: 'CanvasUpdated';
  data: { token: string; title: string; status: string };
}

export interface CanvasInvocationFrame {
  type: 'CanvasInvocation';
  data: {
    token: string;
    invocationId: number;
    actionName: string;
    status: CanvasInvocationStatus;
    error?: string;
  };
}

export type CanvasFrame = CanvasUpdatedFrame | CanvasInvocationFrame;

/** Shape one canvas signal, or return null when the payload is not one. */
export function canvasFrame(payload: Record<string, unknown>): CanvasFrame | null {
  if (payload.thread !== 'unity_system_event') return null;

  const event = snakeToCamelObject<Record<string, unknown>>(payload.event ?? {});
  const token = typeof event.canvasToken === 'string' ? event.canvasToken : '';
  if (!token) return null;

  if (event.eventType === 'canvas_updated') {
    return {
      type: 'CanvasUpdated',
      data: {
        token,
        title: typeof event.title === 'string' ? event.title : '',
        status: typeof event.status === 'string' ? event.status : 'published',
      },
    };
  }

  if (event.eventType === 'canvas_invocation') {
    // Auto-counted ids are 0-based, so the first run of a canvas has id 0. A
    // truthiness check anywhere on this path drops it.
    const invocationId = Number(event.invocationId);
    if (!Number.isInteger(invocationId) || invocationId < 0) return null;

    return {
      type: 'CanvasInvocation',
      data: {
        token,
        invocationId,
        actionName: typeof event.actionName === 'string' ? event.actionName : '',
        status:
          typeof event.status === 'string' ? (event.status as CanvasInvocationStatus) : 'requested',
        ...(typeof event.error === 'string' && event.error ? { error: event.error } : {}),
      },
    };
  }

  return null;
}

/** Encode one canvas signal as an SSE frame, or null when the payload is not one. */
export function encodeCanvasSse(payload: Record<string, unknown>): string | null {
  const frame = canvasFrame(payload);
  if (!frame) return null;
  return `data: ${JSON.stringify(frame)}\n\n`;
}
