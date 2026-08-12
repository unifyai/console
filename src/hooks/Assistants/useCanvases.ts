import * as React from 'react';

import { useShellResource } from '@/hooks/Common/useShellResource';
import { rootKey, type ContextRoot } from '@/lib/assistants/scope';
import { subscribeToAssistantActionStream } from '@/lib/client/assistant-action-stream';
import { fetchCanvasList, type CanvasListRecord } from '@/lib/client/canvasList';
import type { CanvasFrame } from '@/lib/assistants/canvas-stream-frame';
import type { Assistant } from '@/types/assistants/assistant';

interface UseCanvasesOptions {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Scope override: a team root reads `Teams/{id}/Canvas/Views` only. */
  root?: ContextRoot | null;
  /** Gate every read on the pane being the visible one. */
  enabled?: boolean;
}

interface UseCanvasesResult {
  canvases: CanvasListRecord[];
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: (options?: { blocking?: boolean }) => Promise<unknown>;
}

/**
 * The canvases an assistant has published, kept current by its action stream.
 *
 * Event-driven rather than polled. A canvas takes a full authoring
 * pipeline to publish — lint, typecheck,
 * bundle, render, critique — so publishes are rare and clustered, and an interval
 * would be almost entirely wasted requests that still leave a gap after the one
 * moment it matters: the assistant finishing a canvas the user just asked for.
 */
export function useCanvases({
  assistant,
  ownerId,
  assistantId,
  root = null,
  enabled = true,
}: UseCanvasesOptions): UseCanvasesResult {
  const { data, isInitialLoading, isRefreshing, error, refresh } = useShellResource<
    CanvasListRecord[]
  >({
    queryKey: ['canvases', ownerId, assistantId, rootKey(root ?? { kind: 'personal' })],
    queryFn: () => fetchCanvasList(assistant, root),
    enabled: enabled && !!ownerId && !!assistantId,
  });

  // Held in a ref so the subscription is not torn down and rebuilt every time
  // react-query hands back a new `refresh` identity.
  const refreshRef = React.useRef(refresh);
  refreshRef.current = refresh;

  React.useEffect(() => {
    if (!assistantId) return;

    return subscribeToAssistantActionStream(assistantId, {
      onMessage: (raw) => {
        let frame: CanvasFrame;
        try {
          frame = JSON.parse(raw) as CanvasFrame;
        } catch {
          return;
        }
        // Only the listing matters here. An invocation changes what a canvas
        // shows, not which canvases exist, and re-reading every row for one is
        // work with no observable effect on this pane.
        if (frame?.type !== 'CanvasUpdated') return;
        void refreshRef.current();
      },
    });
  }, [assistantId]);

  const canvases = React.useMemo(() => data ?? [], [data]);

  return {
    canvases,
    isInitialLoading,
    isRefreshing,
    error: error as Error | null,
    refetch: refresh,
  };
}
