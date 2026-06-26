'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  RefreshCw,
  Search,
  X,
  Compass,
  BookText,
  Link2,
  Plus,
  ListFilter,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import { cn } from '@/lib/utils';
import { useBrainData } from '@/hooks/Assistants/useBrainData';
import { formatTimestamp } from '@/utils/assistants/brain';
import { SkeletonText } from '@/components/Common/Loaders/Skeletons';
import { Skeleton } from '@/components/UI/skeleton';
import { AssistantMarkdown } from '../Common/AssistantMarkdown';
import { DocAddDrawer } from './DocAddDrawer';
import type { DocLibraryKind } from './docLibraryKind';
import type { GuidanceRow, KnowledgeRow } from '@/types/assistants/brain';
import type { Assistant } from '@/types/assistants/assistant';

interface DocLibraryDoc {
  id: string;
  title: string;
  body: string;
  isBuiltin: boolean;
  functionIds: number[];
  tags: string[];
  scope: string | null;
  updated: string | null;
}

interface DocLibraryPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Which library this pane renders. Defaults to guidance. */
  kind?: DocLibraryKind;
}

const KIND_META: Record<
  DocLibraryKind,
  {
    icon: typeof Compass;
    searchPlaceholder: string;
    addLabel: string;
    emptyMatch: string;
    readerEmpty: string;
    footerSingular: string;
    footerPlural: string;
  }
> = {
  guidance: {
    icon: Compass,
    searchPlaceholder: 'Search guidance…',
    addLabel: 'Add guidance',
    emptyMatch: 'No guidance matches these filters.',
    readerEmpty: 'Select a playbook to read it.',
    footerSingular: 'playbook',
    footerPlural: 'playbooks',
  },
  knowledge: {
    icon: BookText,
    searchPlaceholder: 'Search knowledge…',
    addLabel: 'Add knowledge',
    emptyMatch: 'No knowledge matches these filters.',
    readerEmpty: 'Select an entry to read it.',
    footerSingular: 'entry',
    footerPlural: 'entries',
  },
};

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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readScope(raw: Record<string, unknown>): string | null {
  const value = raw.scope;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readUpdated(raw: Record<string, unknown>): string | null {
  const value = readField(raw, 'updated_at', 'updatedAt') ?? raw.updated;
  return typeof value === 'string' && value.trim().length > 0 ? formatTimestamp(value) : null;
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
    tags: asStringArray(raw.tags),
    scope: readScope(raw),
    updated: readUpdated(raw),
  };
}

function mapKnowledgeRow(row: KnowledgeRow, index: number): DocLibraryDoc {
  const raw = row as Record<string, unknown>;
  const idValue = readField(raw, 'knowledge_id', 'knowledgeId');
  const title =
    (typeof raw.title === 'string' && raw.title.trim() && raw.title) ||
    (typeof raw.rule === 'string' && raw.rule.trim() && raw.rule) ||
    'Untitled';
  const id =
    idValue !== undefined && idValue !== null && idValue !== -1 ? String(idValue) : `k-${index}`;
  const body =
    (typeof raw.body === 'string' && raw.body) ||
    (typeof raw.details === 'string' && raw.details) ||
    '';
  return {
    id,
    title,
    body,
    isBuiltin: readField(raw, 'is_builtin', 'isBuiltin') === true,
    functionIds: asNumberArray(readField(raw, 'function_ids', 'functionIds')),
    tags: asStringArray(raw.tags),
    scope: readScope(raw),
    updated: readUpdated(raw),
  };
}

