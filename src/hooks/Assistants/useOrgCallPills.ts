import * as React from 'react';
import { CallPill } from '@/types/assistants/chat';
import { OrgThreadCall, parseOrgThreadCall } from '@/types/orgChat';

export type OrgCallPillScope = 'dm' | 'team' | 'group';

interface UseOrgCallPillsOptions {
  orgId: string | null;
  scope: OrgCallPillScope;
  /** Peer user id (dm) or numeric team/group id (as string). */
  scopeId: string | null;
  /**
   * True while a call for *this* thread is connected. The hook refetches when
   * this flips back to false so a just-ended call surfaces its pill.
   */
  isCallActive?: boolean;
  enabled?: boolean;
}

// Shared frozen sentinel — a fresh `[]` every render breaks the timeline memo.
const EMPTY_CALL_PILLS: readonly CallPill[] = Object.freeze([]);

function callsPath(orgId: string, scope: OrgCallPillScope, scopeId: string): string {
  const base = `/api/organizations/${encodeURIComponent(orgId)}`;
  switch (scope) {
    case 'dm':
      return `${base}/dms/${encodeURIComponent(scopeId)}/calls`;
    case 'team':
      return `${base}/teams/${encodeURIComponent(scopeId)}/calls`;
    case 'group':
      return `${base}/groups/${encodeURIComponent(scopeId)}/calls`;
  }
}

function toCallPill(call: OrgThreadCall): CallPill {
  const stamp = call.endedAt ?? call.startedAt;
  return {
    id: `org-call-${call.callId}`,
    type: 'call_pill',
    timestamp: stamp ? new Date(stamp) : new Date(),
    durationSeconds: Math.max(call.durationSeconds, 0),
    callId: call.callId,
    missed: call.missed,
  };
}

/**
 * Session-derived call pills for one human chat thread (DM / team / group).
 * Duration-only: no transcript is fetched, so the pills render as static
 * markers. Refetches on mount, when the target thread changes, and each time a
 * call for this thread ends.
 */
export function useOrgCallPills({
  orgId,
  scope,
  scopeId,
  isCallActive = false,
  enabled = true,
}: UseOrgCallPillsOptions): CallPill[] {
  const [pills, setPills] = React.useState<CallPill[]>(EMPTY_CALL_PILLS as CallPill[]);
  const prevCallActiveRef = React.useRef(isCallActive);

  const refetch = React.useCallback(async () => {
    if (!enabled || !orgId || !scopeId) {
      setPills(EMPTY_CALL_PILLS as CallPill[]);
      return;
    }
    try {
      const response = await fetch(callsPath(orgId, scope, scopeId), { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const calls = Array.isArray(data?.calls) ? data.calls : [];
      const parsed = calls.map((raw: Record<string, unknown>) =>
        toCallPill(parseOrgThreadCall(raw))
      );
      setPills(parsed.length ? parsed : (EMPTY_CALL_PILLS as CallPill[]));
    } catch {
      // Leave the last known pills in place on transient failure.
    }
  }, [enabled, orgId, scope, scopeId]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  React.useEffect(() => {
    const wasActive = prevCallActiveRef.current;
    if (wasActive && !isCallActive) {
      void refetch();
    }
    prevCallActiveRef.current = isCallActive;
  }, [isCallActive, refetch]);

  return pills;
}
