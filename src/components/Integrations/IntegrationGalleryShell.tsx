'use client';

import * as React from 'react';
import { Loader2, RefreshCw, Search, X } from 'lucide-react';
import { Input } from '@/components/UI/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';
import { ProviderIntegrationCard } from './ProviderIntegrationCard';
import { IntegrationGalleryVirtualGrid } from './IntegrationGalleryVirtualGrid';
import { integrationTypeFilterValue, integrationTypeLabel } from './integrationType';
import type { IntegrationGalleryItem } from '@/types/integrations';

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

function isConnectedItem(item: IntegrationGalleryItem): boolean {
  return item.status === 'connected' || item.status === 'configured';
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
  if (filters.status === 'not_connected') {
    return item.status === 'not_connected';
  }
  return true;
}

function GallerySkeleton() {
  return (
    <div
      className="bg-muted/20 flex min-h-[260px] items-center justify-center rounded-xl border border-dashed"
      data-testid="integration-gallery-skeleton"
    >
      <div className="flex items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-body-muted">Loading available integrations...</span>
      </div>
    </div>
  );
}

export function IntegrationGalleryShell({
  items,
  isLoading,
  isMock,
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
  const filteredItems = React.useMemo(
    () => items.filter((item) => matchesFilters(item, filters)),
    [filters, items]
  );
  const connectedItems = React.useMemo(
    () => filteredItems.filter(isConnectedItem),
    [filteredItems]
  );
  const browsableItems = React.useMemo(
    () => filteredItems.filter((item) => !isConnectedItem(item)),
    [filteredItems]
  );
  const isInitialLoading = Boolean(isLoading && items.length === 0);
  const hasConnectedSection = connectedItems.length > 0;
  const hasBrowsableSection = browsableItems.length > 0;
  const catalogTotal = total ?? filteredItems.length;

  return (
    <section className="space-y-4" data-testid="integration-gallery">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="bg-muted/20 border-b p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-title text-lg">Integration apps</h2>
                {isMock && (
                  <Badge variant="outline" className="rounded-full text-muted-foreground">
                    mock
                  </Badge>
                )}
              </div>
              <p className="text-caption mt-1 max-w-2xl">
                Choose an app, review what access it needs, and connect it securely.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onRefresh && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={isRefreshing}
                  onClick={() => void onRefresh()}
                  data-testid="integration-gallery-refresh"
                >
                  <RefreshCw
                    className={isRefreshing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
                  />
                  Refresh
                </Button>
              )}
              {addCustomControl}
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_180px_auto]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.query}
                placeholder="Search apps and tools..."
                className="pl-8 pr-8"
                onChange={(event) =>
                  setFilters((current) => ({ ...current, query: event.target.value }))
                }
                data-testid="integration-gallery-search"
              />
              {filters.query && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Clear integration search"
                  onClick={() => setFilters((current) => ({ ...current, query: '' }))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select
              value={filters.category}
              onValueChange={(category) => setFilters((current) => ({ ...current, category }))}
            >
              <SelectTrigger data-testid="integration-category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="native">Native</SelectItem>
                <SelectItem value="third_party">Third-party</SelectItem>
              </SelectContent>
            </Select>
            <div
              className="inline-flex justify-self-end overflow-hidden rounded-full border bg-background p-0.5"
              data-testid="integration-status-filter"
            >
              {[
                ['all', 'All'],
                ['connected', 'Connected'],
                ['needs_attention', 'Needs attention'],
                ['not_connected', 'Not connected'],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={filters.status === value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      status: value as IntegrationGalleryFilters['status'],
                    }))
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

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
              {hasConnectedSection && (
                <section className="space-y-3" data-testid="connected-integrations-section">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-title text-base">Connected apps</h3>
                      <p className="text-caption">Apps ready for your assistant to use.</p>
                    </div>
                    <Badge variant="outline" className="text-success rounded-full bg-background">
                      {connectedItems.length} connected
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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

              {hasBrowsableSection && (
                <section className="space-y-3" data-testid="available-integrations-section">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-title text-base">Available apps</h3>
                      <p className="text-caption">
                        Showing {filteredItems.length}
                        {catalogTotal > filteredItems.length ? ` of ${catalogTotal}` : ''} matching
                        apps. Scroll to browse the full catalog.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-full bg-background text-muted-foreground"
                    >
                      {browsableItems.length} available
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
      </div>
    </section>
  );
}
