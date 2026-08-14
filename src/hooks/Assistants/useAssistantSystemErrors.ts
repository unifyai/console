/**
 * Hook for receiving assistant-level system error events via SSE.
 *
 * Opens a single SSE connection to the system-errors stream when an assistant
 * is selected. Incoming errors are shown as temporary toast notifications
 * with user-friendly copy. No persistent state — just fire-and-forget toasts.
 *
 * Features:
 * - Auto-reconnect with exponential backoff (up to 5 attempts)
 * - Deduplication: ignores repeated errors of the same type within 15s
 * - Skips connection for assistants whose topic doesn't exist
 */

import * as React from 'react';
import { toast } from 'sonner';
import {
  parseSystemErrorPayload,
  getFriendlyErrorCopy,
  DEDUP_WINDOW_MS,
} from '@/utils/assistants/system-errors';
import type { Assistant } from '@/types/assistants/assistant';
import { assistantDisplayName } from '@/lib/assistants/displayName';

const SSE_MAX_RECONNECT_ATTEMPTS = 5;
const SSE_RECONNECT_BASE_DELAY = 2000;

export function useAssistantSystemErrors(assistant: Assistant | null): void {
  const assistantId = assistant?.agentId || null;
  const assistantName = assistantDisplayName(assistant, '');

  const lastErrorRef = React.useRef<{ type: string; time: number } | null>(null);

  // Reset dedup tracker when assistant changes
  React.useEffect(() => {
    lastErrorRef.current = null;
  }, [assistantId]);

  // SSE connection
  React.useEffect(() => {
    if (!assistantId) return;

    const name = assistantName;
    let reconnectAttempts = 0;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let eventSource: EventSource | null = null;
    let cancelled = false;
    let hasEverConnected = false;

    const connect = () => {
      if (cancelled) return;

      eventSource = new EventSource(`/api/assistant/${assistantId}/system-errors/stream`);

      eventSource.onopen = () => {
        reconnectAttempts = 0;
        hasEverConnected = true;
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const parsed = parseSystemErrorPayload(payload);
          if (!parsed) return;

          // Deduplicate: skip if same error type within the window
          const now = Date.now();
          if (
            lastErrorRef.current &&
            lastErrorRef.current.type === parsed.type &&
            now - lastErrorRef.current.time < DEDUP_WINDOW_MS
          ) {
            return;
          }
          lastErrorRef.current = { type: parsed.type, time: now };

          const { title, detail } = getFriendlyErrorCopy(parsed.type, name, parsed.rawMessage);
          toast.warning(title, { description: detail });
        } catch {
          // Ignore malformed messages
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;

        if (cancelled) return;

        if (!hasEverConnected && reconnectAttempts === 0) return;

        if (reconnectAttempts < SSE_MAX_RECONNECT_ATTEMPTS) {
          const delay = SSE_RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
          reconnectAttempts += 1;
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      eventSource?.close();
      eventSource = null;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
    // assistantName is derived from the assistant object which changes with assistantId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantId]);
}
