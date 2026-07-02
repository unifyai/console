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
import { ProviderIntegrationCard } from './ProviderIntegrationCard';
import { IntegrationGalleryVirtualGrid } from './IntegrationGalleryVirtualGrid';
import { integrationTypeFilterValue, integrationTypeLabel } from './integrationType';
import type { IntegrationGalleryItem } from '@/types/integrations';
import type { ProviderAppCatalogFacets } from '@/lib/client/integrations';

export interface IntegrationGalleryFilters {
  query: string;
  category: string;
  status: 'all' | 'connected' | 'needs_attention' | 'not_connected';
}

const DEFAULT_FILTERS: IntegrationGalleryFilters = {
  query: '',
  category: 'all',
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

function isConnectedItem(item: IntegrationGalleryItem): boolean {
  return item.status === 'connected' || item.status === 'configured';
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

function matchesFilters(item: IntegrationGalleryItem, filters: IntegrationGalleryFilters): boolean {
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = [
      item.displayName,
      item.description,
      item.category,
      integrationTypeLabel(item),
      item.canonicalSlug,
      item.sourceMetadata.providerAppId,
      item.sourceMetadata.label,
      ...item.tools.map((tool) => `${tool.displayName} ${tool.description ?? ''}`),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (filters.category !== 'all' && integrationTypeFilterValue(item) !== filters.category)
    return false;
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
    () => items.filter((item) => matchesFilters(item, filters)),
    [filters, items]
  );
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
  const isInitialLoading = Boolean(isLoading && items.length === 0);
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
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
                      {pinnedItems.map((item) => (
                        <ProviderIntegrationCard
                          key={`${item.source}:${item.id}`}
                          item={item}
                          busy={busySlug === item.canonicalSlug}
                          onOpen={onOpen}
                          onPrimaryAction={onPrimaryAction}
                        />
                      ))}
                    </div>
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
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
                        {connectedItems.map((item) => (
                          <ProviderIntegrationCard
                            key={`${item.source}:${item.id}`}
                            item={item}
                            busy={busySlug === item.canonicalSlug}
                            onOpen={onOpen}
                            onPrimaryAction={onPrimaryAction}
                          />
                        ))}
                      </div>
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
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
                        {needsAttentionItems.map((item) => (
                          <ProviderIntegrationCard
                            key={`${item.source}:${item.id}`}
                            item={item}
                            busy={busySlug === item.canonicalSlug}
                            onOpen={onOpen}
                            onPrimaryAction={onPrimaryAction}
                          />
                        ))}
                      </div>
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
