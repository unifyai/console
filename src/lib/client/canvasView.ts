'use client';

/**
 * Loads one canvas for a surface to mount.
 *
 * Kept out of the component so all three surfaces share one loading contract.
 * A per-surface copy is how one of them ends up without the abort handling and
 * renders a canvas the viewer has already navigated away from.
 */

import * as React from 'react';

import type { CanvasActionDescriptor } from '@/lib/client/canvasActions';

/** One canvas, exactly as `/api/canvas/[token]` returns it. */
export interface CanvasPayload {
  token: string;
  title: string;
  description: string | null;
  source: string;
  props: Record<string, unknown>;
  aliases: string[];
  kitVersion: string;
  updatedAt: string | null;
  actions: CanvasActionDescriptor[];
}

export interface CanvasLoadState {
  canvas: CanvasPayload | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Fetch one canvas, re-fetching whenever `revision` changes.
 *
 * `revision` is how a republish reaches an already-mounted frame: a surface that
 * hears `canvas_updated` bumps it, and the new bundle arrives without the surface
 * having to remount anything or know what changed.
 */
export function useCanvas(token: string, revision: number | string = 0): CanvasLoadState {
  const [state, setState] = React.useState<CanvasLoadState>({
    canvas: null,
    error: null,
    isLoading: true,
  });

  React.useEffect(() => {
    const controller = new AbortController();
    // Kept alongside the signal because an aborted fetch still resolves in some
    // paths, and a late setState would overwrite a newer revision's result.
    let cancelled = false;

    setState((current) => ({ ...current, isLoading: true, error: null }));

    (async () => {
      try {
        const response = await fetch(`/api/canvas/${encodeURIComponent(token)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          let message = 'This canvas could not be loaded.';
          try {
            const body = await response.json();
            if (typeof body?.error === 'string') message = body.error;
          } catch {
            // Non-JSON error body; the generic message stands.
          }
          throw new Error(message);
        }

        const canvas = (await response.json()) as CanvasPayload;
        if (!cancelled) setState({ canvas, error: null, isLoading: false });
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        setState({
          canvas: null,
          error: error instanceof Error ? error.message : 'This canvas could not be loaded.',
          isLoading: false,
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, revision]);

  return state;
}
