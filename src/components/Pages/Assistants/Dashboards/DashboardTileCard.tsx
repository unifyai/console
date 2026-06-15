'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import {
  requestTileExport,
  downloadBlob,
  buildFilename,
} from '@/utils/assistants/capture-tile-html';

interface DashboardTileCardProps {
  token: string;
  title: string;
  /** Raw HTML fallback for download if export postMessage fails */
  htmlContent?: string;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  hasDataBindings?: boolean;
  /** Height in pixels for the iframe content area when expanded (ignored if fillHeight) */
  contentHeight?: number;
  /** When true the card stretches to fill its parent flex container */
  fillHeight?: boolean;
  /** Called when the user clicks the per-tile refresh button (data-bound tiles only) */
  onRefresh?: () => void;
  /** Parent-driven collapse signal — syncs local state when it changes */
  defaultCollapsed?: boolean;
}

function formatShortDate(iso: string | null | undefined): string | null {
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

export function DashboardTileCard({
  token,
  title,
  htmlContent,
  description,
  createdAt,
  updatedAt,
  hasDataBindings,
  contentHeight = 320,
  fillHeight = false,
  onRefresh,
  defaultCollapsed,
}: DashboardTileCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (defaultCollapsed !== undefined) setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadHtml = useCallback(async () => {
    const filename = buildFilename(title, token, 'html');
    if (iframeRef.current) {
      setIsExporting(true);
      try {
        const capture = await requestTileExport(iframeRef.current);
        downloadBlob(new Blob([capture.html], { type: 'text/html' }), filename);
        return;
      } catch {
        /* fall through to raw htmlContent fallback */
      } finally {
        setIsExporting(false);
      }
    }
    if (htmlContent) {
      downloadBlob(new Blob([htmlContent], { type: 'text/html' }), filename);
    }
  }, [htmlContent, title, token]);

  const handleOpenTab = useCallback(() => {
    window.open(`/tile/view/${token}`, '_blank');
  }, [token]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const updatedLabel = formatShortDate(updatedAt);
  const createdLabel = formatShortDate(createdAt);

  return (
    <div
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm',
        fillHeight && 'min-h-0 flex-1'
      )}
    >
      {/* Header bar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
          data-testid="tile-collapse-toggle"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
        <span className="text-label min-w-0 flex-1 truncate text-foreground">{title}</span>
        {hasDataBindings && (
          <span
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-[color:var(--status-success-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--status-success)]"
            title="Live data binding"
          >
            <Activity className="h-2.5 w-2.5" />
            Live
          </span>
        )}
        {hasDataBindings && onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh data"
            data-testid="tile-refresh"
          >
            <RefreshCw className={cn('h-2.5 w-2.5', refreshing && 'animate-spin')} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          disabled={isExporting}
          onClick={handleDownloadHtml}
          title="Download"
          data-testid="tile-download"
        >
          {isExporting ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <Download className="h-2.5 w-2.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={handleOpenTab}
          title="Open in new tab"
          data-testid="tile-open-tab"
        >
          <ExternalLink className="h-2.5 w-2.5" />
        </Button>
      </div>

      {/* Collapsed metadata */}
      {collapsed && (description || createdLabel || updatedLabel) && (
        <div className="space-y-0.5 px-3 py-1.5">
          {description && <p className="text-caption truncate">{description}</p>}
          {(createdLabel || updatedLabel) && (
            <p className="text-muted-foreground/70 text-[10px] italic">
              {updatedLabel ? `Updated ${updatedLabel}` : `Created ${createdLabel}`}
            </p>
          )}
        </div>
      )}

      {/* Expanded content — all tiles render via the /tile/view route for CSP isolation */}
      {!collapsed && (
        <div
          className={cn(fillHeight ? 'min-h-0 flex-1' : '')}
          style={fillHeight ? undefined : { height: contentHeight }}
        >
          <iframe
            ref={iframeRef}
            src={`/tile/view/${token}?embed=true`}
            className="h-full w-full border-0"
            title={title}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      )}
    </div>
  );
}
