'use client';

/**
 * Live canvas signals for one mounted canvas.
 *
 * Rides the shared assistant action stream rather than opening a stream of its own.
 * A second `EventSource` would mean a second ephemeral Pub/Sub subscription per tab,
 * which is real cost on a topic that already fans out to every viewer.
 *
 * Two things arrive here, and they are needed for different reasons:
 *
 * - `CanvasUpdated` — a canvas is usually left open, so a republish that only took
 *   effect on reload would leave a viewer reading a superseded view.
 * - `CanvasInvocation` — the frame is told its action was accepted and nothing after
 *   that. Without the terminal status a control that says "working" says it until
 *   the tab closes, whether the action succeeded or failed.
 */

import * as React from 'react';

import {
  type CanvasFrame,
  type CanvasInvocationStatus,
} from '@/lib/assistants/canvas-stream-frame';
import { subscribeToAssistantActionStream } from '@/lib/client/assistant-action-stream';

export interface CanvasInvocationEvent {
  invocationId: number;
  actionName: string;
  status: CanvasInvocationStatus;
  error?: string;
}

export interface CanvasStreamState {
  /** Bumped on every republish, for re-reading the record. */
  revision: number;
  /** Append-only, so a consumer can deliver only what it has not delivered. */
  invocationEvents: CanvasInvocationEvent[];
  /** The canvas was deleted upstream; there is nothing left to re-read. */
  deleted: boolean;
}

const IDLE: CanvasStreamState = { revision: 0, invocationEvents: [], deleted: false };

/**
 * Subscribe to one canvas's signals.
 *
 * Returns an idle state when no `assistantId` is given, so a surface without an
 * assistant in scope mounts unchanged rather than needing a second code path.
 */
export function useCanvasStream(token: string, assistantId?: string | null): CanvasStreamState {
  const [state, setState] = React.useState<CanvasStreamState>(IDLE);

  React.useEffect(() => {
    if (!assistantId || !token) return;

    // Reset rather than carry a previous canvas's events across a token change.
    setState(IDLE);

    const unsubscribe = subscribeToAssistantActionStream(assistantId, {
      onMessage: (raw) => {
        let frame: CanvasFrame;
        try {
          frame = JSON.parse(raw) as CanvasFrame;
        } catch {
          return;
        }
        // The stream carries every kind of action event; only canvas frames for
        // *this* canvas are ours.
        if (frame?.type !== 'CanvasUpdated' && frame?.type !== 'CanvasInvocation') return;
        if (frame.data?.token !== token) return;

        setState((current) => {
          if (frame.type === 'CanvasUpdated') {
            if (frame.data.status === 'deleted') {
              return { ...current, deleted: true };
            }
            return { ...current, revision: current.revision + 1, deleted: false };
          }
          return {
            ...current,
            invocationEvents: [
              ...current.invocationEvents,
              {
                invocationId: frame.data.invocationId,
                actionName: frame.data.actionName,
                status: frame.data.status,
                ...(frame.data.error ? { error: frame.data.error } : {}),
              },
            ],
          };
        });
      },
    });

    return unsubscribe;
  }, [token, assistantId]);

  return state;
}
