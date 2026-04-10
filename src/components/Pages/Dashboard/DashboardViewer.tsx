/**
 * DashboardViewer Component
 *
 * Renders a responsive grid of tile iframes using react-grid-layout.
 * Each tile is loaded via its own /tile/view/[token]?embed=true URL.
 */

'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { Loader2 } from 'lucide-react';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface TilePosition {
  tileToken: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DashboardViewerProps {
  title: string;
  description: string | null;
  tiles: TilePosition[];
  embed?: boolean;
}

const ROW_HEIGHT = 120;
const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
const GRID_MARGIN: [number, number] = [12, 12];

function TileFrame({ token }: { token: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const handleLoad = useCallback(() => setIsLoading(false), []);

  useEffect(() => {
    setIsLoading(true);
    const maxWait = window.setTimeout(() => setIsLoading(false), 100_000);
    return () => window.clearTimeout(maxWait);
  }, [token]);

  if (!token || token === 'undefined') {
    return (
      <div className="bg-muted/30 text-body-muted flex h-full min-h-[120px] items-center justify-center rounded-lg border border-border px-2 text-center text-sm">
        Invalid tile reference in layout
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <iframe
        src={`/tile/view/${token}?embed=true`}
        className="h-full w-full border-0"
        title={`Tile ${token}`}
        sandbox="allow-scripts allow-same-origin"
        onLoad={handleLoad}
      />
    </div>
  );
}

export function DashboardViewer({ title, description, tiles, embed }: DashboardViewerProps) {
  const layouts = useMemo<{ lg: Layout[] }>(() => {
    const lg: Layout[] = tiles.map((t) => ({
      i: t.tileToken,
      x: t.x,
      y: t.y,
      w: t.w,
      h: t.h,
      static: true,
    }));
    return { lg };
  }, [tiles]);

  if (tiles.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">This dashboard has no tiles.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {!embed && (
        <header className="border-b border-border px-4 py-3">
          <h1 className="text-title text-semibold text-foreground">{title}</h1>
          {description && <p className="text-body-muted mt-1">{description}</p>}
        </header>
      )}
      <div className={embed ? '' : 'p-4'}>
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={GRID_COLS}
          rowHeight={ROW_HEIGHT}
          margin={GRID_MARGIN}
          isDraggable={false}
          isResizable={false}
          compactType="vertical"
        >
          {tiles.map((tile) => (
            <div key={tile.tileToken}>
              <TileFrame token={tile.tileToken} />
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
