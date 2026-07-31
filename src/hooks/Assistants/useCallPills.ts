import * as React from 'react';
import { CallPill, CallTranscriptUtterance } from '@/types/assistants/chat';
import { Assistant } from '@/types/assistants/assistant';
import type { ExchangeRow } from '@/types/assistants/brain';
import { fetchRowsAcrossRoots } from '@/lib/assistants/federatedRows';
import { roots } from '@/lib/assistants/scope';
import { callTargetsByCallId, isChatFrom, type CallTarget } from '@/utils/assistants/callRecording';
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

/**
 * Resolve every call's exchange -- its recording and its transcript thread --
 * from the same exchange metadata the transcripts pane reads.
 *
 * Fetched on demand rather than on mount: a chat thread usually has no open
 * transcript, and this is the only consumer. Results are memoised for the
 * lifetime of the hook so opening several pills costs one read.
 */
async function fetchCallTargets(assistant: Assistant): Promise<Map<string, CallTarget>> {
  const exchanges = await fetchRowsAcrossRoots<ExchangeRow>({
    scopedRoots: roots(assistant),
    ownerId: assistant.userId,
    assistantId: assistant.agentId,
    table: 'Exchanges',
    limit: 200,
    sortField: 'exchange_id',
  });
  return callTargetsByCallId(exchanges);
}

async function fetchCallTranscriptDirect(
  assistant: Assistant,
  callId: string
): Promise<CallTranscriptUtterance[]> {
  try {
    const params = new URLSearchParams({ assistantId: assistant.agentId });
    const response = await fetch(
      `/api/calls/${encodeURIComponent(callId)}/utterances?${params.toString()}`,
      { cache: 'no-store' }
    );
    if (!response.ok) return [];
    const data = await response.json();
    const utterances = Array.isArray(data?.utterances) ? data.utterances : [];
    return utterances
      .map((raw: Record<string, unknown>): CallTranscriptUtterance | null => {
        const content = typeof raw.content === 'string' ? raw.content : null;
        if (content === null) return null;
        const spokenAt = raw.spoken_at ? new Date(raw.spoken_at as string) : new Date();
        const metadata = (raw.metadata ?? {}) as Record<string, unknown>;
        return {
          id: String(raw.id),
          role: raw.speaker_assistant_id != null ? 'assistant' : 'user',
          content,
          timestamp: spokenAt,
          callUtteranceTimestamp:
            (metadata.call_utterance_timestamp as string | undefined) ??
            (metadata.callUtteranceTimestamp as string | undefined),
          // The calls API is not camelised (unlike the logs proxy), so the
          // stored key arrives as-is; the camel form is accepted in case that
          // ever changes.
          speechStartedAt:
            (metadata.speech_started_at as string | undefined) ??
            (metadata.speechStartedAt as string | undefined),
          isChat: isChatFrom(metadata),
        };
      })
      .filter((u: CallTranscriptUtterance | null): u is CallTranscriptUtterance => u !== null);
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
  // In-flight or resolved call-target index, shared across pills of one assistant.
  const targetsRef = React.useRef<Promise<Map<string, CallTarget>> | null>(null);
  React.useEffect(() => {
    targetsRef.current = null;
  }, [assistantId]);

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
      if (!assistant) return;

      setActiveTranscriptPill(pill);
      setTranscriptDialogOpen(true);
      setActiveTranscriptLoading(true);

      try {
        let resolvedCallId = pill.callId;

        if (resolvedCallId === undefined) {
          const calls = await fetchMeetExchangesDirect(contactId ?? 0, assistant);
          if (calls.length === 0) {
            setActiveTranscript([]);
            return;
          }
          const latest = calls[calls.length - 1];
          resolvedCallId = latest.callId;

          if (resolvedCallId !== undefined && assistantId && setCallPillHistories) {
            setCallPillHistories((prev) => ({
              ...prev,
              [assistantId]: (prev[assistantId] || []).map((p) =>
                p.id === pill.id ? { ...p, callId: resolvedCallId } : p
              ),
            }));
          }
        }

        if (resolvedCallId !== undefined) {
          const [utterances, targets] = await Promise.all([
            fetchCallTranscriptDirect(assistant, resolvedCallId),
            targetsRef.current ?? (targetsRef.current = fetchCallTargets(assistant)),
          ]);
          setActiveTranscript(utterances);
          const target = targets.get(resolvedCallId);
          setActiveTranscriptPill((current) =>
            current === null
              ? current
              : {
                  ...current,
                  callId: resolvedCallId,
                  recordingUrl: target?.recording?.url,
                  recordingStartedAtMs: target?.recording?.startedAtMs ?? null,
                  exchangeId: target?.exchangeId ?? null,
                  rootKey: target?.rootKey,
                }
          );
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
