import * as React from 'react';
import type {
  ChatSearchFilters,
  ChatSearchResult,
  ChatSearchMedium,
  ChatSearchSender,
  AttachmentType,
  Attachment,
} from '@/types/assistants/chat';
import type { Assistant } from '@/types/assistants/assistant';
import { mapStoreAttachments, resolveAssistantDmThread } from '@/lib/assistants/chatStore';

const SEARCH_PAGE_SIZE = 30;

interface UseChatSearchOptions {
  assistant: Assistant;
  ownerId: string | null;
  assistantId: string | null;
  contactId: number | null;
}

interface UseChatSearchReturn {
  filters: ChatSearchFilters;
  setQuery: (q: string) => void;
  setMedium: (m: ChatSearchMedium) => void;
  setSender: (s: ChatSearchSender) => void;
  setAttachmentType: (t: AttachmentType | null) => void;
  setDateRange: (start: Date | null, end: Date | null) => void;
  results: ChatSearchResult[];
  isSearching: boolean;
  hasSearched: boolean;
  hasMore: boolean;
  search: () => void;
  loadMore: () => void;
  reset: () => void;
}

async function searchChatMessages(
  assistant: Assistant,
  filters: ChatSearchFilters,
  limit: number,
  offset: number
): Promise<{ results: ChatSearchResult[]; hasMore: boolean }> {
  const threadId = await resolveAssistantDmThread(assistant.agentId);
  if (threadId === null) return { results: [], hasMore: false };

  const params = new URLSearchParams({ limit: String(limit + 1), offset: String(offset) });
  if (filters.query.trim()) params.set('q', filters.query.trim());
  if (filters.sender === 'assistant') params.set('sender_kind', 'assistant');
  if (filters.sender === 'me') params.set('sender_kind', 'user');
  if (filters.attachmentType) params.set('has_attachments', 'true');
  if (filters.startDate) params.set('after', filters.startDate.toISOString());
  if (filters.endDate) {
    const endOfDay = new Date(filters.endDate);
    endOfDay.setHours(23, 59, 59, 999);
    params.set('before', endOfDay.toISOString());
  }

  const response = await fetch(`/api/chat/threads/${threadId}/search?${params.toString()}`, {
    cache: 'no-store',
  });
  if (!response.ok) return { results: [], hasMore: false };
  const data = await response.json();
  const rawMessages: Record<string, unknown>[] = Array.isArray(data?.messages) ? data.messages : [];

  const results = rawMessages
    .slice(0, limit)
    .map((raw): ChatSearchResult | null => {
      const messageId = Number(raw.id);
      const content = typeof raw.content === 'string' ? raw.content : null;
      if (!Number.isFinite(messageId) || content === null) return null;
      const attachments = mapStoreAttachments(raw.attachments, String(messageId));
      return {
        id: String(messageId),
        role: raw.sender_kind === 'assistant' ? 'assistant' : 'user',
        content,
        timestamp: new Date(raw.timestamp as string),
        messageId,
        medium: 'unify_message',
        attachments: attachments.length > 0 ? (attachments as Attachment[]) : undefined,
      };
    })
    .filter((r: ChatSearchResult | null): r is ChatSearchResult => r !== null);

  return { results, hasMore: rawMessages.length > limit };
}

