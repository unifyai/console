'use client';

import * as React from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { encodeCommonTextFilter, LOG_PAGE_SIZE_OPTIONS, type LogViewState } from '@/lib/logs';
import { LogColumnVisibility } from './LogColumnVisibility';

export type LogGridToolbarProps = {
  columns: string[];
  view: LogViewState;
  onViewChange: (patch: Partial<LogViewState>) => void;
  commonSearch: string;
  totalCount: number;
  pageStart: number;
  pageEnd: number;
  canPrev: boolean;
  canNext: boolean;
  canDelete: boolean;
  isFetching: boolean;
  onDeleteRows: () => void;
};

/**
 * LogGrid chrome: search, columns, optional delete overflow, page size, pagination.
 */
export function LogGridToolbar({
  columns,
  view,
  onViewChange,
  commonSearch,
  totalCount,
  pageStart,
  pageEnd,
  canPrev,
  canNext,
  canDelete,
  isFetching,
  onDeleteRows,
}: LogGridToolbarProps) {
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
        placeholder="Search all columns…"
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
