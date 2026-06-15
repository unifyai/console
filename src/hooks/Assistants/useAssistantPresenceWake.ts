import * as React from 'react';
import {
  requestAssistantPresenceWake,
  type AssistantPresenceWakeReason,
  type AssistantPresenceWakeSource,
} from '@/lib/client/assistant-presence';

export const ASSISTANT_PRESENCE_ACTIVITY_THROTTLE_MS = 60_000;
export const ASSISTANT_PRESENCE_KEEP_WARM_INTERVAL_MS = 5 * 60_000;

type RequestWake = typeof requestAssistantPresenceWake;

interface UseAssistantPresenceWakeOptions {
  enabled?: boolean;
  activityThrottleMs?: number;
  keepWarmIntervalMs?: number;
  requestWake?: RequestWake;
  now?: () => number;
}

function pageVisibility(): DocumentVisibilityState | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.visibilityState;
}

function isPageVisible(): boolean {
  const visibility = pageVisibility();
  return visibility === undefined || visibility === 'visible';
}

export function useAssistantPresenceWake(
  assistantId: string | null | undefined,
  {
    enabled = true,
    activityThrottleMs = ASSISTANT_PRESENCE_ACTIVITY_THROTTLE_MS,
    keepWarmIntervalMs = ASSISTANT_PRESENCE_KEEP_WARM_INTERVAL_MS,
    requestWake = requestAssistantPresenceWake,
    now = Date.now,
  }: UseAssistantPresenceWakeOptions = {}
) {
  const assistantIdRef = React.useRef<string | null>(assistantId ?? null);
  const lastSentAtByKeyRef = React.useRef<Record<string, number>>({});

  React.useEffect(() => {
    assistantIdRef.current = assistantId ?? null;
  }, [assistantId]);

  const sendWake = React.useCallback(
    (
      reason: AssistantPresenceWakeReason,
      source: AssistantPresenceWakeSource,
      { force = false }: { force?: boolean } = {}
    ) => {
      const currentAssistantId = assistantIdRef.current;
      if (!enabled || !currentAssistantId || !isPageVisible()) return;

      const key = `${currentAssistantId}:${source}`;
      const currentTime = now();
      const lastSentAt = lastSentAtByKeyRef.current[key];
      if (!force && lastSentAt !== undefined && currentTime - lastSentAt < activityThrottleMs) {
        return;
      }

      lastSentAtByKeyRef.current[key] = currentTime;
      void requestWake({
        assistantId: currentAssistantId,
        source,
        reason,
        pageVisibility: pageVisibility(),
        occurredAt: new Date(currentTime).toISOString(),
      }).catch((error) => {
        console.error('[useAssistantPresenceWake] Failed to request assistant wake:', error);
      });
    },
    [activityThrottleMs, enabled, now, requestWake]
  );

  React.useEffect(() => {
    if (!enabled || !assistantId) return;
    sendWake('selection', 'assistant_profile', { force: true });
  }, [assistantId, enabled, sendWake]);

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleFocus = () => sendWake('focus', 'assistant_profile');
    const handleVisibilityChange = () => {
      if (isPageVisible()) sendWake('visibility', 'assistant_profile');
    };
    const handleActivity = () => sendWake('activity', 'assistant_activity');

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('pointerdown', handleActivity, { passive: true });
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('pointermove', handleActivity, { passive: true });
    document.addEventListener('mouseover', handleActivity, { passive: true });

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('pointerdown', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('pointermove', handleActivity);
      document.removeEventListener('mouseover', handleActivity);
    };
  }, [enabled, sendWake]);

  React.useEffect(() => {
    if (!enabled || !assistantId || typeof window === 'undefined') return;

    const interval = window.setInterval(() => {
      sendWake('keepwarm', 'assistant_profile');
    }, keepWarmIntervalMs);

    return () => window.clearInterval(interval);
  }, [assistantId, enabled, keepWarmIntervalMs, sendWake]);
}
