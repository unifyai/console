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
import { readAcrossRoots } from '@/lib/client/read_across_roots';
import {
  meetExchangeFilter,
  roleFromSenderId,
  rootContext,
  transcriptFilter,
} from '@/lib/assistants/scope';

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

async function fetchMessagesAround(
  assistant: Assistant,
  contactId: number,
  targetMessageId: number
): Promise<{ messages: ChatMessage[]; hasOlder: boolean; hasNewer: boolean }> {
  const filterBase = transcriptFilter(assistant, contactId);

  const [olderRes, newerRes] = await Promise.all([
    fetchPage(assistant, filterBase, `message_id <= ${targetMessageId}`, WINDOW_SIZE, 'descending'),
    fetchPage(assistant, filterBase, `message_id > ${targetMessageId}`, WINDOW_SIZE, 'ascending'),
  ]);

  const combined = [...olderRes.messages, ...newerRes.messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const deduped = Array.from(new Map(combined.map((m) => [m.id, m])).values());

  return {
    messages: deduped,
    hasOlder: olderRes.messages.length >= WINDOW_SIZE,
    hasNewer: newerRes.messages.length >= WINDOW_SIZE,
  };
}

async function fetchPage(
  assistant: Assistant,
  baseFilter: string,
  rangeFilter: string,
  limit: number,
  direction: 'ascending' | 'descending'
): Promise<{ messages: ChatMessage[] }> {
  const filterExpr = `${baseFilter} and ${rangeFilter}`;

  try {
    const logs = await readAcrossRoots<Record<string, any>>(assistant, async (root) => {
      const params = new URLSearchParams({
        projectName: 'Assistants',
        context: rootContext(root, assistant.userId, assistant.agentId, 'Transcripts'),
        limit: String(limit),
        filterExpr,
        sorting: sortingParam(direction),
      });

      const response = await fetch(`/api/logs?${params.toString()}`, {
        cache: 'no-store',
      });

      if (response.status === 404 || !response.ok) return [];

      const data = await response.json();
      const rootLogs = data?.logs;
      return Array.isArray(rootLogs) ? rootLogs : [];
    });

    const messages = logs
      .map((log: Record<string, any>): ChatMessage | null => {
        const { entries, id } = log;
        if (!entries || typeof entries.content !== 'string') return null;
        return {
          id: String(id),
          role: roleFromSenderId(assistant, entries.senderId as number),
          content: entries.content,
          timestamp: new Date(entries.timestamp as string),
          messageId: typeof entries.messageId === 'number' ? entries.messageId : undefined,
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

    return { messages };
  } catch {
    return { messages: [] };
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
  const baseFilter = meetExchangeFilter(assistant, contactId);
  const filterExpr = [
    baseFilter,
    `timestamp >= "${minTs.toISOString()}"`,
    `timestamp <= "${maxTs.toISOString()}"`,
  ].join(' and ');

  try {
    const logs = await readAcrossRoots<Record<string, any>>(assistant, async (root) => {
      const params = new URLSearchParams({
        projectName: 'Assistants',
        context: rootContext(root, assistant.userId, assistant.agentId, 'Transcripts'),
        limit: '500',
        filterExpr,
      });

      const response = await fetch(`/api/logs?${params.toString()}`, {
        cache: 'no-store',
      });
      if (response.status === 404 || !response.ok) return [];

      const data = await response.json();
      const rootLogs = data?.logs;
      return Array.isArray(rootLogs) ? rootLogs : [];
    });

    if (!Array.isArray(logs) || logs.length === 0) return [];

    const exchangeGroups = new Map<number, { minTs: Date; maxTs: Date }>();
    for (const log of logs) {
      const entries = log.entries;
      if (!entries) continue;
      const xid = typeof entries.exchangeId === 'number' ? entries.exchangeId : undefined;
      if (xid === undefined) continue;
      const ts = new Date(entries.timestamp as string);
      if (isNaN(ts.getTime())) continue;

      const existing = exchangeGroups.get(xid);
      if (existing) {
        if (ts < existing.minTs) existing.minTs = ts;
        if (ts > existing.maxTs) existing.maxTs = ts;
      } else {
        exchangeGroups.set(xid, { minTs: ts, maxTs: ts });
      }
    }

    return Array.from(exchangeGroups.entries())
      .map(([exchangeId, group]) => {
        const durationSeconds = Math.round((group.maxTs.getTime() - group.minTs.getTime()) / 1000);
        return {
          id: `call-pill-hist-${exchangeId}`,
          type: 'call_pill' as const,
          timestamp: group.maxTs,
          durationSeconds: Math.max(durationSeconds, 0),
          exchangeId,
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
      if (!ownerId || !assistantId || contactId === null || !result.messageId) return;

      setHistoricalView({
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
          result.messageId
        );

        const range = getTimeRange(messages);
        const callPills = range
          ? await fetchCallPillsForRange(assistant, contactId, range.minTs, range.maxTs)
          : [];

        setHistoricalView({
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
    if (!oldest?.messageId) return;

    setHistoricalView((prev) => prev && { ...prev, isLoadingOlder: true });

    try {
      const filterBase = transcriptFilter(assistant, contactId);
      const { messages } = await fetchPage(
        assistant,
        filterBase,
        `message_id < ${oldest.messageId}`,
        WINDOW_SIZE,
        'descending'
      );

      setHistoricalView((prev) => {
        if (!prev) return null;
        const existingIds = new Set(prev.messages.map((m) => m.id));
        const unique = messages.filter((m) => !existingIds.has(m.id));
        const merged = [...unique, ...prev.messages].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        return {
          ...prev,
          messages: merged,
          hasOlder: messages.length >= WINDOW_SIZE,
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
    if (!newest?.messageId) return;

    setHistoricalView((prev) => prev && { ...prev, isLoadingNewer: true });

    try {
      const filterBase = transcriptFilter(assistant, contactId);
      const { messages } = await fetchPage(
        assistant,
        filterBase,
        `message_id > ${newest.messageId}`,
        WINDOW_SIZE,
        'ascending'
      );

      setHistoricalView((prev) => {
        if (!prev) return null;
        const existingIds = new Set(prev.messages.map((m) => m.id));
        const unique = messages.filter((m) => !existingIds.has(m.id));
        const merged = [...prev.messages, ...unique].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        return {
          ...prev,
          messages: merged,
          hasNewer: messages.length >= WINDOW_SIZE,
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
