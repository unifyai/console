'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { RefreshCw, Users, MessageSquare, BookOpen, Compass, Code, Search, X } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import { useMemoryData } from '@/hooks/Assistants/useMemoryData';
import type { ColumnDef } from '@tanstack/react-table';
import {
  getColumnsForContext,
  buildTranscriptColumns,
  MEMORY_CONTEXT_LABELS,
} from '@/utils/assistants/memory';
import { MemoryTable } from './MemoryTable';
import { MemoryRowDetail } from './MemoryRowDetail';
import type { MemoryContext, MemoryRow } from '@/types/assistants/memory';
import type { Assistant } from '@/types/assistants/assistant';
import {
  DestinationDropdown,
  MEMORY_DESTINATION_ALL,
  memoryDestinationRoot,
  type MemoryDestinationValue,
} from './DestinationDropdown';
import { currentSpaceIds } from '@/lib/assistants/scope';

interface MemoryPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /**
   * Optional externally-controlled sub-tab. When the parent passes this
   * (and updates it), the pane mirrors the value to the underlying hook
   * via effect. The internal sub-tab state still lives in the hook, so
   * footer-tab clicks inside the pane continue to work; this prop adds
   * a *second* input that lets the parent (e.g. the right-pane tab
   * strip's dropdown) drive sub-tab selection too.
   */
  subTab?: MemoryTabContext;
  /**
   * Fires whenever the active sub-tab changes — from footer clicks,
   * external `subTab` updates, or assistant-change resets. Lets the
   * parent's dropdown stay in sync with whichever sub-tab is actually
   * showing in the pane.
   */
  onSubTabChange?: (next: MemoryTabContext) => void;
}

type MemoryTabContext = Exclude<MemoryContext, 'Tasks'>;

const CONTEXT_ICONS: Record<MemoryTabContext, React.ElementType> = {
  Contacts: Users,
  Transcripts: MessageSquare,
  Knowledge: BookOpen,
  Guidance: Compass,
  Functions: Code,
};

const TAB_CLASS = [
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium',
  'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
  'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground',
].join(' ');

