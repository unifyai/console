import * as React from 'react';
import { CallPill, CallTranscriptUtterance } from '@/types/assistants/chat';
import { Assistant } from '@/types/assistants/assistant';
import { fetchMeetExchangesDirect } from './useContactIdPrefetch';
import {
  contactIdentityForRoot,
  roleFromRootSenderId,
  rootContext,
  roots,
} from '@/lib/assistants/scope';

interface UseCallPillsOptions {
  assistant: Assistant | null;
  contactId: number | null;
  isCallConnected: boolean;
  callPillHistories?: Record<string, CallPill[]>;
  setCallPillHistories?: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
}

interface UseCallPillsReturn {
  callPills: CallPill[];
  transcriptDialogOpen: boolean;
  activeTranscript: CallTranscriptUtterance[];
  activeTranscriptLoading: boolean;
  activeTranscriptPill: CallPill | null;
  openTranscript: (pill: CallPill) => void;
  closeTranscript: () => void;
}

// Module-level frozen empty array reused as the "no call pills" sentinel.
// `((... || [])` allocates a fresh empty array on every render, breaking
// downstream `useMemo` dependencies (e.g. the timeline memo in the chat
// panel) and forcing pointless recomputation on every keystroke.
const EMPTY_CALL_PILLS: readonly CallPill[] = Object.freeze([]);

async function fetchCallTranscriptDirect(
  assistant: Assistant,
  exchangeId: number,
  sourceContext?: string,
  selfContactId?: number
): Promise<CallTranscriptUtterance[]> {
  try {
    const filterExpr = `medium == "unify_meet" and exchange_id == ${exchangeId}`;
    const queries = sourceContext
      ? [{ context: sourceContext, selfContactId: selfContactId ?? assistant.selfContactId }]
      : roots(assistant).flatMap((root) => {
          const identity = contactIdentityForRoot(assistant, root);
          if (!identity) return [];
          return [
            {
              context: rootContext(root, assistant.userId, assistant.agentId, 'Transcripts'),
              selfContactId: identity.selfContactId,
            },
          ];
        });
    const rootLogs = await Promise.all(
      queries.map(async (query) => {
        const params = new URLSearchParams({
          projectName: 'Assistants',
          context: query.context,
          limit: '1000',
          filterExpr,
        });

        const response = await fetch(`/api/logs?${params.toString()}`, {
          cache: 'no-store',
        });

        if (response.status === 404 || !response.ok) return [];

        const data = await response.json();
        const rootLogs = data?.logs;
        return Array.isArray(rootLogs) ? rootLogs.map((log) => ({ log, query })) : [];
      })
    );
    const logs = rootLogs.flat();
    if (!Array.isArray(logs) || logs.length === 0) return [];

    return logs
      .map(({ log, query }): CallTranscriptUtterance | null => {
        const { entries, id } = log;
        if (!entries || typeof entries.content !== 'string') return null;
        return {
          id: String(id),
          role: roleFromRootSenderId(query, entries.senderId as number),
          content: entries.content,
          timestamp: new Date(entries.timestamp as string),
          callUtteranceTimestamp: entries.metadata?.callUtteranceTimestamp as string | undefined,
        };
      })
      .filter((u: CallTranscriptUtterance | null): u is CallTranscriptUtterance => u !== null)
      .reverse();
  } catch {
    return [];
  }
}

export function useCallPills({
  assistant,
  contactId,
  isCallConnected,
  callPillHistories,
  setCallPillHistories,
}: UseCallPillsOptions): UseCallPillsReturn {
  const [transcriptDialogOpen, setTranscriptDialogOpen] = React.useState(false);
  const [activeTranscript, setActiveTranscript] = React.useState<CallTranscriptUtterance[]>([]);
  const [activeTranscriptLoading, setActiveTranscriptLoading] = React.useState(false);
  const [activeTranscriptPill, setActiveTranscriptPill] = React.useState<CallPill | null>(null);

  const assistantId = assistant?.agentId;
  const callPills: CallPill[] =
    (assistantId && callPillHistories?.[assistantId]) || (EMPTY_CALL_PILLS as CallPill[]);

  const callStartTimeRef = React.useRef<Date | null>(null);
  const prevIsConnectedRef = React.useRef(false);

  React.useEffect(() => {
    const wasConnected = prevIsConnectedRef.current;

    if (isCallConnected && !wasConnected) {
      callStartTimeRef.current = new Date();
    }

    if (
      !isCallConnected &&
      wasConnected &&
      callStartTimeRef.current &&
      assistantId &&
      setCallPillHistories
    ) {
      const endTime = new Date();
      const durationSeconds = Math.round(
        (endTime.getTime() - callStartTimeRef.current.getTime()) / 1000
      );

      const newPill: CallPill = {
        id: `call-pill-live-${Date.now()}`,
        type: 'call_pill',
        timestamp: endTime,
        durationSeconds: Math.max(durationSeconds, 0),
      };

      setCallPillHistories((prev) => ({
        ...prev,
        [assistantId]: [...(prev[assistantId] || []), newPill],
      }));
      callStartTimeRef.current = null;
    }

    prevIsConnectedRef.current = isCallConnected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCallConnected]);

  const openTranscript = React.useCallback(
    async (pill: CallPill) => {
      if (!assistant || contactId === null) return;

      setActiveTranscriptPill(pill);
      setTranscriptDialogOpen(true);
      setActiveTranscriptLoading(true);

      try {
        let resolvedExchangeId = pill.exchangeId;
        let resolvedSourceContext = pill.sourceContext;
        let resolvedSelfContactId = pill.selfContactId;

        if (resolvedExchangeId === undefined) {
          const exchanges = await fetchMeetExchangesDirect(contactId, assistant);
          if (exchanges.length === 0) {
            setActiveTranscript([]);
            return;
          }
          const latest = exchanges[exchanges.length - 1];
          resolvedExchangeId = latest.exchangeId;
          resolvedSourceContext = latest.sourceContext;
          resolvedSelfContactId = latest.selfContactId;

          if (resolvedExchangeId !== undefined && assistantId && setCallPillHistories) {
            setCallPillHistories((prev) => ({
              ...prev,
              [assistantId]: (prev[assistantId] || []).map((p) =>
                p.id === pill.id
                  ? {
                      ...p,
                      exchangeId: resolvedExchangeId,
                      sourceContext: resolvedSourceContext,
                      selfContactId: resolvedSelfContactId,
                    }
                  : p
              ),
            }));
          }
        }

        if (resolvedExchangeId !== undefined) {
          const utterances = await fetchCallTranscriptDirect(
            assistant,
            resolvedExchangeId,
            resolvedSourceContext,
            resolvedSelfContactId
          );
          setActiveTranscript(utterances);
        } else {
          setActiveTranscript([]);
        }
      } finally {
        setActiveTranscriptLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assistant, contactId, assistantId]
  );

  const closeTranscript = React.useCallback(() => {
    setTranscriptDialogOpen(false);
    setActiveTranscript([]);
    setActiveTranscriptPill(null);
  }, []);

  return {
    callPills,
    transcriptDialogOpen,
    activeTranscript,
    activeTranscriptLoading,
    activeTranscriptPill,
    openTranscript,
    closeTranscript,
  };
}
