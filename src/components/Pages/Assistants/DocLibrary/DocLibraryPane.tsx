'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { RefreshCw, Search, X, Compass, Link2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import { cn } from '@/lib/utils';
import { useBrainData } from '@/hooks/Assistants/useBrainData';
import { SkeletonText } from '@/components/Common/Loaders/Skeletons';
import { Skeleton } from '@/components/UI/skeleton';
import { AssistantMarkdown } from '../Common/AssistantMarkdown';
import type { GuidanceRow } from '@/types/assistants/brain';
import type { Assistant } from '@/types/assistants/assistant';

interface DocLibraryDoc {
  id: string;
  title: string;
  body: string;
  isBuiltin: boolean;
  functionIds: number[];
}

interface DocLibraryPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
}

function readField(row: Record<string, unknown>, snake: string, camel: string): unknown {
  const snakeValue = row[snake];
  if (snakeValue !== undefined && snakeValue !== null) return snakeValue;
  return row[camel];
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'number' ? item : Number(item)))
    .filter((item) => Number.isFinite(item));
}

function mapGuidanceRow(row: GuidanceRow, index: number): DocLibraryDoc {
  const raw = row as Record<string, unknown>;
  const idValue = readField(raw, 'guidance_id', 'guidanceId');
  const id =
    idValue !== undefined && idValue !== null && idValue !== -1 ? String(idValue) : `g-${index}`;
  return {
    id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Untitled',
    body: typeof raw.content === 'string' ? raw.content : '',
    isBuiltin: readField(raw, 'is_builtin', 'isBuiltin') === true,
    functionIds: asNumberArray(readField(raw, 'function_ids', 'functionIds')),
  };
}

export function DocLibraryPane({ assistant, ownerId, assistantId }: DocLibraryPaneProps) {
  const { guidance, isLoading, error, refetch } = useBrainData({
    assistant,
    ownerId,
    assistantId,
    contexts: ['Guidance'] as const,
    initialContext: 'Guidance',
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const docs = useMemo(() => guidance.rows.map(mapGuidanceRow), [guidance.rows]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) => (doc.title + ' ' + doc.body).toLowerCase().includes(q));
  }, [docs, query]);

  const active = useMemo(() => {
    if (filtered.length === 0) return null;
    return filtered.find((doc) => doc.id === selectedId) ?? filtered[0];
  }, [filtered, selectedId]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

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
    <div className="flex h-full flex-col" data-testid="doc-library-pane">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2" data-testid="doc-header">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="h-7 w-full rounded-md border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search guidance…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="doc-search"
          />
          {query && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => setQuery('')}
              data-testid="doc-search-clear"
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
          data-testid="doc-refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* List */}
        <div className="w-64 shrink-0 border-r" data-testid="doc-list">
          {isLoading && docs.length === 0 ? (
            <div className="flex flex-col gap-1.5 p-2" data-testid="doc-list-skeleton">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-caption p-3">No guidance matches.</div>
          ) : (
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-0.5 p-2">
                {filtered.map((doc) => (
                  <button
                    key={doc.id}
                    className={cn(
                      'flex flex-col gap-1 rounded-md px-2.5 py-2 text-left transition-colors',
                      active?.id === doc.id
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    onClick={() => setSelectedId(doc.id)}
                    data-testid={`doc-item-${doc.id}`}
                  >
                    <span className="text-title flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{doc.title}</span>
                    </span>
                    {doc.isBuiltin && (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        built-in
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Reader */}
        <div className="min-w-0 flex-1" data-testid="doc-reader">
          {active ? (
            <ScrollArea className="h-full">
              <div className="mx-auto max-w-3xl px-5 py-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {active.isBuiltin && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      built-in · read-only
                    </span>
                  )}
                  {active.functionIds.length > 0 && (
                    <span className="bg-primary/10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Link2 className="h-3 w-3" />
                      {active.functionIds.length} linked function
                      {active.functionIds.length > 1 ? 's' : ''}
                    </span>
                  )}
                  <div className="ml-auto">
                    <CopyButton
                      content={active.body}
                      tooltipContent="Copy guidance"
                      className="h-6 w-6"
                    />
                  </div>
                </div>
                <h2 className="text-h2 mb-3 text-foreground">{active.title}</h2>
                <AssistantMarkdown>{active.body || '_No content._'}</AssistantMarkdown>
              </div>
            </ScrollArea>
          ) : isLoading && docs.length === 0 ? (
            <div className="mx-auto max-w-3xl px-5 py-4" data-testid="doc-reader-skeleton">
              <Skeleton className="mb-4 h-7 w-1/2" />
              <SkeletonText lines={6} />
            </div>
          ) : (
            <div className="text-body-muted flex h-full items-center justify-center">
              Select a playbook to read it.
            </div>
          )}
        </div>
      </div>

      <div
        className="flex h-10 shrink-0 items-center justify-end border-t px-2"
        data-testid="doc-footer"
      >
        <span className="text-caption hidden shrink-0 px-3 py-1.5 sm:inline">
          {filtered.length} of {docs.length} {docs.length === 1 ? 'playbook' : 'playbooks'}
        </span>
      </div>
    </div>
  );
}
