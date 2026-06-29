/**
 * Single-shot teardown for long-lived Server-Sent Events streams.
 *
 * Every SSE route opens resources that must be released when the browser goes
 * away: the keep-alive `setInterval`, the Pub/Sub gRPC subscription (message +
 * error listeners and its open stream), and the ephemeral Pub/Sub subscription
 * on GCP. Historically those were torn down only from
 * `request.signal addEventListener('abort')`.
 *
 * That single trigger is not enough on Cloud Run. The service force-terminates
 * any request at its configured timeout (300s), and when it does the underlying
 * `request.signal` does not reliably emit `abort` inside the Node runtime. The
 * connection's resources then leak while the browser's `EventSource`
 * immediately reconnects and allocates a fresh set. Over hours those leaked
 * intervals/subscriptions accumulate until the process exhausts its V8 heap and
 * is killed (`FATAL ERROR: JavaScript heap out of memory` → SIGABRT), which
 * 500s every in-flight page and stream on that instance.
 *
 * This helper guarantees teardown runs exactly once, on the first of:
 *   - client disconnect (`request.signal` abort),
 *   - the response stream being cancelled (wire `cancel` into `ReadableStream`),
 *   - a hard max-lifetime ceiling set safely below the platform request timeout
 *     so we proactively close + clean up before Cloud Run silently drops us.
 */

import type { NextRequest } from 'next/server';

/**
 * Hard ceiling on a single SSE connection's server-side lifetime. Kept below
 * Cloud Run's 300s request timeout so teardown always runs on our side; the
 * client's `EventSource` transparently reconnects.
 */
export const SSE_MAX_CONNECTION_MS = 240_000;

export interface SseLifecycle {
  /**
   * Register a teardown task. Tasks run exactly once, in reverse registration
   * order. If teardown has already happened, the task runs immediately.
   */
  add: (task: () => void) => void;
  /** Run every registered teardown task exactly once. Idempotent. */
  close: () => void;
  /** Whether teardown has already run. */
  readonly closed: boolean;
}

/**
 * Creates a lifecycle bound to an SSE request. Returns the `lifecycle` to
 * register teardown tasks against and a `cancel` callback to pass straight to
 * the `ReadableStream`'s `cancel` method.
 */
export function createSseLifecycle(
  request: NextRequest,
  maxLifetimeMs: number = SSE_MAX_CONNECTION_MS
): { lifecycle: SseLifecycle; cancel: () => void } {
  const tasks: Array<() => void> = [];
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    // Reverse order so the most recently acquired resource is released first.
    while (tasks.length > 0) {
      const task = tasks.pop();
      try {
        task?.();
      } catch {
        // Best-effort teardown: one failing task must never block the rest.
      }
    }
  };

  const maxLifetimeTimer = setTimeout(close, maxLifetimeMs);
  tasks.push(() => clearTimeout(maxLifetimeTimer));

  request.signal.addEventListener('abort', close);

  const lifecycle: SseLifecycle = {
    add: (task: () => void) => {
      if (closed) {
        try {
          task();
        } catch {
          // Best-effort teardown.
        }
        return;
      }
      tasks.push(task);
    },
    close,
    get closed() {
      return closed;
    },
  };

  return { lifecycle, cancel: close };
}
