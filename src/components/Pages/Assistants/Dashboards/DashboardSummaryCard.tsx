'use client';

import React, { useState, useCallback } from 'react';
import { ExternalLink, Download, LayoutGrid, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { USE_MOCK_DASHBOARDS } from '@/utils/assistants/dashboard-mock-data';
import type { DashboardRecord, DashboardTilePosition } from '@/types/assistants/dashboard';
import { parseDashboardLayout } from '@/utils/assistants/parse-dashboard-layout';

interface DashboardSummaryCardProps {
  dashboard: DashboardRecord;
  /** Lazy loader – fetches a single tile's HTML by token */
  getTileHtml: (token: string) => Promise<string | null>;
  /** Rendered inside the card below the metadata/actions — typically the tile list */
  children?: React.ReactNode;
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

function sanitiseFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_ ]/g, '').trim() || 'tile';
}

async function downloadTilesAsZip(
  dashboard: DashboardRecord,
  positions: DashboardTilePosition[],
  getTileHtml: (token: string) => Promise<string | null>
) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const results = await Promise.all(
    positions.map(async (pos, idx) => {
      const html = await getTileHtml(pos.tileToken);
      return { token: pos.tileToken, html, idx };
    })
  );

  for (const { token, html, idx } of results) {
    if (html) {
      zip.file(`${sanitiseFilename(token)}-${idx + 1}.html`, html);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitiseFilename(dashboard.title)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildDashboardHtml(
  title: string,
  description: string | null,
  tileHtmls: { html: string; pos: DashboardTilePosition }[]
): string {
  const gridCols = 12;
  const rowHeight = 120;
  const gap = 12;

  const tiles = tileHtmls
    .map(({ html, pos }) => {
      const left = (pos.x / gridCols) * 100;
      const width = (pos.w / gridCols) * 100;
      const top = pos.y * (rowHeight + gap);
      const height = pos.h * rowHeight + (pos.h - 1) * gap;
      return `<div style="position:absolute;left:${left}%;width:${width}%;top:${top}px;height:${height}px;padding:${gap / 2}px;">
        <iframe srcdoc="${html.replace(/"/g, '&quot;')}" style="width:100%;height:100%;border:1px solid rgb(226,232,240);border-radius:8px;" sandbox="allow-scripts"></iframe>
      </div>`;
    })
    .join('\n');

  const maxBottom = tileHtmls.reduce((max, { pos }) => {
    const bottom = pos.y * (rowHeight + gap) + pos.h * rowHeight + (pos.h - 1) * gap;
    return Math.max(max, bottom);
  }, 0);

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:rgb(248,250,252);padding:24px}
header{border-bottom:1px solid rgb(226,232,240);padding-bottom:12px;margin-bottom:16px}
h1{font-size:18px;font-weight:700;color:rgb(30,41,59)}p{font-size:13px;color:rgb(100,116,139);margin-top:4px}</style>
</head><body>
<header><h1>${title}</h1>${description ? `<p>${description}</p>` : ''}</header>
<div style="position:relative;height:${maxBottom + gap}px;">${tiles}</div>
</body></html>`;
}

export function DashboardSummaryCard({
  dashboard,
  getTileHtml,
  children,
}: DashboardSummaryCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isOpeningTab, setIsOpeningTab] = useState(false);

  const positions = parseDashboardLayout(dashboard.layout);
  const tileCount = dashboard.tileCount || positions.length;
  const updatedLabel = formatDate(dashboard.updatedAt);
  const createdLabel = formatDate(dashboard.createdAt);

  const handleOpenInNewTab = useCallback(async () => {
    if (!USE_MOCK_DASHBOARDS) {
      window.open(`/dashboard/view/${dashboard.token}`, '_blank');
      return;
    }
    if (positions.length === 0) return;
    setIsOpeningTab(true);
    try {
      const tileHtmls = (
        await Promise.all(
          positions.map(async (pos) => {
            const html = await getTileHtml(pos.tileToken);
            return html ? { html, pos } : null;
          })
        )
      ).filter((r): r is { html: string; pos: DashboardTilePosition } => r !== null);

      const page = buildDashboardHtml(dashboard.title, dashboard.description, tileHtmls);
      const blob = new Blob([page], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');
    } finally {
      setIsOpeningTab(false);
    }
  }, [dashboard, positions, getTileHtml]);

  const handleDownloadZip = useCallback(async () => {
    if (positions.length === 0) return;
    setIsDownloading(true);
    try {
      await downloadTilesAsZip(dashboard, positions, getTileHtml);
    } finally {
      setIsDownloading(false);
    }
  }, [dashboard, positions, getTileHtml]);

  return (
    <div
      className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 shadow-sm"
      data-testid="dashboard-summary-card"
    >
      {/* Title & description */}
      <div className="space-y-1">
        <h3 className="text-label text-semibold">{dashboard.title}</h3>
        {dashboard.description && (
          <p className="text-body-muted leading-relaxed">{dashboard.description}</p>
        )}
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <LayoutGrid className="h-3 w-3" />
          {tileCount} {tileCount === 1 ? 'tile' : 'tiles'}
        </span>
        {(updatedLabel || createdLabel) && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {updatedLabel ? `Updated ${updatedLabel}` : `Created ${createdLabel}`}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleOpenInNewTab}
          disabled={isOpeningTab || positions.length === 0}
          title="Open dashboard in a new tab"
          data-testid="dashboard-open-tab"
        >
          {isOpeningTab ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ExternalLink className="h-3 w-3" />
          )}
          {isOpeningTab ? 'Opening…' : 'Open in new tab'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleDownloadZip}
          disabled={isDownloading || positions.length === 0}
          title="Download all tiles as a ZIP archive"
          data-testid="dashboard-download-zip"
        >
          {isDownloading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          {isDownloading ? 'Downloading…' : 'Download all tiles'}
        </Button>
      </div>

      {/* Tile list (rendered inside the card border) */}
      {children && (
        <>
          <div className="border-t border-border" />
          {children}
        </>
      )}
    </div>
  );
}
