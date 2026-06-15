import * as React from 'react';
import type {
  ChatMessage,
  CallPill,
  HistoricalViewState,
  ChatSearchResult,
  Attachment,
} from '@/types/assistants/chat';
import type { Assistant } from '@/types/assistants/assistant';
import { ASSISTANT_CHAT_LOADED_MESSAGES_COUNT } from '@/constants/assistants/settings';
import { mergeRootRows } from '@/lib/client/read_across_roots';
import {
  contactScopedRootQueries,
  meetExchangeFilterForRoot,
  roleFromRootSenderId,
  transcriptFilterForRoot,
} from '@/lib/assistants/scope';
import { transcriptMergeDedupeKey } from '@/lib/assistants/transcriptDedupe';

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

function sortingParam(direction: 'ascending' | 'descending'): string {
  return JSON.stringify({ timestamp: direction });
}

function messageAnchorKey(
  message: Pick<ChatMessage, 'id' | 'messageId' | 'sourceContext'>
): string {
  return `${message.sourceContext ?? ''}:${message.messageId ?? message.id}`;
}

function boundaryMessageKeys(messages: ChatMessage[], boundary: Date): Set<string> {
  const boundaryMs = boundary.getTime();
  return new Set(
    messages
      .filter((message) => message.timestamp.getTime() === boundaryMs)
      .map((message) => message.mergeKey ?? messageAnchorKey(message))
  );
}

