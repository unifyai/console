'use client';

import * as React from 'react';
import type { ColumnDef, SortingState, OnChangeFn } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/UI/table';
import { ScrollArea, ScrollBar } from '@/components/UI/scroll-area';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { SkeletonTable } from '@/components/Common/Loaders/Skeletons';
import { cn } from '@/lib/utils';
import {
  encodeCommonTextFilter,
  type LogFieldsResponseProps,
  type LogGridRow,
  type LogViewState,
  type SelectionModel,
} from '@/lib/logs';
import { sanitizeId, visibleColumnIds } from '@/lib/logs/columns';
import { LogColumnVisibility } from './LogColumnVisibility';
import { LogColumnFilter } from './LogColumnFilter';
import { LogDerivedColumnDialog, LogDerivedColumnTrigger } from './LogDerivedColumnDialog';

function displayCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export interface LogGridProps {
  projectName: string;
  context: string;
  rows: LogGridRow[];
  fields: LogFieldsResponseProps;
  /** All known column ids (flat field names for Data). */
  columns: string[];
  totalCount: number;
  view: LogViewState;
  onViewChange: (patch: Partial<LogViewState>) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  selection?: SelectionModel;
  onRowActivate?: (row: LogGridRow) => void;
  onDerivedCreated?: () => void;
  className?: string;
  testId?: string;
}

export function LogGrid({
  projectName,
  context,
  rows,
  fields,
  columns,
  totalCount,
  view,
  onViewChange,
  isLoading = false,
  isFetching = false,
  selection,
  onRowActivate,
  onDerivedCreated,
  className,
  testId = 'log-grid',
}: LogGridProps) {
  const [derivedOpen, setDerivedOpen] = React.useState(false);
  const tableName = context.split('/').pop() ?? 'Table';

  // Ensure columnOrder covers all known columns (once when columns grow)
  const orderKey = columns.join('\0');
  const lastOrderKey = React.useRef('');
  React.useEffect(() => {
    if (!columns.length || orderKey === lastOrderKey.current) return;
    lastOrderKey.current = orderKey;
    const order = view.columnOrder.length
      ? [
          ...view.columnOrder.filter((id) => columns.includes(id)),
          ...columns.filter((id) => !view.columnOrder.includes(id)),
        ]
      : columns;
    const same =
      order.length === view.columnOrder.length &&
      order.every((id, i) => id === view.columnOrder[i]);
    if (!same) {
      onViewChange({ columnOrder: order });
    }
  }, [columns, orderKey, view.columnOrder, onViewChange]);

  const visible = visibleColumnIds(
    view.columnOrder.length ? view.columnOrder : columns,
    view.hiddenColumns
  );

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(view.sorting) : updater;
    onViewChange({ sorting: next, offset: 0 });
  };

  const onViewChangeRef = React.useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  const columnDefs = React.useMemo<ColumnDef<LogGridRow>[]>(() => {
    return visible.map((key) => {
      const fieldKey = sanitizeId(key);
      const meta = fields[key] ?? fields[fieldKey];
      return {
        id: key,
        accessorFn: (row) => row.entries[fieldKey] ?? row.entries[key],
        header: ({ column }) => {
          const sorted = column.getIsSorted();
          return (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 h-7 px-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => column.toggleSorting(sorted === 'asc')}
                data-testid={`log-grid-sort-${fieldKey}`}
              >
                <span>{fieldKey}</span>
                {sorted === 'desc' ? (
                  <ArrowDown className="ml-1 h-3 w-3" aria-hidden="true" />
                ) : sorted === 'asc' ? (
                  <ArrowUp className="ml-1 h-3 w-3" aria-hidden="true" />
                ) : (
                  <ChevronsUpDown className="ml-1 h-3 w-3 opacity-60" aria-hidden="true" />
                )}
              </Button>
              <LogColumnFilter
                column={key}
                dataType={meta?.dataType}
                filters={view.filters}
                onChange={(filters) => onViewChangeRef.current({ filters, offset: 0 })}
              />
            </div>
          );
        },
        cell: ({ row }) => {
          const raw = row.getValue(key);
          const text = displayCellValue(raw);
          return (
            <span className="block truncate" title={text}>
              {text}
            </span>
          );
        },
        enableSorting: true,
      };
    });
  }, [visible, fields, view.filters]);

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { sorting: view.sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    getRowId: (row) => String(row.logId),
  });

  const pageStart = view.offset;
  const pageEnd = Math.min(view.offset + rows.length, totalCount);
  const canPrev = view.offset > 0;
  const canNext = view.offset + view.limit < totalCount;

  const commonSearch =
    view.commonFilter.startsWith('in§') || view.commonFilter.startsWith('expression§')
      ? view.commonFilter.split('§').slice(1).join('§')
      : '';

  const selectedRowId = selection?.mode === 'row' ? selection.selectedRowId : null;

  if (isLoading && rows.length === 0) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col', className)} data-testid={testId}>
        <SkeletonTable rows={8} cols={Math.max(visible.length, 4)} />
      </div>
    );
  }

  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
      data-testid={testId}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <Input
          value={commonSearch}
          onChange={(e) =>
            onViewChange({
              commonFilter: encodeCommonTextFilter(e.target.value),
              offset: 0,
            })
          }
          placeholder="Search all columns…"
          className="h-8 max-w-xs"
          data-testid="log-grid-common-filter"
        />
        <LogColumnVisibility
          columns={view.columnOrder.length ? view.columnOrder : columns}
          hiddenColumns={view.hiddenColumns}
          onChange={(hiddenColumns) => onViewChange({ hiddenColumns })}
        />
        <LogDerivedColumnTrigger onClick={() => setDerivedOpen(true)} />
        {isFetching && (
          <span className="text-caption text-muted-foreground" data-testid="log-grid-fetching">
            Updating…
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
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

      {!isLoading && rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-body-muted">No rows match the current filters.</p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="overflow-hidden border-b border-border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="h-8 whitespace-nowrap px-2.5 text-[11px] text-muted-foreground"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => {
                  const isSelected = selectedRowId === String(row.original.logId);
                  return (
                    <TableRow
                      key={row.id}
                      data-testid={`log-grid-row-${row.original.logId}`}
                      className={cn('cursor-pointer', isSelected && 'bg-muted/60')}
                      onClick={() => {
                        if (selection?.mode === 'row') {
                          selection.onSelectRow(String(row.original.logId));
                        }
                        onRowActivate?.(row.original);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (selection?.mode === 'row') {
                            selection.onSelectRow(String(row.original.logId));
                          }
                          onRowActivate?.(row.original);
                        }
                      }}
                      tabIndex={0}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="max-w-[220px] truncate px-2.5 py-1.5 font-mono text-[12px]"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <LogDerivedColumnDialog
        open={derivedOpen}
        onOpenChange={setDerivedOpen}
        projectName={projectName}
        context={context}
        tableName={tableName}
        columns={columns}
        onCreated={() => onDerivedCreated?.()}
      />
    </div>
  );
}
