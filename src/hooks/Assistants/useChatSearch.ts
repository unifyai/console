import * as React from 'react';
import type {
  ChatSearchFilters,
  ChatSearchResult,
  ChatSearchMedium,
  ChatSearchSender,
  AttachmentType,
  Attachment,
} from '@/types/assistants/chat';

const SEARCH_PAGE_SIZE = 30;

interface UseChatSearchOptions {
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

function buildFilterExpr(filters: ChatSearchFilters, contactId: number): string {
  const clauses: string[] = [];

  // Medium filter
  if (filters.medium === 'chat') {
    clauses.push('medium == "unify_message"');
  } else if (filters.medium === 'call') {
    clauses.push('medium == "unify_meet"');
  } else {
    clauses.push('(medium == "unify_message" or medium == "unify_meet")');
  }

  // Sender filter
  if (filters.sender === 'assistant') {
    clauses.push('sender_id == 0');
  } else if (filters.sender === 'me') {
    clauses.push(`sender_id == ${contactId}`);
  } else {
    clauses.push(`(sender_id == ${contactId} or sender_id == 0)`);
  }

  // Receiver scoping — only show messages relevant to this contact
  clauses.push(
    `(${contactId} in receiver_ids or receiver_ids == [0] or sender_id == ${contactId})`
  );

  // Content search (case-insensitive via .lower() on both sides)
  if (filters.query.trim()) {
    const escaped = filters.query.trim().toLowerCase().replace(/"/g, '\\"');
    clauses.push(`"${escaped}" in content.lower()`);
  }

  // Attachment presence — narrow server-side to messages that have attachments;
  // the specific type match is still applied client-side.
  if (filters.attachmentType) {
    clauses.push('attachments != None');
  }

  // Date range
  if (filters.startDate) {
    clauses.push(`timestamp >= "${filters.startDate.toISOString()}"`);
  }
  if (filters.endDate) {
    const endOfDay = new Date(filters.endDate);
    endOfDay.setHours(23, 59, 59, 999);
    clauses.push(`timestamp <= "${endOfDay.toISOString()}"`);
  }

  return clauses.join(' and ');
}

async function executeSearch(
  ownerId: string,
  assistantId: string,
  filterExpr: string,
  limit: number,
  offset: number
): Promise<ChatSearchResult[]> {
  const params = new URLSearchParams({
    projectName: 'Assistants',
    context: `${ownerId}/${assistantId}/Transcripts`,
    limit: String(limit),
    offset: String(offset),
    filterExpr,
    sorting: JSON.stringify({ timestamp: 'descending' }),
  });

  const response = await fetch(`/api/logs?${params.toString()}`, {
    cache: 'no-store',
  });

  if (response.status === 404 || !response.ok) return [];

  const data = await response.json();
  const logs = data?.logs;
  if (!Array.isArray(logs) || logs.length === 0) return [];

  return logs
    .map((log: Record<string, any>): ChatSearchResult | null => {
      const { entries, id } = log;
      if (!entries || typeof entries.content !== 'string') return null;
      return {
        id: String(id),
        role: entries.senderId === 0 ? 'assistant' : 'user',
        content: entries.content,
        timestamp: new Date(entries.timestamp as string),
        messageId: typeof entries.messageId === 'number' ? entries.messageId : undefined,
        medium: (entries.medium as string) || 'unify_message',
        exchangeId: typeof entries.exchangeId === 'number' ? entries.exchangeId : undefined,
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
          : undefined,
      };
    })
    .filter((r: ChatSearchResult | null): r is ChatSearchResult => r !== null);
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
  const filterExprRef = React.useRef('');
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
      const expr = buildFilterExpr(snap, contactId);
      filterExprRef.current = expr;

      let collected: ChatSearchResult[] = [];
      let serverOffset = 0;
      let serverExhausted = false;
      const MAX_FETCHES = 10;

      for (
        let i = 0;
        i < MAX_FETCHES && collected.length < SEARCH_PAGE_SIZE && !serverExhausted;
        i++
      ) {
        let page = await executeSearch(ownerId, assistantId, expr, SEARCH_PAGE_SIZE, serverOffset);
        serverOffset += SEARCH_PAGE_SIZE;
        if (page.length < SEARCH_PAGE_SIZE) serverExhausted = true;

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
  }, [ownerId, assistantId, contactId]);

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
        let page = await executeSearch(
          ownerId,
          assistantId,
          filterExprRef.current,
          SEARCH_PAGE_SIZE,
          serverOffset
        );
        serverOffset += SEARCH_PAGE_SIZE;
        if (page.length < SEARCH_PAGE_SIZE) serverExhausted = true;

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
  }, [ownerId, assistantId, contactId, isSearching, hasMore, offset]);

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
