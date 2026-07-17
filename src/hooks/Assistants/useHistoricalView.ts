import * as React from 'react';
import type {
  ChatMessage,
  CallPill,
  HistoricalViewState,
  ChatSearchResult,
} from '@/types/assistants/chat';
import type { Assistant } from '@/types/assistants/assistant';
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from '@/constants/assistants/settings';
import { mapStoreMessage, resolveAssistantDmThread } from '@/lib/assistants/chatStore';
import { fetchMeetExchangesDirect } from './useContactIdPrefetch';

const WINDOW_SIZE = ASSISTANT_CHAT_LOADED_MESSAGES_COUNT;

interface UseHistoricalViewOptions {
  assistant: Assistant;
  ownerId: string | null;
  assistantId: string | null;
  contactId: number | null;
}

interface UseHistoricalViewReturn {
  historicalView: HistoricalViewState | null;
  isHistoricalMode: boolean;
  navigateToMessage: (result: ChatSearchResult) => void;
  jumpToPresent: () => void;
  loadOlderHistorical: () => void;
  loadNewerHistorical: () => void;
}

function messageAnchorKey(message: Pick<ChatMessage, 'id' | 'messageId'>): string {
  return String(message.messageId ?? message.id);
}

/**
 * Fetch one page of thread messages, oldest first. `beforeId` pages
 * backwards, `afterId` forwards — both against the unified chat store's
 * monotonically increasing message ids.
 */
async function fetchPage(
  threadId: number,
  cursor: { beforeId?: number; afterId?: number },
  limit: number
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  try {
    const params = new URLSearchParams({ limit: String(limit + 1) });
    if (cursor.beforeId !== undefined) params.set('before_id', String(cursor.beforeId));
    if (cursor.afterId !== undefined) params.set('after_id', String(cursor.afterId));

    const response = await fetch(`/api/chat/threads/${threadId}/messages?${params.toString()}`, {
      cache: 'no-store',
    });
    if (!response.ok) return { messages: [], hasMore: false };
    const data = await response.json();
    const rawMessages: Record<string, unknown>[] = Array.isArray(data?.messages)
      ? data.messages
      : [];
    const hasMore = rawMessages.length > limit;
    const window =
      cursor.afterId !== undefined ? rawMessages.slice(0, limit) : rawMessages.slice(-limit);
    const messages = window
      .map((raw) => mapStoreMessage(raw))
      .filter((message): message is ChatMessage => message !== null);
    return { messages, hasMore };
  } catch {
    return { messages: [], hasMore: false };
  }
}

/** Call pills whose timestamps fall within [minTs, maxTs]. */
async function fetchCallPillsForRange(
  assistant: Assistant,
  contactId: number,
  minTs: Date,
  maxTs: Date
): Promise<CallPill[]> {
  const pills = await fetchMeetExchangesDirect(contactId, assistant);
  return pills.filter((pill) => pill.timestamp >= minTs && pill.timestamp <= maxTs);
}

function getTimeRange(messages: ChatMessage[]): { minTs: Date; maxTs: Date } | null {
  if (messages.length === 0) return null;
  let minTs = messages[0].timestamp;
  let maxTs = messages[0].timestamp;
  for (const m of messages) {
    if (m.timestamp < minTs) minTs = m.timestamp;
    if (m.timestamp > maxTs) maxTs = m.timestamp;
  }
  return { minTs, maxTs };
}

