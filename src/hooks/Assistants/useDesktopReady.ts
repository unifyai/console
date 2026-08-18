import * as React from 'react';

import {
  type DesktopSessionScope,
  desktopReadyStorageKey,
  readDesktopReadyEventField,
} from '@/lib/assistants/desktopSessionScope';

export interface DesktopReadyState {
  isDesktopReady: boolean;
  /** Raw liveview URL from the `assistant_desktop_ready` event (no password). */
  eventLiveviewUrl: string | null;
  /** Binding id from the current session's desktop-ready event, when known. */
  eventBindingId: string | null;
  /** Per-binding desktop secret from the event, when the producer publishes one. */
  eventLiveviewPassword: string | null;
}

type DesktopReadyPayload = Record<string, unknown>;

function extractLiveviewUrlPassword(url: string): string | null {
  try {
    return new URL(url).searchParams.get('password');
  } catch {
    return null;
  }
}

function readStoredDesktopReady(
  assistantId: string | undefined,
  sessionScope: string | undefined
): { url: string | null; bindingId: string | null; password: string | null } | null {
  if (!assistantId || !sessionScope) return null;
  try {
    const raw = sessionStorage.getItem(desktopReadyStorageKey(assistantId, sessionScope));
    if (!raw) return null;
    const data = JSON.parse(raw) as DesktopReadyPayload;
    return {
      url: readDesktopReadyEventField(data, 'liveview_url', 'liveviewUrl'),
      bindingId: readDesktopReadyEventField(data, 'binding_id', 'bindingId'),
      password: readDesktopReadyEventField(data, 'liveview_password', 'liveviewPassword'),
    };
  } catch {
    return null;
  }
}

function applyDesktopReadyPayload(
  data: DesktopReadyPayload,
  expectedBindingId: string | null | undefined
): { ready: boolean; url: string | null; bindingId: string | null; password: string | null } {
  const bindingId = readDesktopReadyEventField(data, 'binding_id', 'bindingId');
  if (expectedBindingId && bindingId && bindingId !== expectedBindingId) {
    return { ready: false, url: null, bindingId: null, password: null };
  }
  const url = readDesktopReadyEventField(data, 'liveview_url', 'liveviewUrl');
  const password = readDesktopReadyEventField(data, 'liveview_password', 'liveviewPassword');
  if (!url) {
    return { ready: false, url: null, bindingId, password };
  }
  return { ready: true, url, bindingId, password };
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
 * 3. Low-frequency fallback poll via `getLiveviewUrl` when a session scope
 *    (binding id from SSE or job name from runtime status) is known. The
 *    standalone desktop pane opts into an unscoped fallback during its own
 *    startup because it has neither identifier before the first ready event.
 *
 * `pollIntervalMs` takes `null` to mean no fallback poll at all, and carries no
 * default — callers own their cadence. An omitted interval that silently
 * selected one is how a surface ends up polling `getLiveviewUrl` for every
 * assistant the user opens while believing it had switched polling off, so
 * saying nothing is not allowed to mean "poll anyway".
 */
export function useDesktopReady(
  assistantId: string | undefined,
  getLiveviewUrl:
    | ((
        id: string,
        sessionScope?: DesktopSessionScope | null
      ) => Promise<{ liveviewUrl?: string } | { detail: string }>)
    | undefined,
  initialValue: boolean,
  pollIntervalMs: number | null,
  resetSignal = 0,
  sessionScope?: string | null,
  runtimePollScope?: DesktopSessionScope | null,
  allowUnscopedFallback = false
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
  const [eventLiveviewPassword, setEventLiveviewPassword] = React.useState<string | null>(
    () => storedInitial?.password ?? null
  );

  // Reset when assistant changes, session scope changes, or the caller retries.
  React.useEffect(() => {
    const stored = readStoredDesktopReady(assistantId, sessionScope ?? undefined);
    setIsDesktopReady(initialValue || !!stored?.url);
    setEventLiveviewUrl(stored?.url ?? null);
    setEventBindingId(stored?.bindingId ?? null);
    setEventLiveviewPassword(stored?.password ?? null);
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
      setEventLiveviewPassword(applied.password);
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
    if (runtimePollScope?.jobName) {
      return { jobName: runtimePollScope.jobName };
    }
    if (runtimePollScope?.bindingId) {
      return { bindingId: runtimePollScope.bindingId };
    }
    return null;
  }, [eventBindingId, runtimePollScope]);

  React.useEffect(() => {
    if (!assistantId || !getLiveviewUrl || isDesktopReady) return;
    if (pollIntervalMs === null) return;
    if (!allowUnscopedFallback && !pollScope?.bindingId && !pollScope?.jobName) return;

    let cancelled = false;

    const check = async () => {
      try {
        const result = await getLiveviewUrl(assistantId, pollScope);
        if (!cancelled && result && 'liveviewUrl' in result && result.liveviewUrl) {
          setIsDesktopReady(true);
          const url = result.liveviewUrl;
          setEventLiveviewUrl((current) => current ?? url);
          // getLiveviewUrl already resolves the correct password (published
          // secret or owner-key fallback) into `url`'s query string. Carry it
          // over so a later buildLiveviewUrl() call reuses it instead of
          // re-resolving the owner key and clobbering a published secret.
          const password = extractLiveviewUrlPassword(url);
          if (password) {
            setEventLiveviewPassword((current) => current ?? password);
          }
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
  }, [
    allowUnscopedFallback,
    assistantId,
    getLiveviewUrl,
    isDesktopReady,
    pollIntervalMs,
    pollScope,
  ]);

  return { isDesktopReady, eventLiveviewUrl, eventBindingId, eventLiveviewPassword };
}
