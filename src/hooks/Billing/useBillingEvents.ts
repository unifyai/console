/**
 * Hook for receiving billing lifecycle events via SSE.
 *
 * Opens a single SSE connection to the billing events stream. When a
 * `credits_exhausted` or `credits_restored` event arrives, it optimistically
 * updates the billing status cache and invalidates the React Query key,
 * triggering an immediate refetch that updates the banner,
 * BillableActionGuard, and all other consumers of `useBillingStatus`.
 *
 * Features:
 * - Optimistic cache update from event payload for instant UI response
 * - Auto-reconnect with exponential backoff (up to 5 attempts)
 * - Deduplication: ignores repeated events of the same type within 10 s
 * - Every tab and org member gets its own independent subscription (fan-out)
 */

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  BILLING_STATUS_QUERY_KEY,
  type BillingStatusData,
} from '@/hooks/Billing/useBillingStatus';

const SSE_MAX_RECONNECT_ATTEMPTS = 5;
const SSE_RECONNECT_BASE_DELAY = 2_000;
const DEDUP_WINDOW_MS = 10_000;

type BillingEventType = 'credits_exhausted' | 'credits_restored';

export function useBillingEvents(): void {
  const queryClient = useQueryClient();
  const lastEventRef = React.useRef<{ type: string; time: number } | null>(
    null
  );

  React.useEffect(() => {
    let reconnectAttempts = 0;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let eventSource: EventSource | null = null;
    let cancelled = false;
    let hasEverConnected = false;

    const connect = () => {
      if (cancelled) return;

      eventSource = new EventSource('/api/billing/events/stream');

      eventSource.onopen = () => {
        reconnectAttempts = 0;
        hasEverConnected = true;
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const eventType = payload.event_type as BillingEventType | undefined;

          if (
            eventType !== 'credits_exhausted' &&
            eventType !== 'credits_restored'
          ) {
            return;
          }

          const now = Date.now();
          if (
            lastEventRef.current &&
            lastEventRef.current.type === eventType &&
            now - lastEventRef.current.time < DEDUP_WINDOW_MS
          ) {
            return;
          }
          lastEventRef.current = { type: eventType, time: now };

          const eventBalance =
            typeof payload.balance === 'number'
              ? payload.balance
              : eventType === 'credits_exhausted'
                ? -1
                : 1;

          queryClient.setQueryData<BillingStatusData>(
            BILLING_STATUS_QUERY_KEY,
            (old) => ({
              hasBillingHistory: old?.hasBillingHistory ?? false,
              credits: eventBalance,
              hasCredits: eventBalance > 0,
              accountStatus: old?.accountStatus ?? 'ACTIVE',
            })
          );

          queryClient.invalidateQueries({
            queryKey: BILLING_STATUS_QUERY_KEY,
          });
        } catch {
          // Ignore malformed messages
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;

        if (cancelled) return;

        // If we never connected (e.g. 404 because topic doesn't exist),
        // don't retry — fall back to normal polling.
        if (!hasEverConnected && reconnectAttempts === 0) return;

        if (reconnectAttempts < SSE_MAX_RECONNECT_ATTEMPTS) {
          const delay =
            SSE_RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
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
  }, [queryClient]);
}