export function DocLibraryPane({
  assistant,
  ownerId,
  assistantId,
  kind = 'guidance',
}: DocLibraryPaneProps) {
  const context = kind === 'knowledge' ? 'Knowledge' : 'Guidance';
  const { guidance, knowledge, isLoading, error, refetch } = useBrainData({
    assistant,
    ownerId,
    assistantId,
    contexts: kind === 'knowledge' ? (['Knowledge'] as const) : (['Guidance'] as const),
    initialContext: context,
  });

  const meta = KIND_META[kind];
  const LibraryIcon = meta.icon;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  const docs = useMemo(() => {
    if (kind === 'knowledge') return knowledge.rows.map(mapKnowledgeRow);
    return guidance.rows.map(mapGuidanceRow);
  }, [kind, knowledge.rows, guidance.rows]);

  const allScopes = useMemo(() => {
    const set = new Set<string>();
    docs.forEach((doc) => doc.scope && set.add(doc.scope));
    return Array.from(set).sort();
  }, [docs]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    docs.forEach((doc) => doc.tags.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [docs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((doc) => {
      if (q && !(doc.title + ' ' + doc.body).toLowerCase().includes(q)) return false;
      if (selectedScopes.size > 0 && !(doc.scope && selectedScopes.has(doc.scope))) return false;
      if (selectedTags.size > 0 && !Array.from(selectedTags).every((t) => doc.tags.includes(t)))
        return false;
      return true;
    });
  }, [docs, query, selectedScopes, selectedTags]);

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

  const toggleSetValue = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      });
    },
    []
  );

  const filterCount = selectedScopes.size + selectedTags.size;

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
    <div className="flex h-full flex-col" data-testid="doc-library-pane" data-kind={kind}>
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2" data-testid="doc-header">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="h-7 w-full rounded-md border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder={meta.searchPlaceholder}
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

        {(allScopes.length > 0 || allTags.length > 0) && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5"
                data-testid="doc-filter-trigger"
              >
                <ListFilter className="h-3.5 w-3.5" />
                Filter
                {filterCount > 0 && (
                  <span className="bg-primary/15 ml-0.5 rounded-full px-1.5 text-[10px] font-semibold text-primary">
                    {filterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              {allScopes.length > 0 && (
                <div className="mb-2">
                  <div className="px-1 pb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    Scope
                  </div>
                  {allScopes.map((scope) => (
                    <FilterOption
                      key={scope}
                      label={scope}
                      checked={selectedScopes.has(scope)}
                      onToggle={() => toggleSetValue(setSelectedScopes, scope)}
                    />
                  ))}
                </div>
              )}
              {allTags.length > 0 && (
                <div>
                  <div className="px-1 pb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    Tags
                  </div>
                  {allTags.map((tag) => (
                    <FilterOption
                      key={tag}
                      label={tag}
                      checked={selectedTags.has(tag)}
                      onToggle={() => toggleSetValue(setSelectedTags, tag)}
                    />
                  ))}
                </div>
              )}
              {filterCount > 0 && (
                <button
                  className="text-caption mt-2 w-full rounded-md border px-2 py-1 hover:text-foreground"
                  onClick={() => {
                    setSelectedScopes(new Set());
                    setSelectedTags(new Set());
                  }}
                  data-testid="doc-filter-clear"
                >
                  Clear filters
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}

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

        <Button
          size="sm"
          className="h-7 shrink-0"
          onClick={() => setIsAdding(true)}
          data-testid="doc-add"
        >
          <Plus className="h-3.5 w-3.5" />
          {meta.addLabel}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* List */}
        <div className="w-72 shrink-0 border-r" data-testid="doc-list">
          {isLoading && docs.length === 0 ? (
            <div className="flex flex-col gap-1.5 p-2" data-testid="doc-list-skeleton">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-caption p-3">{meta.emptyMatch}</div>
          ) : (
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-0.5 p-2">
                {filtered.map((doc) => (
                  <button
                    key={doc.id}
                    className={cn(
                      'flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                      active?.id === doc.id
                        ? 'bg-accent-soft text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    onClick={() => setSelectedId(doc.id)}
                    data-testid={`doc-item-${doc.id}`}
                  >
                    <LibraryIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'text-title block truncate',
                          kind === 'knowledge' && 'font-mono font-medium'
                        )}
                      >
                        {doc.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {doc.scope && (
                          <span className="rounded-full bg-[color:var(--status-info-bg)] px-1.5 py-0.5 text-[9.5px] font-semibold text-[color:var(--status-info)]">
                            {doc.scope}
                          </span>
                        )}
                        {doc.isBuiltin && (
                          <span className="text-[9.5px] uppercase tracking-wide text-muted-foreground">
                            built-in
                          </span>
                        )}
                        {doc.updated && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {doc.updated}
                          </span>
                        )}
                      </span>
                    </span>
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
              <div className="max-w-[680px] px-7 py-5">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {active.scope && (
                    <span className="rounded-full bg-[color:var(--status-info-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[color:var(--status-info)]">
                      {active.scope}
                    </span>
                  )}
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
                  {active.updated && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      Updated {active.updated}
                    </span>
                  )}
                  <div className="ml-auto">
                    <CopyButton
                      content={active.body}
                      tooltipContent={`Copy ${kind}`}
                      className="h-6 w-6"
                    />
                  </div>
                </div>
                <h2
                  className={cn(
                    'text-h2 mb-3 text-foreground',
                    kind === 'knowledge' && 'font-mono'
                  )}
                >
                  {active.title}
                </h2>
                {active.tags.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    {active.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-medium text-accent-soft-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="break-words">
                  <AssistantMarkdown>{active.body || '_No content._'}</AssistantMarkdown>
                </div>
              </div>
            </ScrollArea>
          ) : isLoading && docs.length === 0 ? (
            <div className="max-w-[680px] px-7 py-5" data-testid="doc-reader-skeleton">
              <Skeleton className="mb-4 h-7 w-1/2" />
              <SkeletonText lines={6} />
            </div>
          ) : (
            <div className="text-body-muted flex h-full items-center justify-center">
              {meta.readerEmpty}
            </div>
          )}
        </div>
      </div>

      <div
        className="flex h-10 shrink-0 items-center justify-end border-t px-2"
        data-testid="doc-footer"
      >
        <span className="text-caption hidden shrink-0 px-3 py-1.5 sm:inline">
          {filtered.length} of {docs.length}{' '}
          {docs.length === 1 ? meta.footerSingular : meta.footerPlural}
        </span>
      </div>

      <DocAddDrawer
        open={isAdding}
        kind={kind}
        onClose={() => setIsAdding(false)}
        onSave={() =>
          toast(`Saving ${kind} isn’t available from this view yet.`, {
            description: `Ask your digital twin in chat to add ${kind}.`,
          })
        }
      />
    </div>
  );
}

interface FilterOptionProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

function FilterOption({ label, checked, onToggle }: FilterOptionProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs capitalize transition-colors hover:bg-muted"
    >
      <span className="truncate">{label}</span>
      {checked && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
    </button>
  );
}
