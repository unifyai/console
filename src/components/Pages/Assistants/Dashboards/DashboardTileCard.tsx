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
import { ScaledIframe } from './ScaledIframe';

interface DashboardTileCardProps {
  token: string;
  title: string;
  /** Full HTML — may be undefined when content hasn't been lazily loaded yet */
  htmlContent?: string;
  /** Lazy loader: called when the card is first expanded to fetch htmlContent */
  getTileHtml?: (token: string) => Promise<string | null>;
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

export function downloadTileHtml(htmlContent: string, title: string) {
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9\-_ ]/g, '')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function openTileInNewTab(htmlContent: string) {
  const blob = new Blob([htmlContent], { type: 'text/html' });
  window.open(URL.createObjectURL(blob), '_blank');
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
  htmlContent: htmlContentProp,
  getTileHtml,
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
  const [loadedHtml, setLoadedHtml] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const fetchingRef = useRef(false);

  const htmlContent = htmlContentProp ?? loadedHtml;

  useEffect(() => {
    if (defaultCollapsed !== undefined) setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  // Lazily fetch content when expanded and no HTML is available
  useEffect(() => {
    if (collapsed || htmlContent || fetchingRef.current || !getTileHtml) return;

    fetchingRef.current = true;
    setIsLoadingContent(true);

    let cancelled = false;
    getTileHtml(token).then((html) => {
      if (!cancelled) {
        setLoadedHtml(html);
        setIsLoadingContent(false);
        fetchingRef.current = false;
      }
    });
    return () => {
      cancelled = true;
      fetchingRef.current = false;
    };
  }, [collapsed, htmlContent, getTileHtml, token]);

  const handleDownload = useCallback(() => {
    if (htmlContent) downloadTileHtml(htmlContent, title);
  }, [htmlContent, title]);

  const handleOpenTab = useCallback(() => {
    if (htmlContent) openTileInNewTab(htmlContent);
  }, [htmlContent]);

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
  const hasContent = !!htmlContent;

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
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600"
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
          onClick={handleDownload}
          disabled={!hasContent}
          title="Download HTML"
          data-testid="tile-download"
        >
          <Download className="h-2.5 w-2.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={handleOpenTab}
          disabled={!hasContent}
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

      {/* Expanded content */}
      {!collapsed &&
        (hasContent ? (
          fillHeight ? (
            <div className="min-h-0 flex-1">
              <ScaledIframe
                htmlContent={htmlContent}
                title={title}
                initialZoom={1}
                showZoomControls
                className="h-full"
              />
            </div>
          ) : (
            <div style={{ height: contentHeight }}>
              <ScaledIframe
                htmlContent={htmlContent}
                title={title}
                initialZoom={1}
                showZoomControls
                className="h-full"
              />
            </div>
          )
        ) : (
          <div
            className={cn('flex items-center justify-center', fillHeight ? 'min-h-0 flex-1' : '')}
            style={fillHeight ? undefined : { height: contentHeight }}
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Loading tile…</span>
            </div>
          </div>
        ))}
    </div>
  );
}
