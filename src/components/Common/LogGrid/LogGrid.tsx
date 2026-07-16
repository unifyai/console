'use client';

import * as React from 'react';
import type {
  ColumnDef,
  ColumnPinningState,
  ColumnSizingState,
  SortingState,
  OnChangeFn,
} from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Snowflake,
  Radio,
  Pin,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/UI/table';
import { ScrollArea, ScrollBar } from '@/components/UI/scroll-area';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { SkeletonTable } from '@/components/Common/Loaders/Skeletons';
import { cn } from '@/lib/utils';
import {
  encodeCommonTextFilter,
  encodeCommonExpressionFilter,
  LOG_METRICS,
  LOG_PAGE_SIZE_OPTIONS,
  makeCellId,
  parseCellId,
  type LogFieldsResponseProps,
  type LogGridRow,
  type LogViewState,
  type SelectionModel,
} from '@/lib/logs';
import { sanitizeId, visibleColumnIds } from '@/lib/logs/columns';
import { createEmptyLogRow, deleteLogRow, updateLogEntries } from '@/lib/logs/mutations';
import { useLogMetrics } from '@/hooks/logs/useLogMetrics';
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
  columns: string[];
  totalCount: number;
  view: LogViewState;
  onViewChange: (patch: Partial<LogViewState>) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  selection?: SelectionModel;
  onRowActivate?: (row: LogGridRow) => void;
  onDerivedCreated?: () => void;
  onMutated?: () => void;
  filterExpr?: string | null;
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
  onMutated,
  filterExpr,
  className,
  testId = 'log-grid',
}: LogGridProps) {
  const [derivedOpen, setDerivedOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<{ logId: number; columnId: string } | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [commonMode, setCommonMode] = React.useState<'in' | 'expression'>(
    view.commonFilter.startsWith('expression§') ? 'expression' : 'in'
  );
  const tableName = context.split('/').pop() ?? 'Table';

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
    if (!same) onViewChange({ columnOrder: order });
  }, [columns, orderKey, view.columnOrder, onViewChange]);

  const visible = visibleColumnIds(
    view.columnOrder.length ? view.columnOrder : columns,
    view.hiddenColumns
  );

  const metricsQuery = useLogMetrics({
    projectName,
    context,
    columns: visible,
    view,
    filterExpr,
    enabled: !!view.metric && !view.grouping,
  });

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(view.sorting) : updater;
    onViewChange({ sorting: next, offset: 0 });
  };

  const onViewChangeRef = React.useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  const pinning: ColumnPinningState = {
    left: view.columnsPinLeft,
    right: view.columnsPinRight,
  };

  const moveColumn = (id: string, dir: -1 | 1) => {
    const order = [...(view.columnOrder.length ? view.columnOrder : columns)];
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= order.length) return;
    const tmp = order[idx];
    order[idx] = order[next];
    order[next] = tmp;
    onViewChange({ columnOrder: order });
  };

  const togglePin = (id: string) => {
    const left = new Set(view.columnsPinLeft);
    if (left.has(id)) left.delete(id);
    else left.add(id);
    onViewChange({ columnsPinLeft: Array.from(left) });
  };

  const onColumnSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(view.columnSizing ?? {}) : updater;
    onViewChange({ columnSizing: next });
  };

  const commitEdit = async () => {
    if (!editing) return;
    const meta = fields[editing.columnId];
    let parsed: unknown = editValue;
    if (meta?.dataType === 'int') parsed = Number.parseInt(editValue, 10);
    else if (meta?.dataType === 'float') parsed = Number.parseFloat(editValue);
    else if (meta?.dataType === 'bool') parsed = editValue === 'true';
    const result = await updateLogEntries({
      projectName,
      context,
      logId: editing.logId,
      entries: { [sanitizeId(editing.columnId)]: parsed },
    });
    setEditing(null);
    if (result.ok) onMutated?.();
  };

  const columnDefs = React.useMemo<ColumnDef<LogGridRow>[]>(() => {
    return visible.map((key) => {
      const fieldKey = sanitizeId(key);
      const meta = fields[key] ?? fields[fieldKey];
      const mutable = meta?.mutable !== 'false' && meta?.fieldType !== 'derived_entry';
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
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground"
                title="Move left"
                data-testid={`log-grid-move-left-${fieldKey}`}
                onClick={(e) => {
                  e.stopPropagation();
                  moveColumn(key, -1);
                }}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground"
                title="Move right"
                data-testid={`log-grid-move-right-${fieldKey}`}
                onClick={(e) => {
                  e.stopPropagation();
                  moveColumn(key, 1);
                }}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground"
                title="Pin left"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(key);
                }}
                data-testid={`log-grid-pin-${fieldKey}`}
              >
                <Pin
                  className={cn('h-3 w-3', view.columnsPinLeft.includes(key) && 'text-primary')}
                />
              </Button>
            </div>
          );
        },
        size: view.columnSizing?.[key] ?? 160,
        minSize: 80,
        maxSize: 640,
        enableResizing: true,
        cell: ({ row, getValue }) => {
          const raw = getValue();
          const isEditing = editing?.logId === row.original.logId && editing.columnId === key;
          if (isEditing) {
            return (
              <Input
                autoFocus
                className="h-7 font-mono text-[12px]"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => void commitEdit()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitEdit();
                  if (e.key === 'Escape') setEditing(null);
                }}
                data-testid={`log-grid-cell-edit-${fieldKey}`}
                onClick={(e) => e.stopPropagation()}
              />
            );
          }
          const text = displayCellValue(raw);
          return (
            <span
              className="block truncate"
              title={text}
              onDoubleClick={(e) => {
                if (!mutable) return;
                e.stopPropagation();
                setEditing({ logId: row.original.logId, columnId: key });
                setEditValue(
                  raw === null || raw === undefined
                    ? ''
                    : typeof raw === 'object'
                      ? JSON.stringify(raw)
                      : String(raw)
                );
              }}
            >
              {text}
            </span>
          );
        },
        enableSorting: true,
        enablePinning: true,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- moveColumn/togglePin/commitEdit close over latest view via refs
  }, [visible, fields, view.filters, view.columnsPinLeft, editing, editValue]);

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: {
      sorting: view.sorting,
      columnPinning: pinning,
      columnSizing: view.columnSizing ?? {},
    },
    onSortingChange,
    onColumnSizingChange,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    getRowId: (row) => String(row.logId),
    defaultColumn: { size: 160, minSize: 80, maxSize: 640 },
  });

  const pageStart = view.offset;
  const pageEnd = Math.min(view.offset + rows.length, totalCount);
  const canPrev = view.offset > 0;
  const canNext = view.offset + view.limit < totalCount;

  const commonSearch = view.commonFilter.includes('§')
    ? view.commonFilter.split('§').slice(1).join('§')
    : '';

  const selectedRowId = selection?.mode === 'row' ? selection.selectedRowId : null;
  const selectedCells = selection?.mode === 'cell' ? new Set(selection.selectedCells) : null;

  const toggleFreeze = () => {
    if (view.freeze) onViewChange({ freeze: undefined, offset: 0 });
    else onViewChange({ freeze: new Date().toISOString(), offset: 0 });
  };

  const createRow = async () => {
    const result = await createEmptyLogRow({ projectName, context });
    if (result.ok) onMutated?.();
  };

  const selectedCellLogIds = React.useMemo(() => {
    if (selection?.mode !== 'cell') return [] as number[];
    const ids = new Set<number>();
    for (const cellId of selection.selectedCells) {
      const { logId } = parseCellId(cellId);
      const n = Number(logId);
      if (Number.isFinite(n)) ids.add(n);
    }
    return Array.from(ids);
  }, [selection]);

  const deleteSelectedRows = async () => {
    if (selection?.mode === 'row' && selection.selectedRowId) {
      const result = await deleteLogRow({
        projectName,
        context,
        logId: Number(selection.selectedRowId),
      });
      if (result.ok) {
        selection.onSelectRow(null);
        onMutated?.();
      }
      return;
    }
    if (selection?.mode === 'cell' && selectedCellLogIds.length) {
      for (const logId of selectedCellLogIds) {
        const result = await deleteLogRow({ projectName, context, logId });
        if (!result.ok) return;
      }
      selection.onSelectCells([]);
      onMutated?.();
    }
  };

  const canDelete =
    (selection?.mode === 'row' && !!selection.selectedRowId) ||
    (selection?.mode === 'cell' && selectedCellLogIds.length > 0);

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
        <Select value={commonMode} onValueChange={(v) => setCommonMode(v as 'in' | 'expression')}>
          <SelectTrigger className="h-8 w-[110px]" data-testid="log-grid-common-mode">
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
          className="h-8 max-w-xs font-mono"
          data-testid="log-grid-common-filter"
        />
        <LogColumnVisibility
          columns={view.columnOrder.length ? view.columnOrder : columns}
          hiddenColumns={view.hiddenColumns}
          onChange={(hiddenColumns) => onViewChange({ hiddenColumns })}
        />
        <Select
          value={view.grouping || '__none__'}
          onValueChange={(v) =>
            onViewChange({
              grouping: v === '__none__' ? '' : v,
              autoUpdate: v === '__none__' ? view.autoUpdate : false,
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
        <Button
          variant={view.freeze ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1.5"
          onClick={toggleFreeze}
          data-testid="log-grid-freeze"
        >
          <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
          Freeze
        </Button>
        <Button
          variant={view.autoUpdate ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1.5"
          disabled={!!view.grouping}
          onClick={() => onViewChange({ autoUpdate: !view.autoUpdate })}
          data-testid="log-grid-auto-update"
        >
          <Radio className="h-3.5 w-3.5" aria-hidden="true" />
          Live
        </Button>
        <LogDerivedColumnTrigger onClick={() => setDerivedOpen(true)} />
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => void createRow()}
          data-testid="log-grid-create-row"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Row
        </Button>
        {canDelete && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-destructive"
            onClick={() => void deleteSelectedRows()}
            data-testid="log-grid-delete-row"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </Button>
        )}
        {isFetching && (
          <span className="text-caption text-muted-foreground" data-testid="log-grid-fetching">
            Updating…
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
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

      {!isLoading && rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-body-muted">No rows match the current filters.</p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="overflow-hidden border-b border-border">
            <Table style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}>
              <colgroup>
                {table.getVisibleLeafColumns().map((column) => (
                  <col key={column.id} style={{ width: column.getSize() }} />
                ))}
              </colgroup>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                    {headerGroup.headers.map((header) => {
                      const pinned = header.column.getIsPinned();
                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            'relative h-8 whitespace-nowrap px-2.5 text-[11px] text-muted-foreground',
                            pinned === 'left' && 'bg-muted/40 sticky left-0 z-10'
                          )}
                          style={{ width: header.getSize() }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanResize() && (
                            <div
                              role="separator"
                              aria-orientation="vertical"
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={cn(
                                'bg-border/60 absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none hover:bg-primary',
                                header.column.getIsResizing() && 'bg-primary'
                              )}
                              data-testid={`log-grid-resize-${sanitizeId(header.column.id)}`}
                            />
                          )}
                        </TableHead>
                      );
                    })}
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
                    >
                      {row.getVisibleCells().map((cell) => {
                        const cellId = makeCellId(row.original.logId, cell.column.id);
                        const cellSelected = selectedCells?.has(cellId);
                        const pinned = cell.column.getIsPinned();
                        return (
                          <TableCell
                            key={cell.id}
                            data-testid={`log-grid-cell-${cellId}`}
                            style={{ width: cell.column.getSize() }}
                            className={cn(
                              'max-w-[220px] truncate px-2.5 py-1.5 font-mono text-[12px]',
                              cellSelected && 'bg-primary-tint-10 ring-1 ring-inset ring-primary',
                              pinned === 'left' && 'sticky left-0 z-[1] bg-card'
                            )}
                            onClick={(e) => {
                              if (selection?.mode === 'cell') {
                                e.stopPropagation();
                                const next = selectedCells?.has(cellId)
                                  ? selection.selectedCells.filter((id) => id !== cellId)
                                  : [...(selection.selectedCells ?? []), cellId];
                                selection.onSelectCells(next);
                              }
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
              {!view.grouping && (
                <TableFooter>
                  <TableRow className="bg-muted/20">
                    {visible.map((key) => {
                      const fieldKey = sanitizeId(key);
                      const raw = metricsQuery.data?.[key] ?? metricsQuery.data?.[fieldKey];
                      const text =
                        typeof raw === 'number'
                          ? raw.toLocaleString(undefined, { maximumFractionDigits: 4 })
                          : '—';
                      return (
                        <TableCell
                          key={key}
                          className="px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground"
                          data-testid={`log-grid-metric-cell-${fieldKey}`}
                        >
                          {text}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableFooter>
              )}
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
