import * as React from 'react';
import { fetchAssistantStatus } from '@/lib/client/assistant';

const DESKTOP_READY_FALLBACK_INTERVAL = 15000;

export interface DesktopReadyState {
  isDesktopReady: boolean;
  /** Raw liveview URL from the `assistant_desktop_ready` event (no password). */
  eventLiveviewUrl: string | null;
}

/**
 * Detects when an assistant's desktop VM is ready via two mechanisms:
 *
 * 1. BroadcastChannel — `useAssistantProfileChat` receives the
 *    `assistant_desktop_ready` event over SSE and broadcasts it.
 *    This is instant and zero-cost. If the event payload contains
 *    `liveview_url`, it is captured so callers can skip the logs
 *    API roundtrip.
 *
 * 2. Low-frequency fallback poll via `getLiveviewUrl` — covers the
 *    case where no SSE listener is active (e.g. standalone fullscreen
 *    tab with the chat panel closed). Runs every 15 s with a single
 *    non-retrying fetch, dramatically lighter than the old 3 s poll
 *    with 15 internal retries each.
 */
export function useDesktopReady(
  assistantId: string | undefined,
  getLiveviewUrl:
    | ((id: string) => Promise<{ liveviewUrl?: string } | { detail: string }>)
    | undefined,
  initialValue = false
): DesktopReadyState {
  const [isDesktopReady, setIsDesktopReady] = React.useState(initialValue);
  const [eventLiveviewUrl, setEventLiveviewUrl] = React.useState<string | null>(null);

  // Reset when assistant changes
  React.useEffect(() => {
    setIsDesktopReady(initialValue);
    setEventLiveviewUrl(null);
  }, [assistantId, initialValue]);

  // Primary: listen for BroadcastChannel events from useAssistantProfileChat
  React.useEffect(() => {
    if (!assistantId || isDesktopReady) return;

    const channel = new BroadcastChannel(`assistant-desktop-ready-${assistantId}`);
    channel.onmessage = (e: MessageEvent) => {
      setIsDesktopReady(true);
      const url = e.data?.liveview_url ?? e.data?.liveviewUrl;
      if (typeof url === 'string' && url) {
        setEventLiveviewUrl(url);
      }
    };
    return () => channel.close();
  }, [assistantId, isDesktopReady]);

  // Fallback: single-shot check on mount + low-frequency polling
  React.useEffect(() => {
    if (!assistantId || !getLiveviewUrl || isDesktopReady) return;

    let cancelled = false;

    const check = async () => {
      try {
        const result = await getLiveviewUrl(assistantId);
        if (!cancelled && result && 'liveviewUrl' in result && result.liveviewUrl) {
          const status = await fetchAssistantStatus(assistantId);
          if (!cancelled && status?.running) {
            setIsDesktopReady(true);
          }
        }
      } catch {
        // not ready yet
      }
    };

    check();
    const interval = setInterval(check, DESKTOP_READY_FALLBACK_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [assistantId, getLiveviewUrl, isDesktopReady]);

  return { isDesktopReady, eventLiveviewUrl };
}
