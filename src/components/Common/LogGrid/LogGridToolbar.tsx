'use client';

import * as React from 'react';
import { MoreHorizontal, PanelRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { encodeCommonTextFilter, type LogViewState } from '@/lib/logs';
import { cn } from '@/lib/utils';
import { LogColumnVisibility } from './LogColumnVisibility';

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
  /** Whether any cells are currently selected (enables the view-pane toggle). */
  hasSelection?: boolean;
  /** Whether the cell view pane is open. */
  viewPanelOpen?: boolean;
  onToggleViewPanel?: () => void;
};

/**
 * LogGrid chrome: search, columns, optional delete overflow, loaded-row status,
 * and a right-pinned cell view-pane toggle.
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
