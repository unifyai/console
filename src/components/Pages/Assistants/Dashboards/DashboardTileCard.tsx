'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import { StrayRootBadge } from './StrayRootBadge';
import {
  requestTileExport,
  downloadBlob,
  buildFilename,
} from '@/utils/assistants/capture-tile-html';
import { toast } from 'sonner';

type TileActionMeta = {
  actionName: string;
  label?: string;
  icon?: string | null;
  resultMode?: 'fire_and_forget' | 'show_result';
  functionId?: number;
};

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
  /** Assistant that owns this tile; required to list/dispatch actions */
  assistantId?: string;
  /** Row lives in a root that should be empty (personal root of a team assistant) */
  stray?: boolean;
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

function toCamelAction(raw: Record<string, unknown>): TileActionMeta {
  return {
    actionName: String(raw.action_name ?? raw.actionName ?? ''),
    label: String(raw.label ?? raw.action_name ?? raw.actionName ?? 'Action'),
    icon: (raw.icon as string | null | undefined) ?? null,
    resultMode:
      (raw.result_mode as TileActionMeta['resultMode']) ||
      (raw.resultMode as TileActionMeta['resultMode']) ||
      'fire_and_forget',
    functionId:
      typeof raw.function_id === 'number'
        ? raw.function_id
        : typeof raw.functionId === 'number'
          ? raw.functionId
          : undefined,
  };
}

async function pollRunUntilTerminal(
  assistantId: string,
  runKey: string,
  { timeoutMs = 180_000, intervalMs = 1500 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<{ state: string; resultSummary?: string | null; error?: string | null }> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(
      `/api/assistant/${encodeURIComponent(assistantId)}/dashboard-action-runs/${encodeURIComponent(runKey)}`,
      { cache: 'no-store' }
    );
    if (!response.ok) {
      throw new Error(`Failed to poll action run (${response.status})`);
    }
    const payload = await response.json();
    const run = (payload.run || payload) as Record<string, unknown>;
    const state = String(run.state || '').toLowerCase();
    if (state === 'completed' || state === 'failed' || state === 'cancelled') {
      return {
        state,
        resultSummary:
          (run.result_summary as string | null | undefined) ??
          (run.resultSummary as string | null | undefined) ??
          null,
        error: (run.error as string | null | undefined) ?? null,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for dashboard action result');
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
  assistantId,
  stray = false,
}: DashboardTileCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);
  const [refreshing, setRefreshing] = useState(false);
  const [actions, setActions] = useState<TileActionMeta[]>([]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<{
    title: string;
    body: string;
  } | null>(null);

  useEffect(() => {
    if (defaultCollapsed !== undefined) setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  useEffect(() => {
    if (!assistantId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/assistant/${encodeURIComponent(assistantId)}/dashboard-actions/${encodeURIComponent(token)}`,
          { cache: 'no-store' }
        );
        if (!response.ok) return;
        const payload = await response.json();
        const rows = Array.isArray(payload.actions) ? payload.actions : [];
        if (!cancelled) {
          setActions(
            rows
              .map((row: Record<string, unknown>) => toCamelAction(row))
              .filter((action: TileActionMeta) => Boolean(action.actionName))
          );
        }
      } catch {
        // Action chrome is best-effort; tiles still render without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assistantId, token]);

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

  const handleActionClick = useCallback(
    async (action: TileActionMeta) => {
      if (!assistantId || pendingAction) return;
      setPendingAction(action.actionName);
      try {
        const response = await fetch(
          `/api/assistant/${encodeURIComponent(assistantId)}/dashboard-actions/${encodeURIComponent(token)}/dispatch`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actionName: action.actionName }),
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            String(
              (payload as { detail?: string }).detail || `Dispatch failed (${response.status})`
            )
          );
        }
        const dispatchBody = payload as Record<string, unknown>;
        const runKey = String(dispatchBody.runKey ?? dispatchBody['run_key'] ?? '');
        if (action.resultMode === 'show_result') {
          if (!runKey) {
            throw new Error('Dispatch succeeded but no run_key was returned');
          }
          toast.message(`${action.label || action.actionName} running…`);
          const terminal = await pollRunUntilTerminal(assistantId, runKey);
          if (terminal.state === 'completed') {
            setResultModal({
              title: action.label || action.actionName,
              body: terminal.resultSummary || 'Action completed.',
            });
            toast.success(`${action.label || action.actionName} completed`);
          } else {
            const message = terminal.error || terminal.resultSummary || `Action ${terminal.state}`;
            setResultModal({
              title: `${action.label || action.actionName} failed`,
              body: message,
            });
            toast.error(`${action.label || action.actionName} failed`);
          }
        } else {
          toast.success(`${action.label || action.actionName} started`);
        }
        if (hasDataBindings && onRefresh) {
          await onRefresh();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Action failed');
      } finally {
        setPendingAction(null);
      }
    },
    [assistantId, hasDataBindings, onRefresh, pendingAction, token]
  );

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
        {stray && <StrayRootBadge />}
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

      {actions.length > 0 && (
        <div
          className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-2 py-1"
          data-testid="tile-actions"
        >
          {actions.map((action) => (
            <Button
              key={action.actionName}
              variant="secondary"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px]"
              disabled={Boolean(pendingAction)}
              onClick={() => handleActionClick(action)}
              data-testid={`tile-action-${action.actionName}`}
              title={action.label || action.actionName}
            >
              {pendingAction === action.actionName ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              {action.label || action.actionName}
            </Button>
          ))}
        </div>
      )}

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

      {resultModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          data-testid="tile-action-result-modal"
          onClick={() => setResultModal(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border border-border bg-background p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-title text-semibold">{resultModal.title}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResultModal(null)}
                data-testid="tile-action-result-close"
              >
                Close
              </Button>
            </div>
            <pre className="whitespace-pre-wrap break-words text-xs text-foreground">
              {resultModal.body}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
