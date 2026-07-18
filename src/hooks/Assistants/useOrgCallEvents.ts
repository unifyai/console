import * as React from 'react';
import { OrgCallSession, parseOrgCallSession } from '@/types/orgChat';

// Retry forever with capped backoff: giving up permanently would leave the
// session deaf to incoming rings until a reload (e.g. after a transient
// 503 while the per-org topic is provisioned).
const SSE_RECONNECT_BASE_DELAY = 1000;
const SSE_RECONNECT_MAX_DELAY = 60_000;

export interface OrgCallEventHandlers {
  onIncoming: (call: OrgCallSession) => void;
  onAnswered: (call: OrgCallSession) => void;
  onEnded: (call: OrgCallSession) => void;
  onParticipantUpdate: (call: OrgCallSession) => void;
}

function isCallThread(thread: string | undefined): boolean {
  return typeof thread === 'string' && thread.startsWith('call_');
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
        if (!isCallThread(frame.thread)) return;
        const call = parseOrgCallSession(frame.event);
        if (!call.callId) return;
        const action = frame.thread!.replace(/^call_/, '');
        if (action === 'incoming') {
          handlersRef.current.onIncoming(call);
        } else if (action === 'answered') {
          handlersRef.current.onAnswered(call);
        } else if (action === 'ended') {
          handlersRef.current.onEnded(call);
        } else if (action === 'declined') {
          // A decline only tears the call down when it actually ended it
          // (e.g. the sole DM invitee declined). A partial team/group
          // decline leaves the session live for everyone else.
          if (call.status === 'ended') {
            handlersRef.current.onEnded(call);
          } else {
            handlersRef.current.onParticipantUpdate(call);
          }
        } else if (action === 'participant_joined' || action === 'participant_left') {
          handlersRef.current.onParticipantUpdate(call);
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (disposed) return;
        const delay = Math.min(
          SSE_RECONNECT_BASE_DELAY * Math.pow(2, attempts),
          SSE_RECONNECT_MAX_DELAY
        );
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
