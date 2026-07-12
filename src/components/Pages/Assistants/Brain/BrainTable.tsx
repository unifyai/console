'use client';

import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type SortDirection,
} from '@tanstack/react-table';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/UI/table';
import { ScrollArea, ScrollBar } from '@/components/UI/scroll-area';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SKELETON_ROW_WIDTHS = [
  ['40%', '60%', '30%', '55%', '45%', '35%'],
  ['55%', '45%', '50%', '40%', '60%', '30%'],
  ['35%', '50%', '65%', '45%', '35%', '55%'],
  ['60%', '35%', '45%', '50%', '40%', '65%'],
  ['45%', '55%', '35%', '60%', '50%', '40%'],
  ['50%', '40%', '55%', '35%', '65%', '45%'],
  ['30%', '65%', '40%', '55%', '45%', '50%'],
  ['65%', '30%', '50%', '45%', '55%', '35%'],
];

function SkeletonBar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} style={style} />;
}

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {SKELETON_ROW_WIDTHS.map((widths, i) => (
        <TableRow key={i}>
          {Array.from({ length: columns }, (_, j) => (
            <TableCell key={j} className="px-3 py-1.5">
              <SkeletonBar className="h-4" style={{ width: widths[j % widths.length] }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

interface BrainTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  onSort?: (field: string, direction: 'asc' | 'desc' | null) => void;
  onLoadMore?: () => void;
  serverSorting?: { field: string; direction: 'asc' | 'desc' } | null;
  testId?: string;
  getRowEmphasis?: (row: TData) => 'running' | undefined;
}

function SortIcon({ direction }: { direction: false | SortDirection }) {
  if (direction === 'asc') return <ArrowUp className="h-3 w-3" />;
  if (direction === 'desc') return <ArrowDown className="h-3 w-3" />;
  return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
}

export function BrainTable<TData>({
  data,
  columns,
  isLoading,
  isLoadingMore,
  hasMore,
  emptyMessage = 'No data found',
  onRowClick,
  onSort,
  onLoadMore,
  serverSorting,
  testId,
  getRowEmphasis,
}: BrainTableProps<TData>) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  // Mirror server sorting state into TanStack for header indicators
  const sorting: SortingState = React.useMemo(() => {
    if (!serverSorting) return [];
    return [{ id: serverSorting.field, desc: serverSorting.direction === 'desc' }];
  }, [serverSorting]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleHeaderClick = React.useCallback(
    (columnId: string, canSort: boolean) => {
      if (!canSort || !onSort) return;

      const currentSort = serverSorting;

      if (currentSort?.field === columnId) {
        if (currentSort.direction === 'asc') {
          onSort(columnId, 'desc');
        } else {
          onSort(columnId, null);
        }
      } else {
        onSort(columnId, 'asc');
      }
    },
    [onSort, serverSorting]
  );

  // Infinite scroll via IntersectionObserver on a sentinel element
  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !onLoadMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, isLoadingMore]);

  const showEmptyPlaceholder = !isLoading && data.length === 0;

  if (showEmptyPlaceholder) {
    return (
      <div
        className="flex h-full items-center justify-center text-muted-foreground"
        data-testid={testId}
      >
        <p className="text-sm" data-testid="brain-table-empty">
          {emptyMessage}
        </p>
      </div>
    );
  }

  // Sub-tabs with dynamic schemas (Functions) derive their
  // columns from the row payload itself, so `columns` is `[]` on the
  // very first load — before any rows have arrived. Feeding an empty
  // column array to <SkeletonRows /> renders TableRows with zero cells,
  // which paints nothing and makes those sub-tabs look like they're
  // showing an empty pane instead of loading. Bypass the Table chrome
  // entirely in that case and render a generic columns-agnostic
  // shimmer (4 placeholder bars per row) so every brain sub-tab gets
  // a consistent loading affordance. The 4-column choice tracks the
  // typical Functions schema width; fewer rows than the
  // static skeleton above would feel emptier than the static-column
  // sub-tabs, so we reuse the same widths array.
  if (isLoading && columns.length === 0) {
    return (
      <div className="flex h-full flex-col gap-3 p-3" data-testid={testId}>
        {SKELETON_ROW_WIDTHS.map((widths, i) => (
          <div key={i} className="flex items-center gap-3" data-testid="brain-table-skeleton-row">
            {Array.from({ length: 4 }, (_, j) => (
              <SkeletonBar
                key={j}
                className="h-4 flex-1"
                style={{ maxWidth: widths[j % widths.length] }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid={testId}>
      <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/30">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'text-foreground/80 whitespace-nowrap border-b bg-background px-3 py-2',
                      header.column.getCanSort() && onSort && 'cursor-pointer select-none'
                    )}
                    onClick={() => handleHeaderClick(header.column.id, header.column.getCanSort())}
                  >
                    <span className="inline-flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && onSort && (
                        <SortIcon direction={header.column.getIsSorted()} />
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && table.getRowModel().rows.length === 0 ? (
              <SkeletonRows columns={columns.length} />
            ) : (
              table.getRowModel().rows.map((row) => {
                const rowEmphasis = getRowEmphasis?.(row.original);
                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      'transition-colors',
                      onRowClick && 'cursor-pointer',
                      rowEmphasis === 'running'
                        ? 'bg-[color:var(--status-success-bg)] hover:bg-[color:var(--status-success-bg)]'
                        : onRowClick && 'hover:bg-muted'
                    )}
                    onClick={() => onRowClick?.(row.original)}
                    data-testid="brain-table-row"
                    data-row-emphasis={rowEmphasis}
                  >
                    {row.getVisibleCells().map((cell, cellIdx) => {
                      const showRunningAccent = rowEmphasis === 'running' && cellIdx === 0;
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            'max-w-[320px] truncate px-3 py-2 text-xs',
                            showRunningAccent && 'relative pl-5'
                          )}
                        >
                          {showRunningAccent ? (
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute bottom-2 left-0 top-2 w-1 animate-pulse rounded-r-full bg-[color:var(--status-success)] motion-reduce:animate-none"
                              data-testid="brain-running-row-accent"
                            />
                          ) : null}
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {isLoadingMore && (
          <div className="flex items-center justify-center py-3" data-testid="brain-loading-more">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-caption">Loading more…</span>
          </div>
        )}

        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
