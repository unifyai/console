'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Compass, Link2 } from 'lucide-react';
// TODO(wire-backend): Plus + toast are only used by the unwired guidance
// "Add" control; restore them with a doc-create endpoint.
// import { Plus } from 'lucide-react';
// import { toast } from 'sonner';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import { cn } from '@/lib/utils';
import { useBrainData } from '@/hooks/Assistants/useBrainData';
import { useFunctionsCatalog } from '@/hooks/Assistants/useFunctionsCatalog';
import { useTabSearchCommit } from '@/hooks/Assistants/useTabSearchCommit';
import { useAppShellNavigation } from '@/lib/navigation/AppShellRouter';
import { formatTimestamp } from '@/utils/assistants/brain';
import { SkeletonText } from '@/components/Common/Loaders/Skeletons';
import { Skeleton } from '@/components/UI/skeleton';
import { AssistantMarkdown } from '../Common/AssistantMarkdown';
import { StaleReasonChips } from '../Common/StaleReasonChips';
import { groupByCalendarDay, TimelineDateSeparator } from '../Common/TimelineDateSeparator';
import { TabToolbar } from '../Common/TabToolbar';
import { useBrainScopeFilter } from '../Common/BrainScopeFilter';
import { BrainScopeDropdown } from '../Common/BrainScopeDropdown';
import { TabFilterDropdown } from '../Common/TabFilterDropdown';
import { TabFooter } from '../Common/TabFooter';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import { SplitPaneLayout } from '../Common/SplitPaneLayout';
import { useMatchesBelow } from '@/hooks/Common/useMobile';
// TODO(wire-backend): restore once guidance creation is wired.
// import { DocAddDrawer } from './DocAddDrawer';
import type { GuidanceRow, StaleReason } from '@/types/assistants/brain';
import { mapStaleReasons } from '@/utils/assistants/staleReasons';
import type { Assistant } from '@/types/assistants/assistant';
import type { ContextRoot } from '@/lib/assistants/scope';

interface DocLibraryDoc {
  id: string;
  title: string;
  body: string;
  isBuiltin: boolean;
  functionIds: number[];
  staleReasons: StaleReason[];
  tags: string[];
  scope: string | null;
  /** ISO timestamp for sorting / date grouping (updated_at ?? created_at). */
  sortTimestamp: string | null;
  updated: string | null;
  created: string | null;
}

