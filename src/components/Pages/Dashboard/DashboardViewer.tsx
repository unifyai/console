/**
 * DashboardViewer Component
 *
 * Renders a responsive grid of tile iframes using react-grid-layout.
 * Each tile is loaded via its own /tile/view/[token]?embed=true URL.
 */

'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { Download, Loader2 } from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import { Button } from '@/components/UI/button';
import {
  requestTileExport,
  downloadBlob,
  buildFilename,
} from '@/utils/assistants/capture-tile-html';

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
  token: string;
  title: string;
  description: string | null;
  tiles: TilePosition[];
  embed?: boolean;
}

const ROW_HEIGHT = 120;
const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
const GRID_MARGIN: [number, number] = [12, 12];

function TileFrame({ token, onReady }: { token: string; onReady?: () => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const readyFired = useRef(false);

  const markReady = useCallback(() => {
    setIsLoading(false);
    if (!readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  }, [onReady]);

  const handleLoad = useCallback(() => markReady(), [markReady]);

  useEffect(() => {
    setIsLoading(true);
    readyFired.current = false;
    const maxWait = window.setTimeout(() => markReady(), 100_000);
    return () => window.clearTimeout(maxWait);
  }, [token, markReady]);

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
          <Loader size={20} />
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

/**
 * Find the tile iframe by its title attribute and request the rendered HTML
 * via postMessage export channel.
 */
async function captureTileFromDom(tileToken: string) {
  const iframe = document.querySelector(
    `iframe[title="Tile ${tileToken}"]`
  ) as HTMLIFrameElement | null;
  if (!iframe) return null;
  try {
    return await requestTileExport(iframe);
  } catch {
    return null;
  }
}

export function DashboardViewer({ token, title, description, tiles, embed }: DashboardViewerProps) {
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

  const readyCount = useRef(0);
  const [allReady, setAllReady] = useState(tiles.length === 0);
  const totalTiles = tiles.length;

  const handleTileReady = useCallback(() => {
    readyCount.current += 1;
    if (readyCount.current >= totalTiles) {
      setAllReady(true);
    }
  }, [totalTiles]);

  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadHtmlZip = useCallback(async () => {
    if (tiles.length === 0) return;
    setIsExporting(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (const tile of tiles) {
        const captured = await captureTileFromDom(tile.tileToken);
        if (captured) {
          zip.file(
            buildFilename(captured.title || tile.tileToken, tile.tileToken, 'html'),
            captured.html
          );
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, buildFilename(title, token, 'zip'));
    } finally {
      setIsExporting(false);
    }
  }, [tiles, title, token]);

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
        <header className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <h1 className="text-title text-semibold text-foreground">{title}</h1>
            {description && <p className="text-body-muted mt-1">{description}</p>}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-4 h-7 shrink-0 gap-1.5 text-xs"
            disabled={isExporting || !allReady}
            onClick={handleDownloadHtmlZip}
          >
            {isExporting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            {allReady ? 'Download' : 'Loading tiles…'}
          </Button>
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
              <TileFrame token={tile.tileToken} onReady={handleTileReady} />
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
