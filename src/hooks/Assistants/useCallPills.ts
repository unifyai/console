import * as React from 'react';
import { CallPill, CallTranscriptUtterance } from '@/types/assistants/chat';
import { Assistant } from '@/types/assistants/assistant';
import { fetchMeetExchangesDirect } from './useContactIdPrefetch';

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
  ownerId: string,
  assistantId: string,
  exchangeId: number
): Promise<CallTranscriptUtterance[]> {
  try {
    const filterExpr = `medium == "unify_meet" and exchange_id == ${exchangeId}`;
    const params = new URLSearchParams({
      projectName: 'Assistants',
      context: `${ownerId}/${assistantId}/Transcripts`,
      limit: '1000',
      filterExpr,
    });

    const response = await fetch(`/api/logs?${params.toString()}`, {
      cache: 'no-store',
    });

    if (response.status === 404 || !response.ok) return [];

    const data = await response.json();
    const logs = data?.logs;
    if (!Array.isArray(logs) || logs.length === 0) return [];

    return logs
      .map((log: Record<string, any>): CallTranscriptUtterance | null => {
        const { entries, id } = log;
        if (!entries || typeof entries.content !== 'string') return null;
        return {
          id: String(id),
          role: entries.senderId === 0 ? 'assistant' : 'user',
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

        if (resolvedExchangeId === undefined) {
          const exchanges = await fetchMeetExchangesDirect(
            contactId,
            assistant.userId,
            assistant.agentId
          );
          if (exchanges.length === 0) {
            setActiveTranscript([]);
            return;
          }
          const latest = exchanges[exchanges.length - 1];
          resolvedExchangeId = latest.exchangeId;

          if (resolvedExchangeId !== undefined && assistantId && setCallPillHistories) {
            setCallPillHistories((prev) => ({
              ...prev,
              [assistantId]: (prev[assistantId] || []).map((p) =>
                p.id === pill.id ? { ...p, exchangeId: resolvedExchangeId } : p
              ),
            }));
          }
        }

        if (resolvedExchangeId !== undefined) {
          const utterances = await fetchCallTranscriptDirect(
            assistant.userId,
            assistant.agentId,
            resolvedExchangeId
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
