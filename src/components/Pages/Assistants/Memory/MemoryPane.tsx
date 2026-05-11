'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
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

type MemoryTabContext = Exclude<MemoryContext, 'Tasks'>;

interface MemoryPaneProps {
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

export function MemoryPane({ ownerId, assistantId, subTab, onSubTabChange }: MemoryPaneProps) {
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
  } = useMemoryData({ ownerId, assistantId });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedRow(null);
  }, [activeContext]);

  // Parent → hook: mirror any externally-controlled `subTab` into the
  // hook's internal state. Intentionally depends *only* on `subTab` —
  // taking `activeContext` as a dep too would refire this effect on
  // footer-tab clicks (before the parent's state catches up via the
  // sibling effect below), regressing the change back to the stale
  // prop and triggering an infinite ping-pong with that effect.
  // `setActiveContext` is `useState`'s setter so it bails out for free
  // when the new value already matches the current state, which makes
  // the unconditional call here safe.
  useEffect(() => {
    if (subTab !== undefined) {
      setActiveContext(subTab);
    }
  }, [subTab, setActiveContext]);

  // Hook → parent: notify on any change to the active sub-tab so the
  // dropdown in the tab strip can reflect footer-tab clicks too. The
  // parent's setter is no-op-on-equal, so the round-trip after a
  // parent-driven update settles in one extra render.
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
    if (activeContext === 'Transcripts') return buildTranscriptColumns(contactMap);
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

  const isFiltered = !!activeState.filterExpr;
  const detailTitle = `${MEMORY_CONTEXT_LABELS[activeContext]} Detail`;
  const emptyMessage = isFiltered
    ? 'No results match your search'
    : `No ${(MEMORY_CONTEXT_LABELS[activeContext] ?? activeContext).toLowerCase()} found`;

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
      {/* Header — search + refresh */}
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

      {/* Footer — row count only. Sub-tab selection lives in the
          right-pane tab strip's dropdown (see RightPaneContainer's
          `MEMORY_SUB_TABS`); the in-pane sub-tab row used to live here
          but was removed once the dropdown became the single source
          of truth for sub-tab navigation. The fixed `h-10` is kept so
          the bar aligns with the assistant-list toggle and chat input
          across other tabs even when the footer is otherwise empty. */}
      {activeState.rows.length > 0 && (
        <div
          className="flex h-10 shrink-0 items-center justify-end border-t px-2"
          data-testid="memory-footer"
        >
          <span
            className="text-caption hidden shrink-0 px-3 py-1.5 sm:inline"
            data-testid="memory-table-footer"
          >
            {activeState.rows.length} of {activeState.count}{' '}
            {activeState.count === 1 ? 'row' : 'rows'}
            {activeState.hasMore && ' · scroll for more'}
          </span>
        </div>
      )}

      <MemoryRowDetail
        row={selectedRow}
        context={activeContext}
        title={detailTitle}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
