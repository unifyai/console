'use client';

import * as React from 'react';
import { IntegrationGridSkeleton } from '@/components/Common/Loaders/Skeletons';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';
import { ScrollArea } from '@/components/UI/scroll-area';
import { TabToolbar } from '@/components/Pages/Assistants/Common/TabToolbar';
import { TabSegmentGroup, TabSegment } from '@/components/Pages/Assistants/Common/TabSegmentGroup';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import { useTabSearchCommit } from '@/hooks/Assistants/useTabSearchCommit';
import {
  IntegrationGalleryCardGrid,
  IntegrationGalleryVirtualGrid,
} from './IntegrationGalleryVirtualGrid';
import { integrationTypeFilterValue, integrationTypeLabel } from './integrationType';
import type { IntegrationGalleryItem } from '@/types/integrations';
import type { ProviderAppCatalogFacets } from '@/lib/client/integrations';

export interface IntegrationGalleryFilters {
  query: string;
  category: string;
  semanticCategory: string;
  status: 'all' | 'connected' | 'needs_attention' | 'not_connected';
}

const DEFAULT_FILTERS: IntegrationGalleryFilters = {
  query: '',
  category: 'all',
  semanticCategory: 'all',
  status: 'all',
};

const STATUS_SEGMENTS = [
  ['all', 'All'],
  ['connected', 'Connected'],
  ['needs_attention', 'Needs attention'],
  ['not_connected', 'Not connected'],
] as const;

const CATEGORY_SEGMENTS = [
  ['all', 'All types'],
  ['native', 'Native'],
  ['third_party', 'Third-party'],
] as const;

function semanticCategoryValue(value: string | null | undefined): string {
  return value?.trim().toLowerCase() || '';
}

function semanticCategoryValues(item: IntegrationGalleryItem): string[] {
  const labelKeys = item.labels?.categories.map((category) => category.key).filter(Boolean);
  if (labelKeys && labelKeys.length > 0) return labelKeys;
  const fallback = semanticCategoryValue(item.category);
  return fallback ? [fallback] : [];
}

function isConnectedItem(item: IntegrationGalleryItem): boolean {
  return item.status === 'connected' || item.status === 'configured';
}

function orSearchTerms(query: string): string[] {
  if (!query.includes('|')) return [];
  return [...new Set(query.split('|').map((term) => term.trim().toLowerCase()).filter(Boolean))];
}

function isNeedsAttentionItem(item: IntegrationGalleryItem): boolean {
  return [
    'missing_scope',
    'missing_secrets',
    'needs_reconnect',
    'expired',
    'revoked',
    'error',
    'pending',
  ].includes(item.status);
}

function matchesFilters(
  item: IntegrationGalleryItem,
  filters: IntegrationGalleryFilters,
  enableSemanticCategoryFilter: boolean
): boolean {
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = [
      item.displayName,
      item.description,
      item.category,
      ...(item.labels?.tags.map((label) => label.label) ?? []),
      integrationTypeLabel(item),
      item.canonicalSlug,
      item.sourceMetadata.providerAppId,
      item.sourceMetadata.label,
      ...item.tools.map((tool) => `${tool.displayName} ${tool.description ?? ''}`),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const terms = orSearchTerms(filters.query);
    const matches = terms.length > 1 ? terms.some((term) => haystack.includes(term)) : haystack.includes(query);
    if (!matches) return false;
  }
  if (filters.category !== 'all' && integrationTypeFilterValue(item) !== filters.category)
    return false;
  if (
    enableSemanticCategoryFilter &&
    filters.semanticCategory !== 'all' &&
    !semanticCategoryValues(item).includes(filters.semanticCategory)
  ) {
    return false;
  }
  if (filters.status === 'connected') {
    return item.status === 'connected' || item.status === 'configured';
  }
  if (filters.status === 'needs_attention') {
    return isNeedsAttentionItem(item);
  }
  if (filters.status === 'not_connected') {
    return item.status === 'not_connected';
  }
  return true;
}

function GallerySkeleton() {
  return <IntegrationGridSkeleton />;
}

