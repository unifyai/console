'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { DashboardGridSkeleton } from '@/components/Common/Loaders/Skeletons';
import { useDashboards } from '@/hooks/Assistants/useDashboards';
import { DashboardCollapseAllButton, DashboardViewSelector } from './DashboardsPaneHeader';
import { DashboardsPaneFooter } from './DashboardsPaneFooter';
import { DashboardSummaryCard } from './DashboardSummaryCard';
import { DashboardGrid } from './DashboardGrid';
import { DashboardTileCard } from './DashboardTileCard';
import { DashboardEmptyState } from './DashboardEmptyState';
import { TabToolbar } from '../Common/TabToolbar';
import { BrainScopeChips, useBrainScopeFilter } from '../Common/BrainScopeFilter';
import { TabFooter } from '../Common/TabFooter';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import {
  USE_MOCK_DASHBOARDS,
  getMockDashboardMetadata,
  getMockTileContent,
} from '@/utils/assistants/dashboard-mock-data';
import type {
  DashboardPaneData,
  DashboardTilePosition,
  DashboardRecord,
  TileRecord,
} from '@/types/assistants/dashboard';
import type { Assistant } from '@/types/assistants/assistant';
import type { ContextRoot } from '@/lib/assistants/scope';
import { parseDashboardLayout } from '@/utils/assistants/parse-dashboard-layout';

interface DashboardsPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Scope override: a team root reads `Teams/{id}/Dashboards/…` only. */
  root?: ContextRoot | null;
  getMetadata?: (assistant: Assistant) => Promise<DashboardPaneData>;
  getTileContent?: (assistant: Assistant, tileToken: string) => Promise<string | null>;
  shouldPoll: boolean;
}

export function DashboardsPane({
  assistant,
  ownerId,
  assistantId,
  root = null,
  shouldPoll,
}: DashboardsPaneProps) {
  const scope = useBrainScopeFilter(assistant, { fixedRoot: root });
  const effectiveGetMetadata = useMemo(
    () => (USE_MOCK_DASHBOARDS ? () => Promise.resolve(getMockDashboardMetadata()) : undefined),
    []
  );

  const effectiveGetTileContent = useMemo(
    () =>
      USE_MOCK_DASHBOARDS
        ? (_assistant: Assistant, token: string) => getMockTileContent(token)
        : undefined,
    []
  );

  const {
    dashboards,
    tiles,
    isInitialLoading,
    isRefreshing: isResourceRefreshing,
    refetch,
    dataUpdatedAt,
    getTileHtml,
  } = useDashboards({
    assistant,
    ownerId,
    assistantId,
    root: scope.root,
    getMetadata: effectiveGetMetadata,
    getTileContent: effectiveGetTileContent,
    shouldPoll,
  });

  const sortedDashboards = useMemo(
    () =>
      [...dashboards].sort((a, b) => {
        const ta = a.updatedAt ?? a.createdAt ?? '';
        const tb = b.updatedAt ?? b.createdAt ?? '';
        return tb.localeCompare(ta);
      }),
    [dashboards]
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');

  const defaultKey = sortedDashboards[0]
    ? `dash:${sortedDashboards[0].token}`
    : tiles[0]
      ? `tile:${tiles[0].token}`
      : null;
  const activeKey = selectedKey ?? defaultKey;

  const activeDashboard = useMemo<DashboardRecord | null>(() => {
    if (!activeKey?.startsWith('dash:')) return null;
    const token = activeKey.slice(5);
    return sortedDashboards.find((d) => d.token === token) ?? null;
  }, [activeKey, sortedDashboards]);

  const activeTile = useMemo<TileRecord | null>(() => {
    if (!activeKey?.startsWith('tile:')) return null;
    const token = activeKey.slice(5);
    return tiles.find((t) => t.token === token) ?? null;
  }, [activeKey, tiles]);

  const positions = useMemo<DashboardTilePosition[]>(
    () => (activeDashboard ? parseDashboardLayout(activeDashboard.layout) : []),
    [activeDashboard]
  );

  const [allCollapsed, setAllCollapsed] = useState<boolean | undefined>(undefined);

  const toggleCollapseAll = useCallback(() => {
    setAllCollapsed((prev) => (prev === true ? false : true));
  }, []);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch({ blocking: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const showRefreshing = isRefreshing || isResourceRefreshing;
  const isEmpty = dashboards.length === 0 && tiles.length === 0;

  return (
    <div className="flex h-full flex-col" data-testid="dashboards-pane">
      <TabToolbar
        testId="dashboards-header"
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder={tabSearchPlaceholder('dashboards')}
        searchTestId="dashboards-search"
        searchClearTestId="dashboards-search-clear"
        leading={
          !isEmpty ? (
            <DashboardViewSelector
              dashboards={sortedDashboards}
              tiles={tiles}
              selectedKey={activeKey}
              onSelect={setSelectedKey}
              filterQuery={searchValue}
            />
          ) : undefined
        }
        trailing={
          !isEmpty ? (
            <DashboardCollapseAllButton
              allCollapsed={allCollapsed === true}
              onToggleCollapseAll={toggleCollapseAll}
            />
          ) : undefined
        }
        onRefresh={handleRefresh}
        isRefreshing={showRefreshing}
        refreshTitle="Refresh dashboards"
        refreshTestId="dashboards-refresh"
      />
      <BrainScopeChips scope={scope} />

      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="dashboards-body">
        {isInitialLoading ? (
          <DashboardGridSkeleton className="min-h-0 flex-1" />
        ) : isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <DashboardEmptyState />
          </div>
        ) : (
          <>
            {activeDashboard && (
              <section className="px-3 py-3" data-testid="dashboard-summary-section">
                <DashboardSummaryCard dashboard={activeDashboard} getTileHtml={getTileHtml}>
                  <DashboardGrid
                    positions={positions}
                    tiles={tiles}
                    onTileRefresh={handleRefresh}
                    defaultCollapsed={allCollapsed}
                  />
                </DashboardSummaryCard>
              </section>
            )}

            {activeTile && (
              <section
                className="flex h-full flex-col px-3 py-3"
                data-testid="standalone-tile-section"
              >
                <DashboardTileCard
                  key={activeTile.token}
                  token={activeTile.token}
                  title={activeTile.title}
                  htmlContent={activeTile.htmlContent}
                  description={activeTile.description}
                  createdAt={activeTile.createdAt}
                  updatedAt={activeTile.updatedAt}
                  hasDataBindings={activeTile.hasDataBindings}
                  fillHeight
                  onRefresh={activeTile.hasDataBindings ? handleRefresh : undefined}
                  defaultCollapsed={allCollapsed}
                />
              </section>
            )}
          </>
        )}
      </div>

      {isEmpty ? (
        <TabFooter
          testId="dashboards-footer"
          right={
            <span className="text-caption" data-testid="dashboards-table-footer">
              0 dashboards · 0 tiles
            </span>
          }
        />
      ) : (
        <DashboardsPaneFooter
          dashboardCount={dashboards.length}
          tileCount={tiles.length}
          dataUpdatedAt={dataUpdatedAt}
          isPolling={shouldPoll}
          isMockData={USE_MOCK_DASHBOARDS}
        />
      )}
    </div>
  );
}
