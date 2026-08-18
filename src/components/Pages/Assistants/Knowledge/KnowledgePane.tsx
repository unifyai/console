'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { BookOpen, Link2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import { cn } from '@/lib/utils';
import { useBrainData } from '@/hooks/Assistants/useBrainData';
import { useTabSearchCommit } from '@/hooks/Assistants/useTabSearchCommit';
import { formatTimestamp } from '@/utils/assistants/brain';
import {
  formatSourceRefLabel,
  KNOWLEDGE_KINDS,
  KNOWLEDGE_STATUSES,
} from '@/utils/assistants/knowledge';
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
import type { KnowledgeClaim, KnowledgeSourceRef } from '@/types/assistants/brain';
import type { Assistant } from '@/types/assistants/assistant';
import type { ContextRoot } from '@/lib/assistants/scope';

interface KnowledgePaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Scope override: a team root reads `Teams/{id}/…` instead of merging the
   *  assistant's readable roots. */
  root?: ContextRoot | null;
  enabled?: boolean;
}

function claimSortTimestamp(claim: KnowledgeClaim): string | null {
  return claim.updatedAt ?? claim.observedAt ?? claim.createdAt ?? claim.ts ?? null;
}

function claimUpdatedLabel(claim: KnowledgeClaim): string | null {
  const value = claim.updatedAt ?? claim.observedAt ?? claim.createdAt ?? claim.ts;
  return value ? formatTimestamp(value) : null;
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

function statusToneClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]';
    case 'superseded':
      return 'bg-muted text-muted-foreground';
    case 'invalidated':
      return 'bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger)]';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function sourceRefChipClass(ref: KnowledgeSourceRef): string {
  const base =
    'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors';
  switch (ref.kind) {
    case 'web':
      return cn(base, 'border-primary/20 bg-primary-tint-10 text-primary hover:bg-primary-tint-20');
    case 'file':
    case 'data':
      return cn(base, 'border-border bg-muted/60 text-foreground hover:bg-muted');
    case 'contact':
    case 'transcript':
      return cn(
        base,
        'border-[color:var(--status-info)]/20 bg-[color:var(--status-info-bg)] text-[color:var(--status-info)]'
      );
    default:
      return cn(base, 'border-border bg-muted text-muted-foreground hover:text-foreground');
  }
}

function SourceRefChip({
  sourceRef,
  index,
  onSelectClaim,
}: {
  sourceRef: KnowledgeSourceRef;
  index: number;
  onSelectClaim: (knowledgeId: number) => void;
}) {
  const label = formatSourceRefLabel(sourceRef);
  const kindLabel = String(sourceRef.kind).replace(/_/g, ' ');
  const chipContent = (
    <>
      <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="capitalize">{kindLabel}</span>
      <span className="truncate opacity-80">· {label}</span>
    </>
  );

  if (sourceRef.kind === 'derived_from_knowledge' && sourceRef.knowledgeId != null) {
    return (
      <button
        type="button"
        title={sourceRef.note ?? undefined}
        onClick={() => onSelectClaim(sourceRef.knowledgeId!)}
        className={cn(
          sourceRefChipClass(sourceRef),
          'transition-colors hover:bg-accent-soft hover:text-accent-soft-foreground'
        )}
        data-testid={`knowledge-source-chip-${index}`}
      >
        {chipContent}
      </button>
    );
  }

  if (sourceRef.kind === 'web' && sourceRef.url) {
    return (
      <a
        href={sourceRef.url}
        target="_blank"
        rel="noreferrer"
        title={sourceRef.note ?? sourceRef.url}
        className={sourceRefChipClass(sourceRef)}
        data-testid={`knowledge-source-chip-${index}`}
      >
        {chipContent}
      </a>
    );
  }

  return (
    <span
      title={sourceRef.note ?? undefined}
      className={sourceRefChipClass(sourceRef)}
      data-testid={`knowledge-source-chip-${index}`}
    >
      {chipContent}
    </span>
  );
}

function confidenceLabel(confidence: number | null): string | null {
  if (confidence === null || !Number.isFinite(confidence)) return null;
  return `${Math.round(confidence * 100)}%`;
}

