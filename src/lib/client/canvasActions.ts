'use client';

/**
 * Client-side action dispatch for a canvas.
 *
 * Turns the frame's `onInvokeAction` into: pause for confirmation when the action
 * requires it, then post to the action proxy. The pause happens *here*, in console
 * chrome, rather than inside the frame — a canvas that could draw its own
 * confirmation could style it to look like anything, pre-approve it, or skip it.
 *
 * The promise the frame awaits stays pending across the dialog on purpose. That is
 * what keeps the canvas's control in its "working" state while the viewer decides,
 * and what lets a decline surface as a refusal rather than a silent nothing.
 */

import * as React from 'react';

import type { PendingCanvasAction } from '@/components/Canvas/ActionConfirmDialog';

/** One action as the frame is allowed to see it. */
export interface CanvasActionDescriptor {
  name: string;
  label: string;
  icon?: string | null;
  inputSchema?: Record<string, unknown> | null;
  requiresConfirmation: boolean;
  destructive: boolean;
}

interface Deferred {
  resolve: (invocationId: string) => void;
  reject: (error: Error) => void;
}

export interface CanvasActionDispatch {
  /** Pass straight to `CanvasFrame`'s `onInvokeAction`. */
  invokeAction: (actionName: string, args: Record<string, unknown>) => Promise<string>;
  /** Feed to `ActionConfirmDialog`; null when nothing is awaiting a decision. */
  pending: PendingCanvasAction | null;
  confirmPending: () => void;
  cancelPending: () => void;
}

async function post(
  token: string,
  actionName: string,
  args: Record<string, unknown>
): Promise<string> {
  const response = await fetch(`/api/canvas/${encodeURIComponent(token)}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actionName, args }),
  });

  if (!response.ok) {
    // The server's reason, verbatim: "recipients: too long" tells the viewer what
    // to change, where a generic failure tells them to give up.
    let message = 'This action was refused.';
    try {
      const body = await response.json();
      if (typeof body?.error === 'string') message = body.error;
    } catch {
      // Non-JSON error body.
    }
    throw new Error(message);
  }

  const body = (await response.json()) as { invocationId?: number };
  if (body.invocationId === undefined || body.invocationId === null) {
    throw new Error('The action was accepted but returned no invocation.');
  }
  // Auto-counted ids are 0-based, so a falsy check here would drop the very first
  // invocation of a canvas.
  return String(body.invocationId);
}

/**
 * Wire a canvas's actions to the proxy, with confirmation where required.
 *
 * `actions` comes from the server, so `requiresConfirmation` is the stored
 * declaration rather than anything the frame asserted about itself.
 */
export function useCanvasActions(
  token: string,
  actions: CanvasActionDescriptor[]
): CanvasActionDispatch {
  const [pending, setPending] = React.useState<PendingCanvasAction | null>(null);
  const deferred = React.useRef<Deferred | null>(null);

  // Read through a ref so `invokeAction` stays stable: it is handed to the frame,
  // and a new identity on every render would re-run the handshake effect.
  const actionsRef = React.useRef(actions);
  actionsRef.current = actions;

  const invokeAction = React.useCallback(
    (actionName: string, args: Record<string, unknown>) => {
      const descriptor = actionsRef.current.find((action) => action.name === actionName);
      if (!descriptor) {
        // The frame checks this too, but it is untrusted, so this is the copy that
        // decides.
        return Promise.reject(new Error('Unknown action.'));
      }

      if (!descriptor.requiresConfirmation) {
        return post(token, actionName, args);
      }

      if (deferred.current) {
        // One decision at a time. Queueing dialogs would let a canvas stack them
        // up and train a viewer to click through.
        return Promise.reject(new Error('Another action is awaiting confirmation.'));
      }

      return new Promise<string>((resolve, reject) => {
        deferred.current = { resolve, reject };
        setPending({
          actionName,
          label: descriptor.label,
          destructive: descriptor.destructive,
          args,
        });
      });
    },
    [token]
  );

  const confirmPending = React.useCallback(() => {
    const request = pending;
    const settle = deferred.current;
    setPending(null);
    deferred.current = null;
    if (!request || !settle) return;

    post(token, request.actionName, request.args).then(settle.resolve, settle.reject);
  }, [pending, token]);

  const cancelPending = React.useCallback(() => {
    const settle = deferred.current;
    setPending(null);
    deferred.current = null;
    // Rejecting rather than leaving it pending is what turns a decline into a
    // visible refusal in the canvas instead of a control stuck on "working".
    settle?.reject(new Error('Cancelled.'));
  }, []);

  return { invokeAction, pending, confirmPending, cancelPending };
}
