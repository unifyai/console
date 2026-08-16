'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import {
  CANVAS_PROTOCOL_VERSION,
  isCanvasHello,
  type CanvasActionDescriptor,
  type CanvasTheme,
  type ChildMessage,
  type ParentMessage,
} from '@unity/canvas-kit/protocol';

import { getCanvasHostUrl } from '@/lib/canvas/origin';
import { cn } from '@/lib/utils';

/**
 * Upper bound on the height a canvas may request, in CSS pixels.
 *
 * The child controls its own content height, so without a clamp a canvas could
 * push the frame to an arbitrary size and disrupt the page around it.
 */
const MAX_FRAME_HEIGHT = 20000;
const MIN_FRAME_HEIGHT = 120;

/** Inbound messages accepted per second before the child is considered hostile. */
const MAX_MESSAGES_PER_SECOND = 120;

/** When, after an applied height, the frame is nudged so Chrome re-embeds it. */
const SETTLE_DELAYS_MS = [400, 1600, 4000, 8000];

/** One lifecycle update for an invocation the canvas started. */
export interface FrameInvocationEvent {
  invocationId: number;
  status: string;
  error?: string;
  result?: unknown;
}

/** Statuses the frame protocol treats as terminal. */
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

export interface CanvasFrameProps {
  /** Compiled ES module for this canvas, already integrity-checked by the caller. */
  source: string;
  /** Materialised values frozen into the canvas at author time. */
  props?: Record<string, unknown>;
  /** Binding aliases this canvas may request. */
  aliases?: string[];
  actions?: CanvasActionDescriptor[];
  /** Resolve one binding alias. Rejecting surfaces an error inside the canvas. */
  onRequestData?: (alias: string) => Promise<{ rows: unknown[]; truncated: boolean }>;
  /** Invoke a declared action. Resolves to the invocation id once accepted. */
  onInvokeAction?: (actionName: string, args: Record<string, unknown>) => Promise<string>;
  /** Called when the viewer asks for a change from inside the canvas. */
  onAsk?: (text: string) => void;
  /** Called when the canvas reports a load or render failure. */
  onError?: (message: string, stack?: string) => void;
  /**
   * Append-only lifecycle updates for invocations this canvas started.
   *
   * The parent resolves an action's promise as soon as it is *accepted*, because
   * the work outlives the request. Without these the canvas never learns how the
   * run ended, and the control that started it stays in its working state.
   */
  invocationEvents?: FrameInvocationEvent[];
  /** Fixed height. Omit to size the frame to its content. */
  height?: number;
  className?: string;
  title?: string;
}

/**
 * Renders one canvas inside a sandboxed cross-origin iframe.
 *
 * ## The handshake
 *
 * The child speaks first. The host's entry is a deferred module script, so the
 * iframe's `load` event fires before React has mounted inside it, and an init
 * sent then is dropped. This waits for `canvas/hello`, then performs the single
 * `postMessage` that transfers one end of a `MessageChannel`.
 *
 * ## Why there are no origin checks
 *
 * The frame has an opaque origin, so its messages arrive with
 * `event.origin === "null"` and it can only be addressed with `targetOrigin:
 * '*'`. Origin validation is therefore not available, and the port takes its
 * place: after the handshake, holding the port is the credential, and nothing
 * else on the page can post to it. The hello itself is guarded by an
 * `event.source` identity check — only the document inside this exact iframe
 * can produce it. (The channel id sent with init is a session label for the
 * child, not a secret: nothing before init could have carried it to the child
 * for verification.)
 *
 * ## What is never sent
 *
 * Action targets and binding queries stay server-side. The child receives
 * aliases and action names and nothing that would let it widen its own reach.
 */