export function KnowledgePane({
  assistant,
  ownerId,
  assistantId,
  root = null,
  enabled = true,
}: KnowledgePaneProps) {
  const scope = useBrainScopeFilter(assistant, { fixedRoot: root });
  const { knowledge, hasLoaded, isLoading, error, refetch } = useBrainData({
    assistant,
    ownerId,
    assistantId,
    root: scope.root,
    contexts: ['Knowledge'] as const,
    initialContext: 'Knowledge',
    enabled,
  });

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

  const claims = knowledge.rows;

  const allScopes = useMemo(() => {
    const set = new Set<string>();
    claims.forEach((claim) => claim.scope && set.add(claim.scope));
    return Array.from(set).sort();
  }, [claims]);

  const allTopics = useMemo(() => {
    const set = new Set<string>();
    claims.forEach((claim) => claim.topics.forEach((topic) => set.add(topic)));
    return Array.from(set).sort();
  }, [claims]);

  const kindValues = useMemo(() => {
    const set = new Set<string>(KNOWLEDGE_KINDS);
    claims.forEach((claim) => set.add(String(claim.kind)));
    return Array.from(set).sort();
  }, [claims]);

  const statusValues = useMemo(() => {
    const set = new Set<string>(KNOWLEDGE_STATUSES);
    claims.forEach((claim) => set.add(String(claim.status)));
    return Array.from(set).sort();
  }, [claims]);

  const selectedScopes = useMemo(
    () =>
      new Set(
        Array.from(selectedKeys)
          .filter((k) => k.startsWith('scope:'))
          .map((k) => k.slice('scope:'.length))
      ),
    [selectedKeys]
  );
  const selectedTopics = useMemo(
    () =>
      new Set(
        Array.from(selectedKeys)
          .filter((k) => k.startsWith('topic:'))
          .map((k) => k.slice('topic:'.length))
      ),
    [selectedKeys]
  );
  const selectedKinds = useMemo(
    () =>
      new Set(
        Array.from(selectedKeys)
          .filter((k) => k.startsWith('kind:'))
          .map((k) => k.slice('kind:'.length))
      ),
    [selectedKeys]
  );
  const selectedStatuses = useMemo(
    () =>
      new Set(
        Array.from(selectedKeys)
          .filter((k) => k.startsWith('status:'))
          .map((k) => k.slice('status:'.length))
      ),
    [selectedKeys]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return claims.filter((claim) => {
      if (
        q &&
        !(claim.title + ' ' + claim.content + ' ' + claim.kind + ' ' + claim.topics.join(' '))
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      if (selectedScopes.size > 0 && !(claim.scope && selectedScopes.has(claim.scope))) {
        return false;
      }
      if (
        selectedTopics.size > 0 &&
        !Array.from(selectedTopics).every((t) => claim.topics.includes(t))
      ) {
        return false;
      }
      if (selectedKinds.size > 0 && !selectedKinds.has(String(claim.kind))) return false;
      if (selectedStatuses.size > 0 && !selectedStatuses.has(String(claim.status))) return false;
      return true;
    });
  }, [claims, searchQuery, selectedScopes, selectedTopics, selectedKinds, selectedStatuses]);

  const filteredWithSort = useMemo(
    () =>
      filtered.map((claim) => ({
        claim,
        sortTimestamp: claimSortTimestamp(claim),
      })),
    [filtered]
  );

  const filteredGroups = useMemo(() => groupByCalendarDay(filteredWithSort), [filteredWithSort]);

  const active = useMemo(() => {
    if (filtered.length === 0) return null;
    const picked = selectedId
      ? filtered.find((claim) => String(claim.knowledgeId) === selectedId)
      : null;
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

  const selectClaimById = useCallback((knowledgeId: number) => {
    setSelectedId(String(knowledgeId));
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
    <div className="flex h-full min-w-0 flex-col" data-testid="knowledge-pane">
      <TabToolbar
        testId="knowledge-header"
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        onSearchSubmit={submitSearch}
        onSearchClear={clearSearch}
        searchPlaceholder={tabSearchPlaceholder('knowledge')}
        searchTestId="knowledge-search"
        searchClearTestId="knowledge-search-clear"
        filter={
          <TabFilterDropdown
            groups={[
              { id: 'kind', label: 'Kind', values: kindValues },
              { id: 'status', label: 'Status', values: statusValues },
              { id: 'topic', label: 'Topics', values: allTopics },
              { id: 'scope', label: 'Scope', values: allScopes },
            ]}
            selected={selectedKeys}
            onToggle={toggleKey}
            onClear={() => setSelectedKeys(new Set())}
            triggerTestId="knowledge-filter-trigger"
            clearTestId="knowledge-filter-clear"
          />
        }
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh"
        refreshTestId="knowledge-refresh"
        trailing={<BrainScopeDropdown scope={scope} />}
      />

      <SplitPaneLayout
        paneId="knowledge-claims"
        defaultWidth={288}
        mobileMode="stack"
        stackBelow="shellCompact"
        detailOpen={isStackedLayout ? selectedId !== null && active !== null : true}
        onDetailClose={() => setSelectedId(null)}
        mobileBackLabel="Claims"
        mobileBackTestId="knowledge-mobile-back"
        left={
          <div className="flex h-full min-w-0 flex-col" data-testid="knowledge-list">
            {isLoading && !hasLoaded ? (
              <div className="flex flex-col gap-1.5 p-2" data-testid="knowledge-list-skeleton">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-caption p-3" data-testid="knowledge-empty">
                {claims.length === 0
                  ? 'No knowledge found.'
                  : 'No knowledge matches these filters.'}
              </div>
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
                      {group.items.map(({ claim }) => {
                        const id = String(claim.knowledgeId);
                        const isActive = active?.knowledgeId === claim.knowledgeId;
                        return (
                          <button
                            key={id}
                            className={cn(
                              'flex w-full min-w-0 items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                              isActive
                                ? 'bg-accent-soft text-accent-soft-foreground'
                                : 'text-ink-2 hover:bg-muted hover:text-foreground'
                            )}
                            onClick={() => setSelectedId(id)}
                            data-testid={`knowledge-item-${id}`}
                          >
                            <BookOpen
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
                                {claim.title}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full bg-primary-tint-10 px-1.5 py-0.5 text-[9.5px] font-medium capitalize text-primary">
                                  {claim.kind}
                                </span>
                                <span
                                  className={cn(
                                    'rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold capitalize',
                                    statusToneClass(String(claim.status))
                                  )}
                                >
                                  {claim.status}
                                </span>
                                {claim.topics.slice(0, 2).map((topic) => (
                                  <span
                                    key={topic}
                                    className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-medium text-accent-soft-foreground"
                                  >
                                    {topic}
                                  </span>
                                ))}
                                {claim.scope && (
                                  <span className="rounded-full bg-[color:var(--status-info-bg)] px-1.5 py-0.5 text-[9.5px] font-semibold text-[color:var(--status-info)]">
                                    {claim.scope}
                                  </span>
                                )}
                                {claim.isBuiltin && (
                                  <span className="text-[9.5px] uppercase tracking-wide text-muted-foreground">
                                    built-in
                                  </span>
                                )}
                                {claim.staleReasons.length > 0 && (
                                  <span className="rounded-full bg-[color:var(--status-warning-bg)] px-1.5 py-0.5 text-[9.5px] font-semibold text-[color:var(--status-warning)]">
                                    link debt
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        }
        right={
          <div className="h-full min-w-0" data-testid="knowledge-reader">
            {isLoading && !hasLoaded ? (
              <div className="w-full px-6 pb-5 pt-3" data-testid="knowledge-reader-skeleton">
                <Skeleton className="mb-4 h-7 w-1/2" />
                <SkeletonText lines={6} />
              </div>
            ) : active ? (
              <ScrollArea className="h-full min-w-0">
                <div className="w-full min-w-0 px-6 pb-5 pt-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary-tint-10 px-2 py-0.5 text-[10.5px] font-semibold capitalize text-primary">
                      {active.kind}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize',
                        statusToneClass(String(active.status))
                      )}
                    >
                      {active.status}
                    </span>
                    {confidenceLabel(active.confidence) && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        confidence {confidenceLabel(active.confidence)}
                      </span>
                    )}
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
                    {claimUpdatedLabel(active) && (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {claimUpdatedLabel(active)}
                      </span>
                    )}
                    <div className="ml-auto">
                      <CopyButton
                        content={active.content}
                        tooltipContent="Copy claim"
                        className="h-6 w-6"
                      />
                    </div>
                  </div>

                  {active.staleReasons.length > 0 && (
                    <StaleReasonChips
                      reasons={active.staleReasons}
                      banner
                      className="mb-3"
                      chipTestIdPrefix="knowledge-stale-reason"
                    />
                  )}

                  {active.topics.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-overline">Topics</span>
                      {active.topics.map((topic) => (
                        <span
                          key={topic}
                          className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-medium text-accent-soft-foreground"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}

                  {active.sourceRefs.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-overline">Sources</span>
                      {active.sourceRefs.map((sourceRef, index) => (
                        <SourceRefChip
                          key={`${sourceRef.kind}-${index}`}
                          sourceRef={sourceRef}
                          index={index}
                          onSelectClaim={selectClaimById}
                        />
                      ))}
                    </div>
                  )}

                  <h2 className="text-doc-title mb-3">{active.title}</h2>
                  <div className="break-words">
                    <AssistantMarkdown>
                      {stripLeadingTitleFromBody(active.content || '_No content._', active.title)}
                    </AssistantMarkdown>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="text-body-muted flex h-full items-center justify-center">
                Select a claim to read it.
              </div>
            )}
          </div>
        }
      />

      <TabFooter
        testId="knowledge-footer"
        count={filtered.length}
        total={claims.length}
        singular="claim"
        plural="claims"
      />
    </div>
  );
}