async function fetchMessagesAround(
  assistant: Assistant,
  contactId: number,
  targetTimestamp: Date
): Promise<{ messages: ChatMessage[]; hasOlder: boolean; hasNewer: boolean }> {
  const anchor = targetTimestamp.toISOString();
  const [olderRes, newerRes] = await Promise.all([
    fetchPage(assistant, contactId, `timestamp <= "${anchor}"`, WINDOW_SIZE, 'descending'),
    fetchPage(assistant, contactId, `timestamp > "${anchor}"`, WINDOW_SIZE, 'ascending'),
  ]);

  const combined = [...olderRes.messages, ...newerRes.messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const deduped = Array.from(new Map(combined.map((m) => [m.mergeKey ?? m.id, m])).values());

  return {
    messages: deduped,
    hasOlder: olderRes.hasMore,
    hasNewer: newerRes.hasMore,
  };
}

async function fetchPage(
  assistant: Assistant,
  contactId: number,
  rangeFilter: string,
  limit: number,
  direction: 'ascending' | 'descending',
  excludedKeys: Set<string> = new Set()
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  try {
    const queries = contactScopedRootQueries(assistant, contactId, 'Transcripts');
    const rootLimit = limit + excludedKeys.size + 1;
    const rootLogs = await Promise.all(
      queries.map(async (query) => {
        const filterExpr = `${transcriptFilterForRoot(query, assistant.agentId)} and ${rangeFilter}`;
        const params = new URLSearchParams({
          projectName: 'Assistants',
          context: query.context,
          limit: String(rootLimit),
          filterExpr,
          sorting: sortingParam(direction),
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
    const logs = mergeRootRows(rootLogs.flat(), {
      limit: rootLimit,
      direction,
      sortValue: ({ log }) => log.entries?.timestamp,
      dedupeKey: ({ log }) => transcriptMergeDedupeKey(log.entries, log.id),
    });

    const visibleLogs = logs.filter(({ log, query }) => {
      const contextKey = `${query.context}:${log.entries?.messageId ?? log.id}`;
      if (excludedKeys.has(contextKey)) return false;
      const mergeKey = transcriptMergeDedupeKey(log.entries, log.id);
      if (excludedKeys.has(mergeKey)) return false;
      return true;
    });

    const messages = visibleLogs
      .slice(0, limit)
      .map(({ log, query }): ChatMessage | null => {
        const { entries, id } = log;
        if (!entries || typeof entries.content !== 'string') return null;
        return {
          id: String(id),
          role: roleFromRootSenderId(query, entries.senderId as number),
          content: entries.content,
          timestamp: new Date(entries.timestamp as string),
          messageId: typeof entries.messageId === 'number' ? entries.messageId : undefined,
          sourceContext: query.context,
          mergeKey: transcriptMergeDedupeKey(entries, id),
          attachments: Array.isArray(entries.attachments)
            ? (entries.attachments as Record<string, unknown>[]).map(
                (a): Attachment => ({
                  id: (a.id as string) || String(id),
                  filename: (a.filename as string) || 'attachment',
                  gsUrl: a.gsUrl as string | undefined,
                  contentType: a.contentType as string | undefined,
                  sizeBytes: a.sizeBytes as number | undefined,
                })
              )
            : [],
        };
      })
      .filter((msg: ChatMessage | null): msg is ChatMessage => msg !== null);

    return { messages, hasMore: visibleLogs.length > limit };
  } catch {
    return { messages: [], hasMore: false };
  }
}

/**
 * Fetch unify_meet utterances whose timestamps fall within [minTs, maxTs],
 * group by exchange_id, and return CallPill objects.
 */
async function fetchCallPillsForRange(
  assistant: Assistant,
  contactId: number,
  minTs: Date,
  maxTs: Date
): Promise<CallPill[]> {
  try {
    const queries = contactScopedRootQueries(assistant, contactId, 'Transcripts');
    const rootLogs = await Promise.all(
      queries.map(async (query) => {
        const filterExpr = [
          meetExchangeFilterForRoot(query, assistant.agentId),
          `timestamp >= "${minTs.toISOString()}"`,
          `timestamp <= "${maxTs.toISOString()}"`,
        ].join(' and ');
        const params = new URLSearchParams({
          projectName: 'Assistants',
          context: query.context,
          limit: '500',
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

    const exchangeGroups = new Map<
      string,
      { exchangeId: number; sourceContext: string; selfContactId: number; minTs: Date; maxTs: Date }
    >();
    for (const { log, query } of logs) {
      const entries = log.entries;
      if (!entries) continue;
      const xid = typeof entries.exchangeId === 'number' ? entries.exchangeId : undefined;
      if (xid === undefined) continue;
      const ts = new Date(entries.timestamp as string);
      if (isNaN(ts.getTime())) continue;

      const groupKey = `${query.context}:${xid}`;
      const existing = exchangeGroups.get(groupKey);
      if (existing) {
        if (ts < existing.minTs) existing.minTs = ts;
        if (ts > existing.maxTs) existing.maxTs = ts;
      } else {
        exchangeGroups.set(groupKey, {
          exchangeId: xid,
          sourceContext: query.context,
          selfContactId: query.selfContactId,
          minTs: ts,
          maxTs: ts,
        });
      }
    }

    return Array.from(exchangeGroups.values())
      .map((group) => {
        const durationSeconds = Math.round((group.maxTs.getTime() - group.minTs.getTime()) / 1000);
        return {
          id: `call-pill-hist-${group.sourceContext}-${group.exchangeId}`,
          type: 'call_pill' as const,
          timestamp: group.maxTs,
          durationSeconds: Math.max(durationSeconds, 0),
          exchangeId: group.exchangeId,
          sourceContext: group.sourceContext,
          selfContactId: group.selfContactId,
        };
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  } catch {
    return [];
  }
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
      if (!ownerId || !assistantId || contactId === null) return;

      setHistoricalView({
        anchorMessageKey: messageAnchorKey(result),
        anchorMessageId: result.messageId,
        messages: [],
        callPills: [],
        hasOlder: false,
        hasNewer: false,
        isLoadingOlder: true,
        isLoadingNewer: false,
      });

      try {
        const { messages, hasOlder, hasNewer } = await fetchMessagesAround(
          assistant,
          contactId,
          result.timestamp
        );

        const range = getTimeRange(messages);
        const callPills = range
          ? await fetchCallPillsForRange(assistant, contactId, range.minTs, range.maxTs)
          : [];

        setHistoricalView({
          anchorMessageKey: messageAnchorKey(result),
          anchorMessageId: result.messageId,
          messages,
          callPills,
          hasOlder,
          hasNewer,
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
    if (!ownerId || !assistantId || contactId === null || !historicalView) return;
    if (historicalView.isLoadingOlder || !historicalView.hasOlder) return;

    const oldest = historicalView.messages[0];
    if (!oldest) return;

    setHistoricalView((prev) => prev && { ...prev, isLoadingOlder: true });

    try {
      const { messages, hasMore } = await fetchPage(
        assistant,
        contactId,
        `timestamp <= "${oldest.timestamp.toISOString()}"`,
        WINDOW_SIZE,
        'descending',
        boundaryMessageKeys(historicalView.messages, oldest.timestamp)
      );

      setHistoricalView((prev) => {
        if (!prev) return null;
        const existingIds = new Set(prev.messages.map((m) => m.mergeKey ?? m.id));
        const unique = messages.filter((m) => !existingIds.has(m.mergeKey ?? m.id));
        const merged = [...unique, ...prev.messages].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        return {
          ...prev,
          messages: merged,
          hasOlder: hasMore,
          isLoadingOlder: false,
        };
      });

      // Fetch call pills for newly expanded range
      if (messages.length > 0) {
        const newOldest = messages.reduce((a, b) => (a.timestamp < b.timestamp ? a : b));
        const existingOldest = oldest.timestamp;
        const pills = await fetchCallPillsForRange(
          assistant,
          contactId,
          newOldest.timestamp,
          existingOldest
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
    } catch {
      setHistoricalView((prev) => prev && { ...prev, isLoadingOlder: false });
    }
  }, [ownerId, assistantId, contactId, historicalView, assistant]);

  const loadNewerHistorical = React.useCallback(async () => {
    if (!ownerId || !assistantId || contactId === null || !historicalView) return;
    if (historicalView.isLoadingNewer || !historicalView.hasNewer) return;

    const newest = historicalView.messages[historicalView.messages.length - 1];
    if (!newest) return;

    setHistoricalView((prev) => prev && { ...prev, isLoadingNewer: true });

    try {
      const { messages, hasMore } = await fetchPage(
        assistant,
        contactId,
        `timestamp >= "${newest.timestamp.toISOString()}"`,
        WINDOW_SIZE,
        'ascending',
        boundaryMessageKeys(historicalView.messages, newest.timestamp)
      );

      setHistoricalView((prev) => {
        if (!prev) return null;
        const existingIds = new Set(prev.messages.map((m) => m.mergeKey ?? m.id));
        const unique = messages.filter((m) => !existingIds.has(m.mergeKey ?? m.id));
        const merged = [...prev.messages, ...unique].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        return {
          ...prev,
          messages: merged,
          hasNewer: hasMore,
          isLoadingNewer: false,
        };
      });

      // Fetch call pills for newly expanded range
      if (messages.length > 0) {
        const newNewest = messages.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
        const existingNewest = newest.timestamp;
        const pills = await fetchCallPillsForRange(
          assistant,
          contactId,
          existingNewest,
          newNewest.timestamp
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