export function MemoryPane({
  assistant,
  ownerId,
  assistantId,
  subTab,
  onSubTabChange,
}: MemoryPaneProps) {
  const [destinationValue, setDestinationValue] =
    useState<MemoryDestinationValue>(MEMORY_DESTINATION_ALL);
  const identityKey = `${ownerId}:${assistantId}`;
  const availableSpaceIds = useMemo(() => currentSpaceIds(assistant), [assistant]);
  const effectiveDestinationValue = useMemo((): MemoryDestinationValue => {
    const root = memoryDestinationRoot(destinationValue);
    if (root?.kind === 'space' && !availableSpaceIds.includes(root.spaceId)) {
      return MEMORY_DESTINATION_ALL;
    }
    return destinationValue;
  }, [availableSpaceIds, destinationValue]);
  const selectedRoot = useMemo(
    () => memoryDestinationRoot(effectiveDestinationValue),
    [effectiveDestinationValue]
  );
  const {
    contacts,
    transcripts,
    knowledge,
    guidance,
    functions,
    isLoading,
    isLoadingMore,
    error,
    activeContext,
    setActiveContext,
    sort,
    search,
    clearSearch,
    loadMore,
    refetch,
  } = useMemoryData({ assistant, ownerId, assistantId, root: selectedRoot });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDestinationValue(MEMORY_DESTINATION_ALL);
  }, [identityKey]);

  useEffect(() => {
    if (effectiveDestinationValue !== destinationValue) {
      setDestinationValue(effectiveDestinationValue);
    }
  }, [destinationValue, effectiveDestinationValue]);

  useEffect(() => {
    setSelectedRow(null);
  }, [activeContext, effectiveDestinationValue]);
  // Parent -> hook: mirror any externally-controlled sub-tab into the hook state.
  useEffect(() => {
    if (subTab !== undefined) {
      setActiveContext(subTab);
    }
  }, [subTab, setActiveContext]);

  // Hook -> parent: keep the right-pane dropdown aligned with active sub-tab.
  useEffect(() => {
    onSubTabChange?.(activeContext);
  }, [activeContext, onSubTabChange]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleSearchSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const val = searchValue.trim();
        if (val) {
          search(val);
        } else {
          clearSearch();
        }
      }
    },
    [searchValue, search, clearSearch]
  );

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    clearSearch();
    inputRef.current?.focus();
  }, [clearSearch]);

  const contactMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of contacts.rows) {
      const name = [c.firstName, c.surname].filter(Boolean).join(' ');
      if (name) map.set(c.contactId, name);
    }
    return map;
  }, [contacts.rows]);
  const assistantContactIds = useMemo(() => {
    const roots = assistant.contactIdentityRoots ?? [];
    return new Set<number>([
      assistant.selfContactId,
      ...roots.map((identity) => identity.selfContactId),
    ]);
  }, [assistant.contactIdentityRoots, assistant.selfContactId]);
  const assistantDisplayName = useMemo(() => {
    const fullName = [assistant.firstName, assistant.surname].filter(Boolean).join(' ').trim();
    return fullName || assistant.firstName;
  }, [assistant.firstName, assistant.surname]);

  const activeState = useMemo(() => {
    switch (activeContext) {
      case 'Contacts':
        return contacts;
      case 'Transcripts':
        return transcripts;
      case 'Knowledge':
        return knowledge;
      case 'Guidance':
        return guidance;
      case 'Functions':
        return functions;
    }
  }, [activeContext, contacts, transcripts, knowledge, guidance, functions]);

  useEffect(() => {
    setSearchValue(activeState.searchQuery);
  }, [activeContext, activeState.searchQuery]);

  const allColumns = useMemo(() => {
    if (activeContext === 'Transcripts') {
      return buildTranscriptColumns(contactMap);
    }
    return getColumnsForContext(activeContext, activeState.fields);
  }, [activeContext, activeState.fields, contactMap]);

  const columns = useMemo(() => {
    if (activeState.rows.length === 0) return allColumns;
    return allColumns.filter((col) => {
      const key = (col as any).accessorKey as string | undefined;
      if (!key) return true;
      return activeState.rows.some((row) => {
        const val = (row as Record<string, unknown>)[key];
        return val !== null && val !== undefined && val !== '';
      });
    });
  }, [allColumns, activeState.rows]);

  const counts: Record<MemoryTabContext, number> = {
    Contacts: contacts.count,
    Transcripts: transcripts.count,
    Knowledge: knowledge.count,
    Guidance: guidance.count,
    Functions: functions.count,
  };

  const isFiltered = !!activeState.filterExpr;
  const detailTitle = `${MEMORY_CONTEXT_LABELS[activeContext]} Detail`;
  const emptyMessage = isFiltered
    ? 'No results match your search.'
    : `No ${(MEMORY_CONTEXT_LABELS[activeContext] ?? activeContext).toLowerCase()} found.`;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <span className="text-body-muted text-sm">{error}</span>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="memory-pane">
      {/* Header — search, destination drill-in, refresh */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        data-testid="memory-header"
      >
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            className="h-7 w-full rounded-md border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchSubmit}
            data-testid="memory-search"
          />
          {isFiltered && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              onClick={handleClearSearch}
              data-testid="memory-search-clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        <DestinationDropdown
          assistant={assistant}
          value={effectiveDestinationValue}
          onValueChange={setDestinationValue}
        />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleRefresh}
          disabled={isRefreshing}
          data-testid="memory-refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Body — table */}
      <div className="min-h-0 flex-1" data-testid="memory-body">
        <MemoryTable<MemoryRow>
          data={activeState.rows}
          columns={columns as ColumnDef<MemoryRow, any>[]}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          hasMore={activeState.hasMore}
          emptyMessage={emptyMessage}
          onRowClick={(row) => setSelectedRow(row as Record<string, unknown>)}
          onSort={sort}
          onLoadMore={loadMore}
          serverSorting={activeState.sorting}
          testId={`memory-table-${activeContext.toLowerCase()}`}
        />
      </div>

      {/* Footer — sub-tabs (left) + row count (right). h-10 aligns this bar
          with the assistant-list toggle and the chat input / other tab footers. */}
      <div
        className="flex h-10 shrink-0 items-center justify-between border-t px-2"
        data-testid="memory-footer"
      >
        <div className="flex items-center gap-1 overflow-x-auto" data-testid="memory-sub-tabs">
          {(Object.keys(MEMORY_CONTEXT_LABELS) as MemoryTabContext[]).map((ctx) => {
            const Icon = CONTEXT_ICONS[ctx];
            return (
              <button
                key={ctx}
                className={TAB_CLASS}
                data-active={activeContext === ctx}
                data-testid={`memory-tab-${ctx.toLowerCase()}`}
                onClick={() => setActiveContext(ctx)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{MEMORY_CONTEXT_LABELS[ctx]}</span>
                <span className="tabular-nums opacity-60 sm:hidden">
                  {counts[ctx] > 0 ? counts[ctx] : ''}
                </span>
              </button>
            );
          })}
        </div>

        {activeState.rows.length > 0 && (
          <span
            className="text-caption hidden shrink-0 px-3 py-1.5 sm:inline"
            data-testid="memory-table-footer"
          >
            {activeState.rows.length} of {activeState.count}{' '}
            {activeState.count === 1 ? 'row' : 'rows'}
            {activeState.hasMore && ' · scroll for more'}
          </span>
        )}
      </div>

      <MemoryRowDetail
        row={selectedRow}
        context={activeContext}
        title={detailTitle}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
