'use client';

import * as React from 'react';
import {
  Check,
  MoreHorizontal,
  PanelRight,
  Plus,
  RefreshCw,
  Repeat,
  Snowflake,
  Timer,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import {
  encodeCommonTextFilter,
  formatFreezeTimestamp,
  parseGrouping,
  type LogViewState,
} from '@/lib/logs';
import { cn } from '@/lib/utils';
import { LogColumnVisibility } from './LogColumnVisibility';

export type LogRefreshMode = 'refresh' | 'freeze' | 'live';

export type LogGridToolbarProps = {
  columns: string[];
  view: LogViewState;
  onViewChange: (patch: Partial<LogViewState>) => void;
  commonSearch: string;
  loadedCount: number;
  totalCount: number;
  canDelete: boolean;
  isFetching: boolean;
  onDeleteRows: () => void;
  /** One-shot refetch (Refresh mode / Refresh action). */
  onRefresh?: () => void;
  /** Opens the derived-column create dialog. */
  onAddDerivedColumn?: () => void;
  /** Whether any cells are currently selected (enables the view-pane toggle). */
  hasSelection?: boolean;
  /** Whether the cell view pane is open. */
  viewPanelOpen?: boolean;
  onToggleViewPanel?: () => void;
};

function currentRefreshMode(view: LogViewState): LogRefreshMode {
  if (view.autoUpdate) return 'live';
  if (view.freeze) return 'freeze';
  return 'refresh';
}

/**
 * LogGrid chrome: search, columns, refresh/freeze/live, derived +, optional delete,
 * loaded-row status, and a right-pinned cell view-pane toggle.
 */
export function LogGridToolbar({
  columns,
  view,
  onViewChange,
  commonSearch,
  loadedCount,
  totalCount,
  canDelete,
  isFetching,
  onDeleteRows,
  onRefresh,
  onAddDerivedColumn,
  hasSelection = false,
  viewPanelOpen = false,
  onToggleViewPanel,
}: LogGridToolbarProps) {
  const viewToggleEnabled = hasSelection && !!onToggleViewPanel;
  const viewToggleLabel = !hasSelection
    ? 'Select cells to open the view pane'
    : viewPanelOpen
      ? 'Hide cell view'
      : 'Show cell view';

  const mode = currentRefreshMode(view);
  const groupingActive = parseGrouping(view.grouping).length > 0;
  const freezeTooltip = view.freeze
    ? `Get latest logs. (Current freeze: ${view.freeze})`
    : 'Only get logs before freeze';
  const liveTooltip = groupingActive
    ? "Auto refresh doesn't work with grouping"
    : 'Auto refresh every 5s';

  const selectMode = (next: LogRefreshMode) => {
    if (next === 'refresh') {
      onViewChange({ autoUpdate: false, freeze: undefined, offset: 0 });
      onRefresh?.();
      return;
    }
    if (next === 'freeze') {
      onViewChange({
        autoUpdate: false,
        freeze: formatFreezeTimestamp(),
        offset: 0,
      });
      return;
    }
    if (groupingActive) return;
    onViewChange({ autoUpdate: true, freeze: undefined, offset: 0 });
  };

  return (
    <div
      className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto border-b border-border px-4 py-2"
      data-testid="log-grid-toolbar"
    >
      <Input
        value={commonSearch}
        onChange={(e) =>
          onViewChange({
            commonFilter: encodeCommonTextFilter(e.target.value),
            offset: 0,
          })
        }
        placeholder="Search..."
        className="h-8 min-w-[8rem] max-w-xs shrink font-mono"
        data-testid="log-grid-common-filter"
      />
      <LogColumnVisibility
        columns={view.columnOrder.length ? view.columnOrder : columns}
        hiddenColumns={view.hiddenColumns}
        onChange={(hiddenColumns) => onViewChange({ hiddenColumns })}
      />

      <DropdownMenu modal={false}>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant={mode === 'refresh' ? 'outline' : 'primary'}
                  size="sm"
                  className={cn(
                    'h-8 w-8 shrink-0 p-0',
                    mode === 'live' && isFetching && 'text-primary-foreground'
                  )}
                  aria-label="Refresh mode"
                  data-testid="log-grid-refresh-mode"
                >
                  <Repeat
                    className={cn('h-3.5 w-3.5', mode === 'live' && isFetching && 'animate-spin')}
                    aria-hidden="true"
                  />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {mode === 'live'
                  ? 'Auto-refreshing…'
                  : mode === 'freeze'
                    ? freezeTooltip
                    : 'Refresh logs'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="start" className="min-w-[11rem]">
          <DropdownMenuItem
            className="text-body-sm gap-2"
            data-testid="log-grid-refresh-mode-refresh"
            title="Refresh logs"
            onClick={() => selectMode('refresh')}
          >
            <span className="flex w-3.5 shrink-0 justify-center">
              {mode === 'refresh' ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-body-sm gap-2"
            data-testid="log-grid-refresh-mode-freeze"
            title={freezeTooltip}
            onClick={() => selectMode('freeze')}
          >
            <span className="flex w-3.5 shrink-0 justify-center">
              {mode === 'freeze' ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <Snowflake className="h-3.5 w-3.5" />
            Freeze
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-body-sm gap-2"
            data-testid="log-grid-refresh-mode-live"
            disabled={groupingActive}
            title={liveTooltip}
            onClick={() => selectMode('live')}
          >
            <span className="flex w-3.5 shrink-0 justify-center">
              {mode === 'live' ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <Timer className="h-3.5 w-3.5" />
            Live
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {onAddDerivedColumn && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                onClick={onAddDerivedColumn}
                aria-label="Add derived column"
                data-testid="log-grid-derived-open"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Add derived column</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {canDelete && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              aria-label="More table controls"
              data-testid="log-grid-more"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onDeleteRows()}
              data-testid="log-grid-delete-row"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Delete selected
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {isFetching && (
        <span
          className="text-caption shrink-0 text-muted-foreground"
          data-testid="log-grid-fetching"
        >
          Updating…
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="text-caption text-muted-foreground" data-testid="log-grid-page-status">
          {totalCount === 0 ? '0 rows' : `1–${loadedCount} of ${totalCount.toLocaleString()}`}
        </span>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <Button
                  type="button"
                  variant={viewPanelOpen && hasSelection ? 'primary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-8 w-8 shrink-0 p-0 text-muted-foreground',
                    viewToggleEnabled && !viewPanelOpen && 'hover:text-foreground',
                    !viewToggleEnabled && 'cursor-not-allowed opacity-40'
                  )}
                  disabled={!viewToggleEnabled}
                  onClick={() => onToggleViewPanel?.()}
                  aria-label={viewToggleLabel}
                  aria-pressed={viewPanelOpen && hasSelection}
                  data-testid="log-grid-view-panel-toggle"
                >
                  <PanelRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                {hasSelection && !viewPanelOpen && (
                  <span
                    data-testid="log-grid-view-panel-dot"
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-card"
                  />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{viewToggleLabel}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

/** Hook: observe element width for density-aware chrome. */
export function useContainerWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = React.useState(1200);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(w);
    };
    update();
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === 'number' && w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
