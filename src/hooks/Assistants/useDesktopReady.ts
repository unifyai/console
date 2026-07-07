import * as React from 'react';

import {
  type DesktopSessionScope,
  desktopReadyStorageKey,
  readDesktopReadyEventField,
} from '@/lib/assistants/desktopSessionScope';

const DESKTOP_READY_FALLBACK_INTERVAL = 15000;

export interface DesktopReadyState {
  isDesktopReady: boolean;
  /** Raw liveview URL from the `assistant_desktop_ready` event (no password). */
  eventLiveviewUrl: string | null;
  /** Binding id from the current session's desktop-ready event, when known. */
  eventBindingId: string | null;
}

type DesktopReadyPayload = Record<string, unknown>;

function readStoredDesktopReady(
  assistantId: string | undefined,
  sessionScope: string | undefined
): { url: string | null; bindingId: string | null } | null {
  if (!assistantId || !sessionScope) return null;
  try {
    const raw = sessionStorage.getItem(desktopReadyStorageKey(assistantId, sessionScope));
    if (!raw) return null;
    const data = JSON.parse(raw) as DesktopReadyPayload;
    return {
      url: readDesktopReadyEventField(data, 'liveview_url', 'liveviewUrl'),
      bindingId: readDesktopReadyEventField(data, 'binding_id', 'bindingId'),
    };
  } catch {
    return null;
  }
}

function applyDesktopReadyPayload(
  data: DesktopReadyPayload,
  expectedBindingId: string | null | undefined
): { ready: boolean; url: string | null; bindingId: string | null } {
  const bindingId = readDesktopReadyEventField(data, 'binding_id', 'bindingId');
  if (expectedBindingId && bindingId && bindingId !== expectedBindingId) {
    return { ready: false, url: null, bindingId: null };
  }
  const url = readDesktopReadyEventField(data, 'liveview_url', 'liveviewUrl');
  if (!url) {
    return { ready: false, url: null, bindingId };
  }
  return { ready: true, url, bindingId };
}

/**
 * Detects when an assistant's desktop VM is ready via three mechanisms
 * (checked in order of speed):
 *
 * 1. sessionStorage (synchronous) — scoped to the active call session so a
 *    previous session's desktop-ready payload cannot satisfy this call.
 *
 * 2. BroadcastChannel (real-time) — the SSE handler broadcasts the scoped
 *    payload for tabs that are already listening.
 *
 * 3. Low-frequency fallback poll via `getLiveviewUrl` — only when a session
 *    scope (binding or job name) is known so startup_events can be filtered.
 */
export function useDesktopReady(
  assistantId: string | undefined,
  getLiveviewUrl:
    | ((
        id: string,
        sessionScope?: DesktopSessionScope | null
      ) => Promise<{ liveviewUrl?: string } | { detail: string }>)
    | undefined,
  initialValue = false,
  pollIntervalMs = DESKTOP_READY_FALLBACK_INTERVAL,
  resetSignal = 0,
  sessionScope?: string | null
): DesktopReadyState {
  const storedInitial = readStoredDesktopReady(assistantId, sessionScope ?? undefined);
  const [isDesktopReady, setIsDesktopReady] = React.useState(
    () => initialValue || !!storedInitial?.url
  );
  const [eventLiveviewUrl, setEventLiveviewUrl] = React.useState<string | null>(
    () => storedInitial?.url ?? null
  );
  const [eventBindingId, setEventBindingId] = React.useState<string | null>(
    () => storedInitial?.bindingId ?? null
  );

  // Reset when assistant changes, session scope changes, or the caller retries.
  React.useEffect(() => {
    const stored = readStoredDesktopReady(assistantId, sessionScope ?? undefined);
    setIsDesktopReady(initialValue || !!stored?.url);
    setEventLiveviewUrl(stored?.url ?? null);
    setEventBindingId(stored?.bindingId ?? null);
  }, [assistantId, initialValue, resetSignal, sessionScope]);

  React.useEffect(() => {
    if (!assistantId || !sessionScope) return;

    const channel = new BroadcastChannel(`assistant-desktop-ready-${assistantId}`);
    channel.onmessage = (event: MessageEvent<DesktopReadyPayload>) => {
      const applied = applyDesktopReadyPayload(event.data ?? {}, null);
      if (!applied.ready || !applied.url) return;
      setIsDesktopReady(true);
      setEventLiveviewUrl(applied.url);
      setEventBindingId(applied.bindingId);
      try {
        sessionStorage.setItem(
          desktopReadyStorageKey(assistantId, sessionScope),
          JSON.stringify(event.data ?? {})
        );
      } catch {
        /* quota / SSR */
      }
    };
    return () => channel.close();
  }, [assistantId, sessionScope]);

  const pollScope = React.useMemo<DesktopSessionScope | null>(() => {
    if (eventBindingId) {
      return { bindingId: eventBindingId };
    }
    return null;
  }, [eventBindingId]);

  React.useEffect(() => {
    if (!assistantId || !getLiveviewUrl || isDesktopReady) return;
    if (!pollScope?.bindingId && !pollScope?.jobName) return;

    let cancelled = false;

    const check = async () => {
      try {
        const result = await getLiveviewUrl(assistantId, pollScope);
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
  }, [assistantId, getLiveviewUrl, isDesktopReady, pollIntervalMs, pollScope]);

  return { isDesktopReady, eventLiveviewUrl, eventBindingId };
}