export function CanvasFrame({
  source,
  props = {},
  aliases = [],
  actions = [],
  onRequestData,
  onInvokeAction,
  onAsk,
  onError,
  invocationEvents = [],
  height,
  className,
  title = 'Canvas',
}: CanvasFrameProps) {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const portRef = React.useRef<MessagePort | null>(null);
  const [contentHeight, setContentHeight] = React.useState<number>(MIN_FRAME_HEIGHT);
  const [ready, setReady] = React.useState(false);

  const { resolvedTheme } = useTheme();
  const theme: CanvasTheme = resolvedTheme === 'dark' ? 'dark' : 'light';

  // Regenerated per mount so a stale frame cannot rejoin a newer session.
  const channelId = React.useMemo(
    () => (globalThis.crypto?.randomUUID?.() ?? String(Math.random())).slice(0, 16),
    []
  );

  const hostUrl = React.useMemo(() => getCanvasHostUrl(), []);

  // Held in refs so the handshake effect does not re-run — and tear down the
  // channel — every time a caller passes a new inline callback.
  const handlers = React.useRef({ onRequestData, onInvokeAction, onAsk, onError });
  handlers.current = { onRequestData, onInvokeAction, onAsk, onError };

  const post = React.useCallback((message: ParentMessage) => {
    portRef.current?.postMessage(message);
  }, []);

  // Serialised so the handshake effect keys on the *contents* of these props.
  // Callers routinely pass fresh array and object literals each render, and
  // keying on identity would tear down the channel and reload the canvas on
  // every parent re-render.
  const aliasesKey = JSON.stringify(aliases);
  const actionsKey = JSON.stringify(actions);
  const propsKey = JSON.stringify(props);

  React.useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;

    const channel = new MessageChannel();
    let disposed = false;
    let windowMs = 0;
    let windowCount = 0;

    /** Crude fixed-window limiter; a flooding child is dropped, not trusted. */
    function overRate(): boolean {
      const now = Date.now();
      if (now - windowMs > 1000) {
        windowMs = now;
        windowCount = 0;
      }
      windowCount += 1;
      return windowCount > MAX_MESSAGES_PER_SECOND;
    }

    async function onPortMessage(event: MessageEvent<ChildMessage>) {
      if (disposed || overRate()) return;
      const message = event.data;

      switch (message.type) {
        case 'canvas/ready':
          setReady(true);
          break;

        case 'canvas/resize':
          if (typeof message.height === 'number' && Number.isFinite(message.height)) {
            setContentHeight(
              Math.min(MAX_FRAME_HEIGHT, Math.max(MIN_FRAME_HEIGHT, message.height))
            );
          }
          break;

        case 'canvas/data/request': {
          // Only aliases declared on the canvas record are answerable; the
          // child cannot name a context or a query of its own.
          if (!aliases.includes(message.alias)) {
            post({ type: 'canvas/data/error', alias: message.alias, message: 'Unknown binding.' });
            return;
          }
          const resolve = handlers.current.onRequestData;
          if (!resolve) {
            post({ type: 'canvas/data/error', alias: message.alias, message: 'No data source.' });
            return;
          }
          try {
            const { rows, truncated } = await resolve(message.alias);
            if (!disposed) {
              post({ type: 'canvas/data/result', alias: message.alias, rows, truncated });
            }
          } catch (error) {
            if (!disposed) {
              post({
                type: 'canvas/data/error',
                alias: message.alias,
                message: error instanceof Error ? error.message : 'Failed to load data.',
              });
            }
          }
          break;
        }

        case 'canvas/action/invoke': {
          const invoke = handlers.current.onInvokeAction;
          const declared = actions.some((action) => action.name === message.actionName);
          if (!declared || !invoke) {
            post({
              type: 'canvas/action/denied',
              requestId: message.requestId,
              reason: 'Unknown action.',
            });
            return;
          }
          try {
            const invocationId = await invoke(message.actionName, message.args ?? {});
            if (!disposed) {
              post({ type: 'canvas/action/accepted', requestId: message.requestId, invocationId });
            }
          } catch (error) {
            if (!disposed) {
              post({
                type: 'canvas/action/denied',
                requestId: message.requestId,
                reason: error instanceof Error ? error.message : 'Action refused.',
              });
            }
          }
          break;
        }

        case 'canvas/ask':
          if (typeof message.text === 'string') handlers.current.onAsk?.(message.text);
          break;

        case 'canvas/error':
          handlers.current.onError?.(message.message, message.stack);
          break;
      }
    }

    function onWindowMessage(event: MessageEvent) {
      // An opaque-origin child reports origin "null", so identity of the source
      // window plus the per-mount nonce is what can be checked here.
      if (disposed || portRef.current) return;
      if (event.source !== frame?.contentWindow) return;
      if (!isCanvasHello(event.data)) return;

      portRef.current = channel.port1;
      channel.port1.onmessage = onPortMessage;
      channel.port1.start();

      frame?.contentWindow?.postMessage(
        {
          type: 'canvas/init',
          protocol: CANVAS_PROTOCOL_VERSION,
          channel: channelId,
          source,
          theme,
          props,
          aliases,
          actions,
        },
        '*',
        [channel.port2]
      );
    }

    window.addEventListener('message', onWindowMessage);
    return () => {
      disposed = true;
      window.removeEventListener('message', onWindowMessage);
      window.setTimeout(() => {
        channel.port1.close();
        channel.port2.close();
      }, 0);
      portRef.current = null;
      setReady(false);
    };
    // `theme` is deliberately excluded: a theme change is pushed over the
    // existing port below rather than rebuilding the channel and reloading the
    // canvas. `aliases`/`actions`/`props` are read through their serialised
    // keys for the same reason, and callbacks live in a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, channelId, aliasesKey, actionsKey, propsKey, post]);

  // Follow console's theme without remounting the frame.
  React.useEffect(() => {
    if (ready) post({ type: 'canvas/theme', theme });
  }, [ready, theme, post]);

  // Deliver invocation updates once each.
  //
  // A cursor rather than a "latest event" prop: several updates can land between
  // renders, and re-posting the whole list on every render would make a canvas
  // that counts its own results wrong. The cursor resets with the channel, so a
  // reloaded frame is not replayed history it never asked for.
  const deliveredRef = React.useRef(0);
  React.useEffect(() => {
    if (!ready) return;
    if (invocationEvents.length < deliveredRef.current) {
      deliveredRef.current = 0;
    }
    for (const event of invocationEvents.slice(deliveredRef.current)) {
      const invocationId = String(event.invocationId);
      if (TERMINAL_STATUSES.has(event.status)) {
        post({
          type: 'canvas/action/result',
          invocationId,
          ok: event.status === 'succeeded',
          result: event.result,
          error: event.error,
        });
      } else {
        post({
          type: 'canvas/action/progress',
          invocationId,
          // 'requested' is the protocol's 'pending'; the rest line up by name.
          status: event.status === 'requested' ? 'pending' : 'running',
        });
      }
    }
    deliveredRef.current = invocationEvents.length;
  }, [ready, invocationEvents, post]);

  React.useEffect(() => {
    deliveredRef.current = 0;
  }, [source, channelId]);

  // Settle the frame after it grows to the child's reported height.
  //
  // Chrome (observed on macOS with GPU compositing) can keep displaying an
  // empty surface for a sandboxed cross-origin frame after the element grows
  // to the size the child asked for: the child has painted, the parent never
  // re-embeds its surface, and a tall canvas reads as a black block until any
  // later geometry change. The change is what repairs it, but only once the
  // child has actually painted, and a chart-heavy first render in the
  // sandboxed process can take several seconds after the height is reported.
  // So after each applied height the frame is nudged by a pixel and restored
  // on a schedule that outlasts a slow first paint. Timers rather than
  // animation frames: a background tab does not run frames.
  React.useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || height != null) return;
    const settle = () => {
      frame.style.height = `${contentHeight + 1}px`;
      window.setTimeout(() => {
        frame.style.height = `${contentHeight}px`;
      }, 50);
    };
    const timers = SETTLE_DELAYS_MS.map((delay) => window.setTimeout(settle, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [contentHeight, height]);

  return (
    <iframe
      ref={iframeRef}
      src={hostUrl}
      title={title}
      // Never add `allow-same-origin`: it would give the frame a real origin and
      // undo the opaque-origin half of the isolation.
      sandbox="allow-scripts"
      allow=""
      referrerPolicy="no-referrer"
      className={cn('w-full border-0 bg-transparent', className)}
      style={{ height: height ?? contentHeight }}
    />
  );
}
