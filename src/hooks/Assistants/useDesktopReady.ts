import * as React from 'react';

const DESKTOP_READY_FALLBACK_INTERVAL = 15000;

export interface DesktopReadyState {
  isDesktopReady: boolean;
  /** Raw liveview URL from the `assistant_desktop_ready` event (no password). */
  eventLiveviewUrl: string | null;
}

function readStoredDesktopReady(assistantId: string | undefined): { url: string | null } | null {
  if (!assistantId) return null;
  try {
    const raw = sessionStorage.getItem(`desktop-ready-${assistantId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const url = data?.liveview_url ?? data?.liveviewUrl;
    return { url: typeof url === 'string' && url ? url : null };
  } catch {
    return null;
  }
}

/**
 * Detects when an assistant's desktop VM is ready via three mechanisms
 * (checked in order of speed):
 *
 * 1. sessionStorage (synchronous) — `useAssistantProfileChat` persists
 *    the `assistant_desktop_ready` payload when it arrives over SSE.
 *    Read during state initialization so the value is available on the
 *    very first render, with no effect-driven re-render required.
 *
 * 2. BroadcastChannel (real-time) — same SSE handler also broadcasts
 *    the event for any tabs that are already listening.
 *
 * 3. Low-frequency fallback poll via `getLiveviewUrl` — covers the
 *    case where no SSE listener is active (e.g. standalone fullscreen
 *    tab with the chat panel closed). Runs every 15 s with a single
 *    non-retrying fetch. The liveview URL is only written after VM
 *    readiness, so its presence is sufficient proof.
 */
export function useDesktopReady(
  assistantId: string | undefined,
  getLiveviewUrl:
    | ((id: string) => Promise<{ liveviewUrl?: string } | { detail: string }>)
    | undefined,
  initialValue = false,
  pollIntervalMs = DESKTOP_READY_FALLBACK_INTERVAL,
  resetSignal = 0
): DesktopReadyState {
  const [isDesktopReady, setIsDesktopReady] = React.useState(
    () => initialValue || !!readStoredDesktopReady(assistantId)
  );
  const [eventLiveviewUrl, setEventLiveviewUrl] = React.useState<string | null>(
    () => readStoredDesktopReady(assistantId)?.url ?? null
  );

  // Reset when assistant changes or the caller explicitly retries startup.
  React.useEffect(() => {
    const stored = readStoredDesktopReady(assistantId);
    setIsDesktopReady(initialValue || !!stored);
    setEventLiveviewUrl(stored?.url ?? null);
  }, [assistantId, initialValue, resetSignal]);

  // Real-time: listen for BroadcastChannel events from useAssistantProfileChat
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

  // Fallback: single-shot check on mount + low-frequency polling.
  React.useEffect(() => {
    if (!assistantId || !getLiveviewUrl || isDesktopReady) return;

    let cancelled = false;

    const check = async () => {
      try {
        const result = await getLiveviewUrl(assistantId).catch(() => null);
        if (!cancelled && result && 'liveviewUrl' in result && result.liveviewUrl) {
          setIsDesktopReady(true);
          const url = result.liveviewUrl;
          setEventLiveviewUrl((current) => current ?? url);
        }
      } catch {
        // not ready yet
      }
    };

    check();
    const interval = setInterval(check, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [assistantId, getLiveviewUrl, isDesktopReady, pollIntervalMs]);

  return { isDesktopReady, eventLiveviewUrl };
}
