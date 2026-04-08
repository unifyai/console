'use client';

import React, { useMemo } from 'react';
import { DashboardTileCard } from './DashboardTileCard';
import type { DashboardTilePosition, TileRecord } from '@/types/assistants/dashboard';

const ROW_HEIGHT = 120;

interface DashboardGridProps {
  positions: DashboardTilePosition[];
  tiles: TileRecord[];
  /** Lazy loader for tile HTML content */
  getTileHtml?: (token: string) => Promise<string | null>;
  /** Called when a data-bound tile's refresh button is clicked */
  onTileRefresh?: () => void;
  /** Parent-driven collapse signal forwarded to all tile cards */
  defaultCollapsed?: boolean;
}

export function DashboardGrid({
  positions,
  tiles,
  getTileHtml,
  onTileRefresh,
  defaultCollapsed,
}: DashboardGridProps) {
  const tileMap = useMemo(() => {
    const m = new Map<string, TileRecord>();
    for (const t of tiles) m.set(t.token, t);
    return m;
  }, [tiles]);

  const orderedPositions = useMemo(
    () => [...positions].sort((a, b) => a.y - b.y || a.x - b.x),
    [positions]
  );

  if (positions.length === 0) {
    return (
      <p className="text-body-muted px-4 py-6 text-center">This dashboard has no tiles yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orderedPositions.map((pos) => {
        const tile = tileMap.get(pos.tileToken);
        return (
          <DashboardTileCard
            key={pos.tileToken}
            token={pos.tileToken}
            title={tile?.title ?? pos.tileToken}
            htmlContent={tile?.htmlContent}
            getTileHtml={getTileHtml}
            description={tile?.description}
            createdAt={tile?.createdAt}
            updatedAt={tile?.updatedAt}
            hasDataBindings={tile?.hasDataBindings}
            contentHeight={pos.h * ROW_HEIGHT}
            onRefresh={tile?.hasDataBindings ? onTileRefresh : undefined}
            defaultCollapsed={defaultCollapsed}
          />
        );
      })}
    </div>
  );
}