export function IntegrationGalleryShell({
  items,
  isLoading,
  busySlug,
  onOpen,
  onPrimaryAction,
  onRefresh,
  isRefreshing,
  addCustomControl,
  filters: controlledFilters,
  onFiltersChange,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
  facets,
  enableSemanticCategoryFilter = false,
}: {
  items: IntegrationGalleryItem[];
  isLoading?: boolean;
  isMock?: boolean;
  busySlug?: string | null;
  onOpen: (item: IntegrationGalleryItem) => void;
  onPrimaryAction: (item: IntegrationGalleryItem) => void;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
  addCustomControl?: React.ReactNode;
  filters?: IntegrationGalleryFilters;
  onFiltersChange?: (filters: IntegrationGalleryFilters) => void;
  total?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void | Promise<void>;
  facets?: ProviderAppCatalogFacets | null;
  enableSemanticCategoryFilter?: boolean;
}) {
  const [localFilters, setLocalFilters] =
    React.useState<IntegrationGalleryFilters>(DEFAULT_FILTERS);
  const filters = controlledFilters ?? localFilters;
  const setFilters = React.useCallback(
    (updater: React.SetStateAction<IntegrationGalleryFilters>) => {
      const next = typeof updater === 'function' ? updater(filters) : updater;
      if (onFiltersChange) onFiltersChange(next);
      else setLocalFilters(next);
    },
    [filters, onFiltersChange]
  );
  const {
    draft: searchDraft,
    setDraft: setSearchDraft,
    clear: clearSearchDraft,
  } = useTabSearchCommit(filters.query);

  const submitSearch = React.useCallback(() => {
    setFilters((current) => ({ ...current, query: searchDraft.trim() }));
  }, [searchDraft, setFilters]);

  const clearSearch = React.useCallback(() => {
    clearSearchDraft();
    setFilters((current) => ({ ...current, query: '' }));
  }, [clearSearchDraft, setFilters]);
  const filteredItems = React.useMemo(
    () => items.filter((item) => matchesFilters(item, filters, enableSemanticCategoryFilter)),
    [enableSemanticCategoryFilter, filters, items]
  );
  const semanticCategorySegments = React.useMemo(() => {
    if (!enableSemanticCategoryFilter) return [];
    const fromFacets =
      facets?.categories?.map((category) => [category.value, category.label] as const) ?? [];
    if (fromFacets.length > 0)
      return [['all', 'All categories'] as const, ...fromFacets.slice(0, 8)];
    const byValue = new Map<string, string>();
    for (const item of items) {
      const labels = item.labels?.categories ?? [];
      if (labels.length > 0) {
        for (const label of labels) {
          if (label.key && !byValue.has(label.key)) byValue.set(label.key, label.label);
        }
        continue;
      }
      const value = semanticCategoryValue(item.category);
      if (value && !byValue.has(value)) byValue.set(value, item.category ?? value);
    }
    return [
      ['all', 'All categories'] as const,
      ...Array.from(byValue.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .slice(0, 8),
    ];
  }, [enableSemanticCategoryFilter, facets?.categories, items]);
  const connectedItems = React.useMemo(
    () => filteredItems.filter(isConnectedItem),
    [filteredItems]
  );
  const needsAttentionItems = React.useMemo(
    () => filteredItems.filter((item) => !isConnectedItem(item) && isNeedsAttentionItem(item)),
    [filteredItems]
  );
  const browsableItems = React.useMemo(
    () => filteredItems.filter((item) => !isConnectedItem(item) && !isNeedsAttentionItem(item)),
    [filteredItems]
  );
  // Under "All", connected and needs-attention apps share a single card pinned
  // above the browsable catalog. The dedicated status filters keep them split.
  const showCombinedPinned = filters.status === 'all';
  const pinnedItems = React.useMemo(
    () => [...connectedItems, ...needsAttentionItems],
    [connectedItems, needsAttentionItems]
  );
  const isInitialLoading = Boolean((isLoading || isRefreshing) && items.length === 0);
  const hasConnectedSection = connectedItems.length > 0;
  const hasNeedsAttentionSection = needsAttentionItems.length > 0;
  const hasBrowsableSection = browsableItems.length > 0;
  const loadedAvailableCount = browsableItems.length;
  const catalogTotal = total ?? filteredItems.length;
  const connectedTotal =
    filters.status === 'all'
      ? Math.max(connectedItems.length, facets?.statusGroup.connected ?? 0)
      : 0;
  const needsAttentionTotal =
    filters.status === 'all'
      ? Math.max(needsAttentionItems.length, facets?.statusGroup.needsAttention ?? 0)
      : 0;
  const totalAvailableCount = Math.max(
    loadedAvailableCount,
    Math.max(catalogTotal - connectedTotal - needsAttentionTotal, 0)
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" data-testid="integration-gallery">
      <TabToolbar
        leading={
          <div className="flex flex-wrap items-center gap-2">
            <TabSegmentGroup testId="integration-status-filter">
              {STATUS_SEGMENTS.map(([value, label]) => (
                <TabSegment
                  key={value}
                  label={label}
                  active={filters.status === value}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      status: value as IntegrationGalleryFilters['status'],
                    }))
                  }
                />
              ))}
            </TabSegmentGroup>
            <TabSegmentGroup testId="integration-category-filter">
              {CATEGORY_SEGMENTS.map(([value, label]) => (
                <TabSegment
                  key={value}
                  label={label}
                  active={filters.category === value}
                  onClick={() => setFilters((current) => ({ ...current, category: value }))}
                />
              ))}
            </TabSegmentGroup>
            {enableSemanticCategoryFilter && semanticCategorySegments.length > 1 ? (
              <TabSegmentGroup testId="integration-semantic-category-filter">
                {semanticCategorySegments.map(([value, label]) => (
                  <TabSegment
                    key={value}
                    label={label}
                    active={filters.semanticCategory === value}
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        semanticCategory: value,
                      }))
                    }
                  />
                ))}
              </TabSegmentGroup>
            ) : null}
          </div>
        }
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        onSearchSubmit={submitSearch}
        onSearchClear={clearSearch}
        searchPlaceholder={tabSearchPlaceholder('integrations')}
        searchTestId="integration-gallery-search"
        searchClearTestId="integration-gallery-search-clear"
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh integrations"
        refreshTestId="integration-gallery-refresh"
        addAction={addCustomControl}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-3 py-3">
          {isInitialLoading ? (
            <GallerySkeleton />
          ) : filteredItems.length === 0 ? (
            <div className="bg-muted/20 rounded-xl border border-dashed p-6 text-center">
              <p className="text-title text-sm">No integrations match these filters</p>
              <p className="text-caption mt-1">
                Try a broader search or clear filters to browse connectable apps.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              {showCombinedPinned ? (
                pinnedItems.length > 0 && (
                  <section className="space-y-3" data-testid="connected-integrations-section">
                    <div className="flex items-start justify-between gap-3 sm:items-center">
                      <div>
                        <h3 className="text-title text-base">Connected apps</h3>
                        <p className="text-caption">
                          Apps connected or needing attention, ready for your assistant.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasConnectedSection && (
                          <Badge
                            variant="outline"
                            className="text-success rounded-full bg-background"
                          >
                            {connectedItems.length} connected
                          </Badge>
                        )}
                        {hasNeedsAttentionSection && (
                          <Badge
                            variant="outline"
                            className="rounded-full bg-background text-[color:var(--status-warning)]"
                          >
                            {needsAttentionItems.length} need attention
                          </Badge>
                        )}
                      </div>
                    </div>
                    <IntegrationGalleryCardGrid
                      items={pinnedItems}
                      busySlug={busySlug}
                      onOpen={onOpen}
                      onPrimaryAction={onPrimaryAction}
                    />
                  </section>
                )
              ) : (
                <>
                  {hasConnectedSection && (
                    <section className="space-y-3" data-testid="connected-integrations-section">
                      <div className="flex items-start justify-between gap-3 sm:items-center">
                        <div>
                          <h3 className="text-title text-base">Connected apps</h3>
                          <p className="text-caption">Apps ready for your assistant to use.</p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-success rounded-full bg-background"
                        >
                          {connectedItems.length} connected
                        </Badge>
                      </div>
                      <IntegrationGalleryCardGrid
                        items={connectedItems}
                        busySlug={busySlug}
                        onOpen={onOpen}
                        onPrimaryAction={onPrimaryAction}
                      />
                    </section>
                  )}

                  {hasNeedsAttentionSection && (
                    <section
                      className="space-y-3"
                      data-testid="needs-attention-integrations-section"
                    >
                      <div className="flex items-start justify-between gap-3 sm:items-center">
                        <div>
                          <h3 className="text-title text-base">Needs attention</h3>
                          <p className="text-caption">
                            Apps that need a reconnect or configuration update.
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full bg-background text-[color:var(--status-warning)]"
                        >
                          {needsAttentionItems.length} need attention
                        </Badge>
                      </div>
                      <IntegrationGalleryCardGrid
                        items={needsAttentionItems}
                        busySlug={busySlug}
                        onOpen={onOpen}
                        onPrimaryAction={onPrimaryAction}
                      />
                    </section>
                  )}
                </>
              )}

              {hasBrowsableSection && (
                <section className="space-y-3" data-testid="available-integrations-section">
                  <div className="flex items-start justify-between gap-3 sm:items-center">
                    <div>
                      <h3 className="text-title text-base">Available apps</h3>
                      <p className="text-caption">
                        Showing {loadedAvailableCount} of {totalAvailableCount} available apps.
                        Scroll to browse the full catalog.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="h-auto shrink-0 self-center whitespace-nowrap rounded-full bg-background text-muted-foreground"
                    >
                      {totalAvailableCount} available
                    </Badge>
                  </div>
                  <IntegrationGalleryVirtualGrid
                    items={browsableItems}
                    busySlug={busySlug}
                    hasMore={hasMore}
                    isLoadingMore={isLoadingMore}
                    onEndReached={onLoadMore}
                    onOpen={onOpen}
                    onPrimaryAction={onPrimaryAction}
                  />
                </section>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