interface DocLibraryPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Scope override: a team root reads `Teams/{id}/…` instead of merging the
   *  assistant's readable roots. */
  root?: ContextRoot | null;
  enabled?: boolean;
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readScope(raw: Record<string, unknown>): string | null {
  const value = raw.scope;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readUpdated(raw: Record<string, unknown>): string | null {
  const value =
    readField(raw, 'updated_at', 'updatedAt') ??
    raw.updated ??
    (typeof raw.ts === 'string' ? raw.ts : null);
  return typeof value === 'string' && value.trim().length > 0 ? formatTimestamp(value) : null;
}

function readCreated(raw: Record<string, unknown>): string | null {
  const value =
    readField(raw, 'created_at', 'createdAt') ??
    raw.created ??
    (typeof raw.ts === 'string' ? raw.ts : null);
  return typeof value === 'string' && value.trim().length > 0 ? formatTimestamp(value) : null;
}

function readSortTimestamp(raw: Record<string, unknown>): string | null {
  const value =
    readField(raw, 'updated_at', 'updatedAt') ??
    readField(raw, 'created_at', 'createdAt') ??
    raw.updated ??
    raw.created ??
    (typeof raw.ts === 'string' ? raw.ts : null);
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function stripLeadingTitleFromBody(body: string, title: string): string {
  const lines = body.split('\n');
  const first = lines[0]?.trim() ?? '';
  const normalizedTitle = title.trim().toLowerCase();
  const headingMatch = first.match(/^#+\s*(.+)$/);
  if (headingMatch && headingMatch[1]!.trim().toLowerCase() === normalizedTitle) {
    return lines.slice(1).join('\n').trimStart();
  }
  return body;
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
    staleReasons: mapStaleReasons(readField(raw, 'stale_reasons', 'staleReasons')),
    tags: asStringArray(raw.tags),
    scope: readScope(raw),
    sortTimestamp: readSortTimestamp(raw),
    updated: readUpdated(raw),
    created: readCreated(raw),
  };
}

export function DocLibraryPane({
  assistant,
  ownerId,
  assistantId,
  root = null,
  enabled = true,
}: DocLibraryPaneProps) {
  const scope = useBrainScopeFilter(assistant, { fixedRoot: root });
  const { guidance, hasLoaded, isLoading, error, refetch } = useBrainData({
    assistant,
    ownerId,
    assistantId,
    root: scope.root,
    contexts: ['Guidance'] as const,
    initialContext: 'Guidance',
    enabled,
  });

  const { openBrainFunction } = useAppShellNavigation();

  const { functions: functionEntries } = useFunctionsCatalog({
    assistant,
    kind: 'All',
    root: scope.root,
    enabled,
  });

  const functionNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const fn of functionEntries) {
      if (fn.functionId !== null) {
        map.set(fn.functionId, fn.name);
      }
    }
    return map;
  }, [functionEntries]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    draft: searchDraft,
    setDraft: setSearchDraft,
    committed: searchQuery,
    submit: submitSearch,
    clear: clearSearch,
  } = useTabSearchCommit();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const isStackedLayout = useMatchesBelow('shellCompact');
  // TODO(wire-backend): restore when guidance creation is wired.
  // const [isAdding, setIsAdding] = useState(false);

  const docs = useMemo(() => guidance.rows.map(mapGuidanceRow), [guidance.rows]);

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

  const selectedScopes = useMemo(
    () =>
      new Set(
        Array.from(selectedKeys)
          .filter((k) => k.startsWith('scope:'))
          .map((k) => k.slice('scope:'.length))
      ),
    [selectedKeys]
  );
  const selectedTags = useMemo(
    () =>
      new Set(
        Array.from(selectedKeys)
          .filter((k) => k.startsWith('tag:'))
          .map((k) => k.slice('tag:'.length))
      ),
    [selectedKeys]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return docs.filter((doc) => {
      if (q && !(doc.title + ' ' + doc.body).toLowerCase().includes(q)) return false;
      if (selectedScopes.size > 0 && !(doc.scope && selectedScopes.has(doc.scope))) return false;
      if (selectedTags.size > 0 && !Array.from(selectedTags).every((t) => doc.tags.includes(t)))
        return false;
      return true;
    });
  }, [docs, searchQuery, selectedScopes, selectedTags]);

  const filteredGroups = useMemo(() => groupByCalendarDay(filtered), [filtered]);

  const active = useMemo(() => {
    if (filtered.length === 0) return null;
    const picked = selectedId ? filtered.find((doc) => doc.id === selectedId) : null;
    if (isStackedLayout) return picked;
    return picked ?? filtered[0];
  }, [filtered, selectedId, isStackedLayout]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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
    <div
      className="flex h-full min-w-0 flex-col"
      data-testid="doc-library-pane"
      data-kind="guidance"
    >
      <TabToolbar
        testId="doc-header"
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        onSearchSubmit={submitSearch}
        onSearchClear={clearSearch}
        searchPlaceholder={tabSearchPlaceholder('guidance')}
        searchTestId="doc-search"
        searchClearTestId="doc-search-clear"
        filter={
          <TabFilterDropdown
            groups={[
              { id: 'scope', label: 'Scope', values: allScopes },
              { id: 'tag', label: 'Tags', values: allTags },
            ]}
            selected={selectedKeys}
            onToggle={toggleKey}
            onClear={() => setSelectedKeys(new Set())}
            triggerTestId="doc-filter-trigger"
            clearTestId="doc-filter-clear"
          />
        }
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh"
        refreshTestId="doc-refresh"
        trailing={<BrainScopeDropdown scope={scope} />}
        // TODO(wire-backend): guidance creation is not wired to any
        // backend (DocAddDrawer.onSave only toasts). Restore this addAction +
        // the DocAddDrawer below once a doc-create endpoint exists.
        // addAction={
        //   <Button
        //     size="sm"
        //     className="h-7 shrink-0"
        //     onClick={() => setIsAdding(true)}
        //     data-testid="doc-add"
        //   >
        //     <Plus className="h-3.5 w-3.5" />
        //     Add guidance
        //   </Button>
        // }
      />

      <SplitPaneLayout
        paneId="doc-library-guidance"
        defaultWidth={288}
        mobileMode="stack"
        stackBelow="shellCompact"
        detailOpen={isStackedLayout ? selectedId !== null && active !== null : true}
        onDetailClose={() => setSelectedId(null)}
        mobileBackLabel="Documents"
        mobileBackTestId="doc-library-mobile-back"
        left={
          <div className="flex h-full min-w-0 flex-col" data-testid="doc-list">
            {isLoading && !hasLoaded ? (
              <div className="flex flex-col gap-1.5 p-2" data-testid="doc-list-skeleton">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-caption p-3">No guidance matches these filters.</div>
            ) : (
              <ScrollArea
                className="h-full min-w-0"
                viewportClassName="min-w-0 overflow-x-hidden [&>div]:!block"
              >
                <div className="flex flex-col gap-0.5 p-2">
                  {filteredGroups.map((group) => (
                    <React.Fragment key={group.sortKey}>
                      {group.sortKey === '__undated' ? (
                        <div className="mb-1 mt-2.5 flex items-center gap-2.5 px-1 first:mt-0">
                          <span className="text-overline">Undated</span>
                          <span className="h-px flex-1 bg-border" />
                        </div>
                      ) : (
                        <TimelineDateSeparator
                          timestamp={group.items[0]!.sortTimestamp!}
                          className="px-1"
                        />
                      )}
                      {group.items.map((doc) => (
                        <button
                          key={doc.id}
                          className={cn(
                            'flex w-full min-w-0 items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                            active?.id === doc.id
                              ? 'bg-accent-soft text-accent-soft-foreground'
                              : 'text-ink-2 hover:bg-muted hover:text-foreground'
                          )}
                          onClick={() => setSelectedId(doc.id)}
                          data-testid={`doc-item-${doc.id}`}
                        >
                          <Compass
                            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'text-body-dense block font-semibold leading-snug',
                                isStackedLayout
                                  ? 'line-clamp-2'
                                  : 'break-words [overflow-wrap:anywhere]'
                              )}
                            >
                              {doc.title}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                              {doc.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-medium text-accent-soft-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
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
                              {doc.staleReasons.length > 0 && (
                                <span className="rounded-full bg-[color:var(--status-warning-bg)] px-1.5 py-0.5 text-[9.5px] font-semibold text-[color:var(--status-warning)]">
                                  link debt
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        }
        right={
          <div className="h-full min-w-0" data-testid="doc-reader">
            {isLoading && !hasLoaded ? (
              <div className="w-full px-6 pb-5 pt-3" data-testid="doc-reader-skeleton">
                <Skeleton className="mb-4 h-7 w-1/2" />
                <SkeletonText lines={6} />
              </div>
            ) : active ? (
              <ScrollArea className="h-full min-w-0">
                <div className="w-full min-w-0 px-6 pb-5 pt-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
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
                    {active.updated ? (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Updated {active.updated}
                      </span>
                    ) : active.created ? (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Created {active.created}
                      </span>
                    ) : null}
                    <div className="ml-auto">
                      <CopyButton
                        content={active.body}
                        tooltipContent="Copy guidance"
                        className="h-6 w-6"
                      />
                    </div>
                  </div>
                  {active.staleReasons.length > 0 && (
                    <StaleReasonChips
                      reasons={active.staleReasons}
                      banner
                      className="mb-3"
                      chipTestIdPrefix="guidance-stale-reason"
                    />
                  )}
                  {active.functionIds.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-overline">Linked functions</span>
                      {active.functionIds.map((functionId) => {
                        const name = functionNameById.get(functionId);
                        const label = name ?? `fn #${functionId}`;
                        return (
                          <button
                            key={functionId}
                            type="button"
                            onClick={() => openBrainFunction(functionId)}
                            title={name ? `${name} (${functionId})` : String(functionId)}
                            className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-tint-10 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary-tint-20"
                            data-testid={`guidance-function-chip-${functionId}`}
                          >
                            <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate font-mono">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {active.tags.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-overline">Tags</span>
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
                  <h2 className="text-doc-title mb-3">{active.title}</h2>
                  <div className="break-words">
                    <AssistantMarkdown>
                      {stripLeadingTitleFromBody(active.body || '_No content._', active.title)}
                    </AssistantMarkdown>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="text-body-muted flex h-full items-center justify-center">
                Select a playbook to read it.
              </div>
            )}
          </div>
        }
      />

      <TabFooter
        testId="doc-footer"
        count={filtered.length}
        total={docs.length}
        singular="playbook"
        plural="playbooks"
      />

      {/*
        TODO(wire-backend): guidance creation drawer — onSave only
        toasts; not wired to a backend. Restore once a doc-create endpoint /
        system-event exists.
        <DocAddDrawer
          open={isAdding}
          kind="guidance"
          onClose={() => setIsAdding(false)}
          onSave={() =>
            toast(`Saving guidance isn’t available from this view yet.`, {
              description: `Ask your teammate in chat to add guidance.`,
            })
          }
        />
      */}
    </div>
  );
}
