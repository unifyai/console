import * as React from 'react';
import { OrgCallSession, parseOrgCallSession } from '@/types/orgChat';

const SSE_MAX_RECONNECT_ATTEMPTS = 5;
const SSE_RECONNECT_BASE_DELAY = 1000;

export interface OrgCallEventHandlers {
  onIncoming: (call: OrgCallSession) => void;
  onAnswered: (call: OrgCallSession) => void;
  onEnded: (call: OrgCallSession) => void;
  onParticipantUpdate: (call: OrgCallSession) => void;
}

function isOrgCallThread(thread: string | undefined): boolean {
  return (
    typeof thread === 'string' && (thread.startsWith('org_call_') || thread.startsWith('dm_call_'))
  );
}

/**
 * App-level SSE stream for org call signaling (ring/answer/end/participant
 * frames). Runs on its own named Pub/Sub channel so it never competes with the
 * page-level chat stream for deliveries — each Pub/Sub subscription hands a
 * message to exactly one consumer.
 */
export function useOrgCallEvents(orgId: string | null, handlers: OrgCallEventHandlers) {
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  React.useEffect(() => {
    if (!orgId) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      eventSource = new EventSource(
        `/api/org-chat/events?orgId=${encodeURIComponent(orgId)}&channel=calls`
      );

      eventSource.onopen = () => {
        attempts = 0;
      };

      eventSource.onmessage = (event) => {
        let frame: { thread?: string; event?: Record<string, unknown> };
        try {
          frame = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!frame.event || typeof frame.event !== 'object') return;
        if (!isOrgCallThread(frame.thread)) return;
        const call = parseOrgCallSession(frame.event);
        if (!call.callId) return;
        const action = frame.thread!.replace(/^(org_call_|dm_call_)/, '');
        if (action === 'incoming') {
          handlersRef.current.onIncoming(call);
        } else if (action === 'answered') {
          handlersRef.current.onAnswered(call);
        } else if (action === 'ended' || action === 'declined') {
          handlersRef.current.onEnded(call);
        } else if (action === 'participant_joined' || action === 'participant_left') {
          handlersRef.current.onParticipantUpdate(call);
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (disposed || attempts >= SSE_MAX_RECONNECT_ATTEMPTS) return;
        const delay = SSE_RECONNECT_BASE_DELAY * Math.pow(2, attempts);
        attempts += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [orgId]);
}