export function useHistoricalView({
  assistant,
  ownerId,
  assistantId,
  contactId,
}: UseHistoricalViewOptions): UseHistoricalViewReturn {
  const [historicalView, setHistoricalView] = React.useState<HistoricalViewState | null>(null);

  const navigateToMessage = React.useCallback(
    async (result: ChatSearchResult) => {
      if (!ownerId || !assistantId) return;
      if (result.messageId === undefined) return;

      setHistoricalView({
        anchorMessageKey: messageAnchorKey(result as Pick<ChatMessage, 'id' | 'messageId'>),
        anchorMessageId: result.messageId,
        messages: [],
        callPills: [],
        hasOlder: false,
        hasNewer: false,
        isLoadingOlder: true,
        isLoadingNewer: false,
      });

      try {
        const threadId = await resolveAssistantDmThread(assistantId);
        if (threadId === null) {
          setHistoricalView(null);
          return;
        }
        // Window around the anchor: the anchor itself rides in the "older"
        // page (before_id is exclusive, so +1 includes it).
        const [olderRes, newerRes] = await Promise.all([
          fetchPage(threadId, { beforeId: result.messageId + 1 }, WINDOW_SIZE),
          fetchPage(threadId, { afterId: result.messageId }, WINDOW_SIZE),
        ]);
        const messages = [...olderRes.messages, ...newerRes.messages];

        const range = getTimeRange(messages);
        const callPills =
          range && contactId !== null
            ? await fetchCallPillsForRange(assistant, contactId, range.minTs, range.maxTs)
            : [];

        setHistoricalView({
          anchorMessageKey: messageAnchorKey(result as Pick<ChatMessage, 'id' | 'messageId'>),
          anchorMessageId: result.messageId,
          messages,
          callPills,
          hasOlder: olderRes.hasMore,
          hasNewer: newerRes.hasMore,
          isLoadingOlder: false,
          isLoadingNewer: false,
        });
      } catch {
        setHistoricalView(null);
      }
    },
    [ownerId, assistantId, contactId, assistant]
  );

  const jumpToPresent = React.useCallback(() => {
    setHistoricalView(null);
  }, []);

  const loadOlderHistorical = React.useCallback(async () => {
    if (!ownerId || !assistantId || !historicalView) return;
    if (historicalView.isLoadingOlder || !historicalView.hasOlder) return;

    const oldest = historicalView.messages[0];
    if (!oldest || oldest.messageId === undefined) return;

    setHistoricalView((prev) => prev && { ...prev, isLoadingOlder: true });

    try {
      const threadId = await resolveAssistantDmThread(assistantId);
      if (threadId === null) {
        setHistoricalView((prev) => prev && { ...prev, isLoadingOlder: false });
        return;
      }
      const { messages, hasMore } = await fetchPage(
        threadId,
        { beforeId: oldest.messageId },
        WINDOW_SIZE
      );

      setHistoricalView((prev) => {
        if (!prev) return null;
        const existingIds = new Set(prev.messages.map((m) => m.id));
        const unique = messages.filter((m) => !existingIds.has(m.id));
        return {
          ...prev,
          messages: [...unique, ...prev.messages],
          hasOlder: hasMore,
          isLoadingOlder: false,
        };
      });

      if (messages.length > 0 && contactId !== null) {
        const range = getTimeRange(messages);
        if (range) {
          const pills = await fetchCallPillsForRange(
            assistant,
            contactId,
            range.minTs,
            oldest.timestamp
          );
          if (pills.length > 0) {
            setHistoricalView((prev) => {
              if (!prev) return null;
              const existingPillIds = new Set(prev.callPills.map((p) => p.id));
              const newPills = pills.filter((p) => !existingPillIds.has(p.id));
              return {
                ...prev,
                callPills: [...prev.callPills, ...newPills].sort(
                  (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
                ),
              };
            });
          }
        }
      }
    } catch {
      setHistoricalView((prev) => prev && { ...prev, isLoadingOlder: false });
    }
  }, [ownerId, assistantId, contactId, historicalView, assistant]);

  const loadNewerHistorical = React.useCallback(async () => {
    if (!ownerId || !assistantId || !historicalView) return;
    if (historicalView.isLoadingNewer || !historicalView.hasNewer) return;

    const newest = historicalView.messages[historicalView.messages.length - 1];
    if (!newest || newest.messageId === undefined) return;

    setHistoricalView((prev) => prev && { ...prev, isLoadingNewer: true });

    try {
      const threadId = await resolveAssistantDmThread(assistantId);
      if (threadId === null) {
        setHistoricalView((prev) => prev && { ...prev, isLoadingNewer: false });
        return;
      }
      const { messages, hasMore } = await fetchPage(
        threadId,
        { afterId: newest.messageId },
        WINDOW_SIZE
      );

      setHistoricalView((prev) => {
        if (!prev) return null;
        const existingIds = new Set(prev.messages.map((m) => m.id));
        const unique = messages.filter((m) => !existingIds.has(m.id));
        return {
          ...prev,
          messages: [...prev.messages, ...unique],
          hasNewer: hasMore,
          isLoadingNewer: false,
        };
      });

      if (messages.length > 0 && contactId !== null) {
        const range = getTimeRange(messages);
        if (range) {
          const pills = await fetchCallPillsForRange(
            assistant,
            contactId,
            newest.timestamp,
            range.maxTs
          );
          if (pills.length > 0) {
            setHistoricalView((prev) => {
              if (!prev) return null;
              const existingPillIds = new Set(prev.callPills.map((p) => p.id));
              const newPills = pills.filter((p) => !existingPillIds.has(p.id));
              return {
                ...prev,
                callPills: [...prev.callPills, ...newPills].sort(
                  (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
                ),
              };
            });
          }
        }
      }
    } catch {
      setHistoricalView((prev) => prev && { ...prev, isLoadingNewer: false });
    }
  }, [ownerId, assistantId, contactId, historicalView, assistant]);

  return {
    historicalView,
    isHistoricalMode: historicalView !== null,
    navigateToMessage,
    jumpToPresent,
    loadOlderHistorical,
    loadNewerHistorical,
  };
}