async function searchCallUtterances(
  assistant: Assistant,
  filters: ChatSearchFilters,
  limit: number,
  offset: number
): Promise<{ results: ChatSearchResult[]; hasMore: boolean }> {
  if (!filters.query.trim()) return { results: [], hasMore: false };
  const params = new URLSearchParams({
    assistantId: assistant.agentId,
    q: filters.query.trim(),
    limit: String(limit + 1),
    offset: String(offset),
  });
  const response = await fetch(`/api/calls/search?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) return { results: [], hasMore: false };
  const data = await response.json();
  const rawUtterances: Record<string, unknown>[] = Array.isArray(data?.utterances)
    ? data.utterances
    : [];

  const results = rawUtterances
    .slice(0, limit)
    .map((raw): ChatSearchResult | null => {
      const content = typeof raw.content === 'string' ? raw.content : null;
      if (content === null) return null;
      const role: 'assistant' | 'user' = raw.speaker_assistant_id != null ? 'assistant' : 'user';
      return {
        id: `utterance-${String(raw.id)}`,
        role,
        content,
        timestamp: new Date(raw.spoken_at as string),
        medium: 'unify_meet',
        callId: typeof raw.call_id === 'string' ? raw.call_id : undefined,
      };
    })
    .filter((r: ChatSearchResult | null): r is ChatSearchResult => r !== null)
    .filter((r) => {
      if (filters.sender === 'assistant') return r.role === 'assistant';
      if (filters.sender === 'me') return r.role === 'user';
      return true;
    })
    .filter((r) => {
      if (filters.startDate && r.timestamp < filters.startDate) return false;
      if (filters.endDate) {
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (r.timestamp > endOfDay) return false;
      }
      return true;
    });

  return { results, hasMore: rawUtterances.length > limit };
}

async function executeSearch(
  assistant: Assistant,
  filters: ChatSearchFilters,
  contactId: number,
  limit: number,
  offset: number
): Promise<{ results: ChatSearchResult[]; hasMore: boolean }> {
  const wantChat = filters.medium !== 'call';
  const wantCalls =
    (filters.medium === 'call' || filters.medium === 'all') && !filters.attachmentType;

  const [chatPage, callPage] = await Promise.all([
    wantChat
      ? searchChatMessages(assistant, filters, limit, offset)
      : Promise.resolve({ results: [] as ChatSearchResult[], hasMore: false }),
    wantCalls
      ? searchCallUtterances(assistant, filters, limit, offset)
      : Promise.resolve({ results: [] as ChatSearchResult[], hasMore: false }),
  ]);

  const combined = [...chatPage.results, ...callPage.results]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);

  return { results: combined, hasMore: chatPage.hasMore || callPage.hasMore };
}

function matchesAttachmentType(
  attachments: Attachment[] | undefined,
  type: AttachmentType
): boolean {
  if (!attachments || attachments.length === 0) return false;

  const typePatterns: Record<AttachmentType, string[]> = {
    pdf: ['application/pdf', '.pdf'],
    word: ['application/msword', 'officedocument.wordprocessing', '.doc', '.docx'],
    excel: ['application/vnd.ms-excel', 'spreadsheetml', '.xls', '.xlsx', '.csv'],
    powerpoint: ['application/vnd.ms-powerpoint', 'presentationml', '.ppt', '.pptx'],
    image: ['image/', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    audio: ['audio/', '.mp3', '.wav', '.ogg', '.m4a'],
    video: ['video/', '.mp4', '.mov', '.avi', '.webm'],
    text: ['text/plain', '.txt', '.md', '.rst'],
    code: ['.py', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.json', '.yaml', '.yml', '.sql'],
    archive: ['application/zip', 'application/x-tar', '.zip', '.tar', '.gz', '.rar', '.7z'],
    generic: [],
  };

  const patterns = typePatterns[type];
  if (!patterns || patterns.length === 0) return true;

  return attachments.some((a) => {
    const ct = a.contentType?.toLowerCase() || '';
    const fn = a.filename?.toLowerCase() || '';
    return patterns.some((p) => ct.includes(p) || fn.endsWith(p));
  });
}

const DEFAULT_FILTERS: ChatSearchFilters = {
  query: '',
  medium: 'all',
  sender: 'everyone',
  attachmentType: null,
  startDate: null,
  endDate: null,
};

export type { UseChatSearchReturn };

export function useChatSearch({
  assistant,
  ownerId,
  assistantId,
  contactId,
}: UseChatSearchOptions): UseChatSearchReturn {
  const [filters, setFilters] = React.useState<ChatSearchFilters>(DEFAULT_FILTERS);
  const [results, setResults] = React.useState<ChatSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [offset, setOffset] = React.useState(0);
  const filtersRef = React.useRef(filters);
  filtersRef.current = filters;

  const search = React.useCallback(async () => {
    const snap = filtersRef.current;
    if (!ownerId || !assistantId || contactId === null) return;
    if (
      !snap.query.trim() &&
      !snap.attachmentType &&
      snap.medium === 'all' &&
      snap.sender === 'everyone' &&
      !snap.startDate &&
      !snap.endDate
    )
      return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      let collected: ChatSearchResult[] = [];
      let serverOffset = 0;
      let serverExhausted = false;
      const MAX_FETCHES = 10;

      for (
        let i = 0;
        i < MAX_FETCHES && collected.length < SEARCH_PAGE_SIZE && !serverExhausted;
        i++
      ) {
        const searchPage = await executeSearch(
          assistant,
          snap,
          contactId,
          SEARCH_PAGE_SIZE,
          serverOffset
        );
        let page = searchPage.results;
        serverOffset += SEARCH_PAGE_SIZE;
        if (!searchPage.hasMore) serverExhausted = true;

        if (snap.attachmentType) {
          page = page.filter((r) => matchesAttachmentType(r.attachments, snap.attachmentType!));
        }
        collected = collected.concat(page);
      }

      setResults(collected);
      setHasMore(!serverExhausted);
      setOffset(serverOffset);
    } catch {
      setResults([]);
      setHasMore(false);
    } finally {
      setIsSearching(false);
    }
  }, [ownerId, assistantId, contactId, assistant]);

  const loadMore = React.useCallback(async () => {
    if (!ownerId || !assistantId || contactId === null || isSearching || !hasMore) return;

    const snap = filtersRef.current;
    setIsSearching(true);
    try {
      let collected: ChatSearchResult[] = [];
      let serverOffset = offset;
      let serverExhausted = false;
      const MAX_FETCHES = 10;

      for (
        let i = 0;
        i < MAX_FETCHES && collected.length < SEARCH_PAGE_SIZE && !serverExhausted;
        i++
      ) {
        const searchPage = await executeSearch(
          assistant,
          snap,
          contactId,
          SEARCH_PAGE_SIZE,
          serverOffset
        );
        let page = searchPage.results;
        serverOffset += SEARCH_PAGE_SIZE;
        if (!searchPage.hasMore) serverExhausted = true;

        if (snap.attachmentType) {
          page = page.filter((r) => matchesAttachmentType(r.attachments, snap.attachmentType!));
        }
        collected = collected.concat(page);
      }

      setResults((prev) => [...prev, ...collected]);
      setHasMore(!serverExhausted);
      setOffset(serverOffset);
    } catch {
      setHasMore(false);
    } finally {
      setIsSearching(false);
    }
  }, [ownerId, assistantId, contactId, isSearching, hasMore, offset, assistant]);

  const reset = React.useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setResults([]);
    setHasSearched(false);
    setHasMore(false);
    setOffset(0);
  }, []);

  const updateFilters = React.useCallback((patch: Partial<ChatSearchFilters>) => {
    setFilters((f) => {
      const next = { ...f, ...patch };
      filtersRef.current = next;
      return next;
    });
  }, []);

  const setQuery = React.useCallback((q: string) => updateFilters({ query: q }), [updateFilters]);
  const setMedium = React.useCallback(
    (m: ChatSearchMedium) => updateFilters({ medium: m }),
    [updateFilters]
  );
  const setSender = React.useCallback(
    (s: ChatSearchSender) => updateFilters({ sender: s }),
    [updateFilters]
  );
  const setAttachmentType = React.useCallback(
    (t: AttachmentType | null) => updateFilters({ attachmentType: t }),
    [updateFilters]
  );
  const setDateRange = React.useCallback(
    (start: Date | null, end: Date | null) => updateFilters({ startDate: start, endDate: end }),
    [updateFilters]
  );

  return {
    filters,
    setQuery,
    setMedium,
    setSender,
    setAttachmentType,
    setDateRange,
    results,
    isSearching,
    hasSearched,
    hasMore,
    search,
    loadMore,
    reset,
  };
}
