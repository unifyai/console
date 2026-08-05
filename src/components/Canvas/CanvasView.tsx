'use client';

/**
 * One mounted canvas, with its data and its actions wired up.
 *
 * This is what every canvas surface mounts. The chat embed, the assistants tab and
 * the standalone page differ only in the chrome around it — title bar, sizing,
 * where it sits — so keeping the wiring here is what stops one surface from
 * quietly acquiring a different security posture than the others. In particular the
 * confirmation dialog is rendered *here*, outside the frame, on all three.
 */

import * as React from 'react';

import type { CanvasActionDescriptor as ProtocolActionDescriptor } from '@unity/canvas-kit/protocol';

import { ActionConfirmDialog } from '@/components/Canvas/ActionConfirmDialog';
import { CanvasFrame } from '@/components/Canvas/CanvasFrame';
import { CanvasRunHistory } from '@/components/Canvas/CanvasRunHistory';
import { Loader } from '@/components/Common/Loader';
import { canvasDataResolver } from '@/lib/client/canvasData';
import { useCanvasActions, type CanvasActionDescriptor } from '@/lib/client/canvasActions';
import { mergeInvocationEvents, useCanvasInvocationTracker } from '@/lib/client/canvasInvocations';
import { useCanvas, type CanvasPayload } from '@/lib/client/canvasView';
import { useCanvasStream } from '@/lib/client/canvasStream';
import { cn } from '@/lib/utils';

/**
 * Narrow a stored descriptor to what the frame protocol carries.
 *
 * The row records an absent schema as `null` while the protocol models it as
 * absent, and `icon` is chrome's business rather than the frame's. Converting here
 * keeps the wire shape honest about what Orchestra returns instead of loosening
 * the protocol to accommodate it.
 */
function forProtocol(actions: CanvasActionDescriptor[]): ProtocolActionDescriptor[] {
  return actions.map(({ name, label, inputSchema, requiresConfirmation, destructive }) => ({
    name,
    label,
    ...(inputSchema ? { inputSchema } : {}),
    requiresConfirmation,
    destructive,
  }));
}

export interface CanvasViewProps {
  token: string;
  /**
   * Assistant whose action stream carries this canvas's signals. Given it, the
   * view follows republishes and reports action outcomes back into the frame on
   * its own; without it the canvas renders as a snapshot.
   */
  assistantId?: string | null;
  /**
   * Bumped by a surface that already tracks revisions itself. Live updates arrive
   * through `assistantId`, so this is for chrome that re-reads for its own reasons.
   */
  revision?: number | string;
  /** Fixed height. Omit to let the canvas size the frame to its content. */
  height?: number;
  /** Reported once the record is loaded, for chrome that shows the title. */
  onLoaded?: (canvas: CanvasPayload) => void;
  /** Called when the viewer asks for a change from inside the canvas. */
  onAsk?: (text: string) => void;
  /**
   * Called when the canvas reports a load or render failure. The frame shows the
   * viewer its own error state either way; this is for chrome that wants to know.
   */
  onError?: (message: string, stack?: string) => void;
  className?: string;
}

function CanvasMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-body flex min-h-[120px] items-center justify-center p-6 text-center text-muted-foreground">
      {children}
    </div>
  );
}

export function CanvasView({
  token,
  assistantId,
  revision = 0,
  height,
  onLoaded,
  onAsk,
  onError,
  className,
}: CanvasViewProps) {
  const live = useCanvasStream(token, assistantId);
  // Either source can force a re-read, so the record key combines them.
  const { canvas, error, isLoading } = useCanvas(token, `${revision}:${live.revision}`);

  // Actions come from the server, so `requiresConfirmation` is the stored
  // declaration rather than something the frame asserted about itself.
  const actions = canvas?.actions ?? [];
  const {
    invokeAction: dispatchAction,
    pending,
    confirmPending,
    cancelPending,
  } = useCanvasActions(token, actions);

  const tracker = useCanvasInvocationTracker(token);

  // Every accepted run is followed to completion. Wrapped here rather than inside
  // the dispatch hook so the id is tracked on exactly the path the frame awaits,
  // including a run started from the confirmation dialog.
  const invokeAction = React.useCallback(
    async (actionName: string, args: Record<string, unknown>) => {
      const invocationId = await dispatchAction(actionName, args);
      tracker.track(invocationId);
      return invocationId;
    },
    [dispatchAction, tracker]
  );

  // The poller sees the runs this client started; the stream sees every run on the
  // canvas. Both can report the same transition, and the frame delivers whatever it
  // is handed, so they are deduplicated before they get there.
  const invocationEvents = React.useMemo(
    () => mergeInvocationEvents(tracker.events, live.invocationEvents),
    [tracker.events, live.invocationEvents]
  );

  // Serialised because `forProtocol` builds fresh objects each render, and
  // `CanvasFrame` keys its handshake on the contents of `actions`.
  const actionsKey = JSON.stringify(actions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frameActions = React.useMemo(() => forProtocol(actions), [actionsKey]);

  const resolveData = React.useMemo(() => canvasDataResolver(token), [token]);

  const onLoadedRef = React.useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  React.useEffect(() => {
    if (canvas) onLoadedRef.current?.(canvas);
  }, [canvas]);

  if (isLoading && !canvas) {
    return (
      <div className={cn('flex min-h-[120px] items-center justify-center p-6', className)}>
        <Loader size={24} />
      </div>
    );
  }

  if (live.deleted) {
    return (
      <div className={className}>
        <CanvasMessage>This canvas has been deleted.</CanvasMessage>
      </div>
    );
  }

  if (error || !canvas) {
    return (
      <div className={className}>
        <CanvasMessage>{error ?? 'This canvas could not be loaded.'}</CanvasMessage>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Chrome, not canvas content. An authored canvas cannot draw, restyle or
          omit this, which is the point: it reports what the stored rows say. */}
      {actions.length > 0 ? (
        <div className="flex justify-end px-1">
          <CanvasRunHistory token={token} revision={invocationEvents.length} />
        </div>
      ) : null}
      <CanvasFrame
        source={canvas.source}
        props={canvas.props}
        aliases={canvas.aliases}
        actions={frameActions}
        onRequestData={resolveData}
        onInvokeAction={invokeAction}
        onAsk={onAsk}
        onError={onError}
        invocationEvents={invocationEvents}
        height={height}
        title={canvas.title}
      />
      <ActionConfirmDialog pending={pending} onConfirm={confirmPending} onCancel={cancelPending} />
    </div>
  );
}
