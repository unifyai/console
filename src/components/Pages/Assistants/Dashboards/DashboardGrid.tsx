'use client';

import React, { useMemo } from 'react';
import { DashboardTileCard } from './DashboardTileCard';
import { isStrayRootRecord } from './StrayRootBadge';
import type { DashboardTilePosition, TileRecord } from '@/types/assistants/dashboard';

const ROW_HEIGHT = 120;
const GRID_COLS = 12;

interface DashboardGridProps {
  positions: DashboardTilePosition[];
  tiles: TileRecord[];
  /** Called when a data-bound tile's refresh button is clicked */
  onTileRefresh?: () => void;
  /** Parent-driven collapse signal forwarded to all tile cards */
  defaultCollapsed?: boolean;
  /** Assistant that owns these tiles (for action buttons) */
  assistantId?: string;
  /** True for team-owned assistants, whose personal root should be empty. */
  flagPersonalAsStray?: boolean;
}

export function DashboardGrid({
  positions,
  tiles,
  onTileRefresh,
  defaultCollapsed,
  assistantId,
  flagPersonalAsStray = false,
}: DashboardGridProps) {
  const tileMap = useMemo(() => {
    const m = new Map<string, TileRecord>();
    for (const t of tiles) m.set(t.token, t);
    return m;
  }, [tiles]);

  // Render tiles in their stored grid positions. When a dashboard has no
  // parseable layout, fall back to a two-up flow so its tiles are still shown.
  const effectivePositions = useMemo<DashboardTilePosition[]>(() => {
    if (positions.length > 0) return [...positions].sort((a, b) => a.y - b.y || a.x - b.x);
    return tiles.map((t, i) => ({
      tileToken: t.token,
      x: (i % 2) * 6,
      y: Math.floor(i / 2) * 4,
      w: 6,
      h: 4,
    }));
  }, [positions, tiles]);

  if (effectivePositions.length === 0) {
    return (
      <p className="text-body-muted px-4 py-6 text-center">This dashboard has no tiles yet.</p>
    );
  }

  // When everything is collapsed the fixed grid rows would leave large gaps, so
  // switch to an auto-flow grid that lets the collapsed headers stack tightly.
  const collapsed = defaultCollapsed === true;

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
        gridAutoRows: collapsed ? 'min-content' : `${ROW_HEIGHT}px`,
      }}
    >
      {effectivePositions.map((pos) => {
        const tile = tileMap.get(pos.tileToken);
        const span = Math.max(1, Math.min(pos.w, GRID_COLS));
        return (
          <div
            key={pos.tileToken}
            className="flex min-w-0"
            style={{
              gridColumn: `span ${span}`,
              gridRow: collapsed ? undefined : `span ${Math.max(1, pos.h)}`,
            }}
          >
            <DashboardTileCard
              token={pos.tileToken}
              title={tile?.title ?? pos.tileToken}
              htmlContent={tile?.htmlContent}
              description={tile?.description}
              createdAt={tile?.createdAt}
              updatedAt={tile?.updatedAt}
              hasDataBindings={tile?.hasDataBindings}
              fillHeight={!collapsed}
              onRefresh={tile?.hasDataBindings ? onTileRefresh : undefined}
              defaultCollapsed={defaultCollapsed}
              assistantId={assistantId}
              stray={tile ? isStrayRootRecord(tile, flagPersonalAsStray) : false}
            />
          </div>
        );
      })}
    </div>
  );
}
