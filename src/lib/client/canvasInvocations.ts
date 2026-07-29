'use client';

/**
 * Follows the runs this client started, until each one settles.
 *
 * The parent resolves an action's promise as soon as Orchestra accepts it, because
 * the work outlives the request. Something then has to report how the run ended, or
 * the control that started it stays in its working state forever.
 *
 * Polling rather than the assistant event stream is the primary path here, because
 * it is the only one every viewer has. A `team` canvas can be read by someone who
 * is not permitted to see the assistant, so stream-delivered updates would silently
 * never arrive for exactly those viewers. The stream remains the fast path, and the
 * way somebody watching a shared canvas learns about a run they did not start —
 * duplicate reports of the same transition are discarded where the two merge.
 */

import * as React from 'react';

import type { FrameInvocationEvent } from '@/components/Canvas/CanvasFrame';

/** Statuses after which there is nothing further to wait for. */
const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);

/** Tight enough to feel immediate on a quick action. */
const FAST_INTERVAL_MS = 1_500;
/** Actions like a bulk send run for minutes; there is no point asking every second. */
const SLOW_INTERVAL_MS = 5_000;
const BACKOFF_AFTER_MS = 20_000;

export interface CanvasInvocationTracker {
  /** Begin following a run. Safe to call repeatedly with the same id. */
  track: (invocationId: string) => void;
  /** Append-only, in the order transitions were observed. */
  events: FrameInvocationEvent[];
}

interface PolledInvocation {
  invocationId: number;
  status: string;
  error?: string | null;
  result?: Record<string, unknown> | null;
}

/**
 * Poll each tracked run until it settles.
 *
 * Polling stops on unmount and when a run reaches a terminal state; no attempt cap,
 * because a run that is genuinely still going is the normal case for the actions
 * worth confirming, and giving up would leave the control mid-flight.
 */
export function useCanvasInvocationTracker(token: string): CanvasInvocationTracker {
  const [events, setEvents] = React.useState<FrameInvocationEvent[]>([]);

  // Ids already being followed, so a re-render or a repeat call does not start a
  // second poll loop for the same run.
  const trackedRef = React.useRef<Set<string>>(new Set());
  const timersRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const disposedRef = React.useRef(false);

  React.useEffect(() => {
    disposedRef.current = false;
    // Captured so the cleanup clears the very sets this effect ran with, rather
    // than whatever the refs point at by the time it fires.
    const timers = timersRef.current;
    const tracked = trackedRef.current;
    return () => {
      disposedRef.current = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      tracked.clear();
    };
  }, [token]);

  const track = React.useCallback(
    (invocationId: string) => {
      if (disposedRef.current) return;
      if (trackedRef.current.has(invocationId)) return;
      trackedRef.current.add(invocationId);

      const startedAt = Date.now();
      let lastStatus: string | null = null;

      const poll = async (): Promise<void> => {
        if (disposedRef.current) return;

        let settled = false;
        try {
          const response = await fetch(
            `/api/canvas/${encodeURIComponent(token)}/invocations/${encodeURIComponent(invocationId)}`,
            { cache: 'no-store' }
          );

          if (response.ok) {
            const body = (await response.json()) as PolledInvocation;
            const status = typeof body.status === 'string' ? body.status : '';

            // Only transitions are reported. Re-emitting an unchanged status would
            // make a canvas that counts its own progress updates wrong.
            if (status && status !== lastStatus && !disposedRef.current) {
              lastStatus = status;
              setEvents((current) => [
                ...current,
                {
                  invocationId: Number(invocationId),
                  status,
                  ...(body.error ? { error: body.error } : {}),
                  ...(body.result ? { result: body.result } : {}),
                },
              ]);
            }
            settled = TERMINAL.has(status);
          }
          // A non-ok response is transient as far as this loop is concerned: the row
          // is written before dispatch, so a missing one means the read raced the
          // write rather than that the run does not exist.
        } catch {
          // Offline or navigating away; the next tick tries again.
        }

        if (settled || disposedRef.current) return;
        const elapsed = Date.now() - startedAt;
        const timer = setTimeout(
          poll,
          elapsed > BACKOFF_AFTER_MS ? SLOW_INTERVAL_MS : FAST_INTERVAL_MS
        );
        timersRef.current.add(timer);
      };

      void poll();
    },
    [token]
  );

  return { track, events };
}

/**
 * Merge the poller's reports with the stream's, dropping repeats.
 *
 * Both can observe the same transition — the poller because this client started the
 * run, the stream because the assistant announced it finishing. The frame delivers
 * whatever it is handed, so the deduplication has to happen before it.
 */
export function mergeInvocationEvents(
  ...sources: FrameInvocationEvent[][]
): FrameInvocationEvent[] {
  const seen = new Set<string>();
  const merged: FrameInvocationEvent[] = [];
  for (const source of sources) {
    for (const event of source) {
      const key = `${event.invocationId}:${event.status}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(event);
    }
  }
  return merged;
}
