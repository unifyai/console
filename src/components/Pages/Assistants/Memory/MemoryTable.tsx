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

interface MemoryTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  totalCount: number;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  onLoadMore?: () => void;
  serverSorting?: { field: string; direction: 'asc' | 'desc' } | null;
  testId?: string;
}

function SortIcon({ direction }: { direction: false | SortDirection }) {
  if (direction === 'asc') return <ArrowUp className="h-3 w-3" />;
  if (direction === 'desc') return <ArrowDown className="h-3 w-3" />;
  return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
}

export function MemoryTable<TData>({
  data,
  columns,
  totalCount,
  isLoading,
  isLoadingMore,
  hasMore,
  emptyMessage = 'No data.',
  onRowClick,
  onSort,
  onLoadMore,
  serverSorting,
  testId,
}: MemoryTableProps<TData>) {
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
      let newDirection: 'asc' | 'desc';

      if (currentSort?.field === columnId) {
        newDirection = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        newDirection = 'asc';
      }

      onSort(columnId, newDirection);
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

  const rowCount = data.length;

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
                      'whitespace-nowrap border-b bg-background px-3 py-2',
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
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted' : undefined}
                  onClick={() => onRowClick?.(row.original)}
                  data-testid="memory-table-row"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="max-w-[300px] truncate whitespace-nowrap px-3 py-1.5 text-xs"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <span className="text-body-muted text-sm">{emptyMessage}</span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {isLoadingMore && (
          <div className="flex items-center justify-center py-3" data-testid="memory-loading-more">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-caption">Loading more…</span>
          </div>
        )}

        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Footer — count */}
      {rowCount > 0 && (
        <div
          className="flex shrink-0 items-center justify-between border-t px-3 py-1.5"
          data-testid="memory-table-footer"
        >
          <span className="text-caption">
            {rowCount} of {totalCount} {totalCount === 1 ? 'row' : 'rows'}
          </span>
          {hasMore && <span className="text-caption">Scroll for more</span>}
        </div>
      )}
    </div>
  );
}
