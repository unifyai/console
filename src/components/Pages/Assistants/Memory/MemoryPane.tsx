'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Loader2, RefreshCw, Users, MessageSquare, BookOpen, ListTodo } from 'lucide-react';
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

interface MemoryPaneProps {
  ownerId: string;
  assistantId: string;
}

const CONTEXT_ICONS: Record<MemoryContext, React.ElementType> = {
  Contacts: Users,
  Transcripts: MessageSquare,
  Knowledge: BookOpen,
  Tasks: ListTodo,
};

const SUB_TAB_CLASS = [
  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
  'text-muted-foreground transition-colors hover:text-foreground',
  'data-[active=true]:bg-muted data-[active=true]:text-foreground',
].join(' ');

export function MemoryPane({ ownerId, assistantId }: MemoryPaneProps) {
  const {
    contacts,
    transcripts,
    knowledge,
    tasks,
    isLoading,
    isLoadingMore,
    error,
    activeContext,
    setActiveContext,
    sort,
    loadMore,
    refetch,
  } = useMemoryData({ ownerId, assistantId });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const activeState = useMemo(() => {
    switch (activeContext) {
      case 'Contacts':
        return contacts;
      case 'Transcripts':
        return transcripts;
      case 'Knowledge':
        return knowledge;
      case 'Tasks':
        return tasks;
    }
  }, [activeContext, contacts, transcripts, knowledge, tasks]);

  const contactMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of contacts.rows) {
      const name = [c.firstName, c.surname].filter(Boolean).join(' ');
      if (name) map.set(c.contactId, name);
    }
    return map;
  }, [contacts.rows]);

  const columns = useMemo(() => {
    if (activeContext === 'Transcripts') return buildTranscriptColumns(contactMap);
    return getColumnsForContext(activeContext, activeState.fields);
  }, [activeContext, activeState.fields, contactMap]);

  const counts: Record<MemoryContext, number> = {
    Contacts: contacts.count,
    Transcripts: transcripts.count,
    Knowledge: knowledge.count,
    Tasks: tasks.count,
  };

  if (isLoading && !contacts.rows.length && !transcripts.rows.length) {
    return (
      <div
        className="flex h-full flex-1 items-center justify-center text-muted-foreground"
        data-testid="memory-loading"
      >
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-body-muted">Loading memory…</span>
      </div>
    );
  }

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
      {/* Header — sub-tabs + refresh */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-3 py-1.5"
        data-testid="memory-header"
      >
        <div className="flex items-center gap-1" data-testid="memory-sub-tabs">
          {(Object.keys(MEMORY_CONTEXT_LABELS) as MemoryContext[]).map((ctx) => {
            const Icon = CONTEXT_ICONS[ctx];
            return (
              <button
                key={ctx}
                className={SUB_TAB_CLASS}
                data-active={activeContext === ctx}
                data-testid={`memory-tab-${ctx.toLowerCase()}`}
                onClick={() => setActiveContext(ctx)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{MEMORY_CONTEXT_LABELS[ctx]}</span>
                {counts[ctx] > 0 && (
                  <span className="tabular-nums text-muted-foreground">({counts[ctx]})</span>
                )}
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
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
          totalCount={activeState.count}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          hasMore={activeState.hasMore}
          emptyMessage={`No ${MEMORY_CONTEXT_LABELS[activeContext].toLowerCase()} found.`}
          onRowClick={(row) => setSelectedRow(row as Record<string, unknown>)}
          onSort={sort}
          onLoadMore={loadMore}
          serverSorting={activeState.sorting}
          testId={`memory-table-${activeContext.toLowerCase()}`}
        />
      </div>

      <MemoryRowDetail
        row={selectedRow}
        context={activeContext}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
