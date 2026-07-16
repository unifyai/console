'use client';

import * as React from 'react';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import {
  encodeCommonTextFilter,
  encodeCommonExpressionFilter,
  encodeGroupSorting,
  LOG_METRICS,
  LOG_PAGE_SIZE_OPTIONS,
  type LogViewState,
} from '@/lib/logs';
import { sanitizeId } from '@/lib/logs/columns';
import { LogColumnVisibility } from './LogColumnVisibility';

const MEDIUM_PX = 720;
const WIDE_PX = 960;

export type LogGridToolbarProps = {
  columns: string[];
  view: LogViewState;
  onViewChange: (patch: Partial<LogViewState>) => void;
  commonMode: 'in' | 'expression';
  onCommonModeChange: (mode: 'in' | 'expression') => void;
  commonSearch: string;
  totalCount: number;
  pageStart: number;
  pageEnd: number;
  canPrev: boolean;
  canNext: boolean;
  canDelete: boolean;
  isFetching: boolean;
  onCreateRow: () => void;
  onDeleteRows: () => void;
  onDerivedOpen: () => void;
  /** Observed LogGrid container width (px). */
  containerWidth: number;
};

/**
 * Density-aware LogGrid chrome: primary strip + ··· overflow menu keyed off
 * container width (not the window), so half-pane Data leaves stay one row.
 */
export function LogGridToolbar({
  columns,
  view,
  onViewChange,
  commonMode,
  onCommonModeChange,
  commonSearch,
  totalCount,
  pageStart,
  pageEnd,
  canPrev,
  canNext,
  canDelete,
  isFetching,
  onCreateRow,
  onDeleteRows,
  onDerivedOpen,
  containerWidth,
}: LogGridToolbarProps) {
  const isMedium = containerWidth >= MEDIUM_PX;
  const isWide = containerWidth >= WIDE_PX;

  const showGroupInStrip = isMedium;
  const showMetricInStrip = isMedium;
  const showPageSizeInStrip = isWide;

  const hasOverflowActive = Boolean(view.grouping || view.filters || view.commonFilter);

  const groupSortDesc = view.groupSorting?.includes('@true') ?? false;

  const groupingSelect = (
    <Select
      value={view.grouping || '__none__'}
      onValueChange={(v) =>
        onViewChange({
          grouping: v === '__none__' ? '' : v,
          groupSorting: v === '__none__' ? '' : view.groupSorting,
          offset: 0,
        })
      }
    >
      <SelectTrigger className="h-8 w-[140px]" data-testid="log-grid-group-by">
        <SelectValue placeholder="Group by" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">No grouping</SelectItem>
        {columns.map((c) => (
          <SelectItem key={c} value={c}>
            {sanitizeId(c)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const groupSortSelect = !!view.grouping ? (
    <Select
      value={groupSortDesc ? 'desc' : 'asc'}
      onValueChange={(v) =>
        onViewChange({
          groupSorting: encodeGroupSorting(view.grouping!, v === 'desc'),
          offset: 0,
        })
      }
    >
      <SelectTrigger className="h-8 w-[120px]" data-testid="log-grid-group-sort">
        <SelectValue placeholder="Group sort" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="asc">Group asc</SelectItem>
        <SelectItem value="desc">Group desc</SelectItem>
      </SelectContent>
    </Select>
  ) : null;

  const metricSelect = (
    <Select value={view.metric || 'mean'} onValueChange={(metric) => onViewChange({ metric })}>
      <SelectTrigger className="h-8 w-[110px]" data-testid="log-grid-metric">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOG_METRICS.map((m) => (
          <SelectItem key={m} value={m}>
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const pageSizeSelect = (
    <Select
      value={String(view.limit)}
      onValueChange={(v) => onViewChange({ limit: Number(v), offset: 0 })}
    >
      <SelectTrigger className="h-8 w-[88px]" data-testid="log-grid-page-size">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOG_PAGE_SIZE_OPTIONS.map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n}/page
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div
      className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto border-b border-border px-4 py-2"
      data-testid="log-grid-toolbar"
    >
      <Select
        value={commonMode}
        onValueChange={(v) => onCommonModeChange(v as 'in' | 'expression')}
      >
        <SelectTrigger className="h-8 w-[110px] shrink-0" data-testid="log-grid-common-mode">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="in">Search</SelectItem>
          <SelectItem value="expression">Expression</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={commonSearch}
        onChange={(e) =>
          onViewChange({
            commonFilter:
              commonMode === 'expression'
                ? encodeCommonExpressionFilter(e.target.value)
                : encodeCommonTextFilter(e.target.value),
            offset: 0,
          })
        }
        placeholder={commonMode === 'expression' ? 'filter expression…' : 'Search all columns…'}
        className="h-8 min-w-[8rem] max-w-xs shrink font-mono"
        data-testid="log-grid-common-filter"
      />
      <LogColumnVisibility
        columns={view.columnOrder.length ? view.columnOrder : columns}
        hiddenColumns={view.hiddenColumns}
        onChange={(hiddenColumns) => onViewChange({ hiddenColumns })}
      />

      {showGroupInStrip && groupingSelect}
      {showGroupInStrip && groupSortSelect}
      {showMetricInStrip && metricSelect}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={hasOverflowActive ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            aria-label="More table controls"
            data-testid="log-grid-more"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {(!showGroupInStrip || !showMetricInStrip) && (
            <>
              <DropdownMenuLabel>View</DropdownMenuLabel>
              {!showGroupInStrip && (
                <div className="space-y-1.5 px-2 py-1.5">
                  {groupingSelect}
                  {groupSortSelect}
                </div>
              )}
              {!showMetricInStrip && <div className="px-2 py-1.5">{metricSelect}</div>}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuLabel>Rows</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onDerivedOpen()} data-testid="log-grid-derived-open">
            <Plus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Derived column
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCreateRow()} data-testid="log-grid-create-row">
            <Plus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            New row
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onDeleteRows()}
              data-testid="log-grid-delete-row"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Delete selected
            </DropdownMenuItem>
          )}

          {!showPageSizeInStrip && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Layout</DropdownMenuLabel>
              <div className="px-2 py-1.5">{pageSizeSelect}</div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {isFetching && (
        <span
          className="text-caption shrink-0 text-muted-foreground"
          data-testid="log-grid-fetching"
        >
          Updating…
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {showPageSizeInStrip && pageSizeSelect}
        <span className="text-caption text-muted-foreground" data-testid="log-grid-page-status">
          {totalCount === 0
            ? '0 rows'
            : `${pageStart + 1}–${pageEnd} of ${totalCount.toLocaleString()}`}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={!canPrev}
          onClick={() => onViewChange({ offset: Math.max(0, view.offset - view.limit) })}
          data-testid="log-grid-prev"
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={!canNext}
          onClick={() => onViewChange({ offset: view.offset + view.limit })}
          data-testid="log-grid-next"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/** Hook: observe element width for toolbar density tiers. */
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

export { MEDIUM_PX, WIDE_PX };
