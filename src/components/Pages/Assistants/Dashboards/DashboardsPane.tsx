'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useDashboards } from '@/hooks/Assistants/useDashboards';
import { DashboardsPaneHeader } from './DashboardsPaneHeader';
import { DashboardsPaneFooter } from './DashboardsPaneFooter';
import { DashboardSummaryCard } from './DashboardSummaryCard';
import { DashboardGrid } from './DashboardGrid';
import { DashboardTileCard } from './DashboardTileCard';
import { DashboardEmptyState } from './DashboardEmptyState';
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

function parseLayout(layoutJson: string): DashboardTilePosition[] {
  try {
    return JSON.parse(layoutJson) as DashboardTilePosition[];
  } catch {
    return [];
  }
}

interface DashboardsPaneProps {
  ownerId: string;
  assistantId: string;
  getMetadata: (ownerId: string, assistantId: string) => Promise<DashboardPaneData>;
  getTileContent: (
    ownerId: string,
    assistantId: string,
    tileToken: string
  ) => Promise<string | null>;
  shouldPoll: boolean;
}

export function DashboardsPane({
  ownerId,
  assistantId,
  getMetadata,
  getTileContent,
  shouldPoll,
}: DashboardsPaneProps) {
  // In mock mode, override the server actions so mock data flows through
  // the same lazy-loading path (metadata without htmlContent, content fetched
  // on demand with a simulated delay).
  const effectiveGetMetadata = useMemo(
    () => (USE_MOCK_DASHBOARDS ? () => Promise.resolve(getMockDashboardMetadata()) : getMetadata),
    [getMetadata]
  );

  const effectiveGetTileContent = useMemo(
    () =>
      USE_MOCK_DASHBOARDS
        ? (_o: string, _a: string, token: string) => getMockTileContent(token)
        : getTileContent,
    [getTileContent]
  );

  const { dashboards, tiles, standaloneTiles, isLoading, refetch, dataUpdatedAt, getTileHtml } =
    useDashboards({
      ownerId,
      assistantId,
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

  const defaultKey = sortedDashboards[0]
    ? `dash:${sortedDashboards[0].token}`
    : standaloneTiles[0]
      ? `tile:${standaloneTiles[0].token}`
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
    return standaloneTiles.find((t) => t.token === token) ?? null;
  }, [activeKey, standaloneTiles]);

  const positions = useMemo<DashboardTilePosition[]>(
    () => (activeDashboard ? parseLayout(activeDashboard.layout) : []),
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
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  if (!isLoading && dashboards.length === 0 && tiles.length === 0) {
    return <DashboardEmptyState />;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header — refresh, searchable combobox, collapse/expand */}
      <DashboardsPaneHeader
        dashboards={sortedDashboards}
        standaloneTiles={standaloneTiles}
        selectedKey={activeKey}
        onSelect={setSelectedKey}
        allCollapsed={allCollapsed === true}
        onToggleCollapseAll={toggleCollapseAll}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="dashboards-body">
        {/* Dashboard summary + tile list */}
        {activeDashboard && (
          <section className="px-3 py-3" data-testid="dashboard-summary-section">
            <DashboardSummaryCard dashboard={activeDashboard} getTileHtml={getTileHtml}>
              <DashboardGrid
                positions={positions}
                tiles={tiles}
                getTileHtml={getTileHtml}
                onTileRefresh={handleRefresh}
                defaultCollapsed={allCollapsed}
              />
            </DashboardSummaryCard>
          </section>
        )}

        {/* Standalone tile — collapsible card that fills the pane */}
        {activeTile && (
          <section className="flex h-full flex-col px-3 py-3" data-testid="standalone-tile-section">
            <DashboardTileCard
              key={activeTile.token}
              token={activeTile.token}
              title={activeTile.title}
              htmlContent={activeTile.htmlContent}
              getTileHtml={getTileHtml}
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
      </div>

      {/* Footer — status bar */}
      <DashboardsPaneFooter
        dashboardCount={dashboards.length}
        tileCount={tiles.length}
        dataUpdatedAt={dataUpdatedAt}
        isPolling={shouldPoll}
        isRefreshing={isRefreshing}
        isMockData={USE_MOCK_DASHBOARDS}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
