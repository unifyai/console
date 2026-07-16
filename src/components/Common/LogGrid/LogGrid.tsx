'use client';

import * as React from 'react';
import type {
  ColumnDef,
  ColumnSizingState,
  Header,
  SortingState,
  OnChangeFn,
} from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/UI/table';
import { ScrollArea, ScrollBar } from '@/components/UI/scroll-area';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/UI/alert-dialog';
import { SkeletonTable } from '@/components/Common/Loaders/Skeletons';
import { cn } from '@/lib/utils';
import {
  makeCellId,
  parseCellId,
  cellsInBoundingRange,
  type LogFieldsResponseProps,
  type LogGridRow,
  type LogViewState,
  type SelectionModel,
} from '@/lib/logs';
import { sanitizeId, visibleColumnIds } from '@/lib/logs/columns';
import { deleteLogRow, updateLogEntries } from '@/lib/logs/mutations';
import { LogDerivedColumnDialog } from './LogDerivedColumnDialog';
import { LogCellValue } from './LogCellValue';
import { LogGridColumnHeader, LogGridSortableHead } from './LogGridColumnHeader';
import { LogGridToolbar } from './LogGridToolbar';

function SortableHeader({
  header,
  children,
  resizer,
  className,
  style,
  reorderEnabled,
}: {
  header: Header<LogGridRow, unknown>;
  children: React.ReactNode;
  resizer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  reorderEnabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: header.column.id,
  });
  return (
    <LogGridSortableHead
      header={header}
      resizer={resizer}
      className={className}
      style={style}
      reorderEnabled={reorderEnabled}
      dragAttributes={
        reorderEnabled ? (attributes as React.HTMLAttributes<HTMLElement>) : undefined
      }
      dragListeners={reorderEnabled ? (listeners as React.HTMLAttributes<HTMLElement>) : undefined}
      setNodeRef={setNodeRef}
      isDragging={isDragging}
      transformStyle={CSS.Translate.toString(transform)}
    >
      {children}
    </LogGridSortableHead>
  );
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
  error?: Error | null;
  onRetry?: () => void;
  /** Flat rows currently browsable for selection inspectors. */
  onBrowseRowsChange?: (rows: LogGridRow[]) => void;
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
  error = null,
  onRetry,
  onBrowseRowsChange,
  className,
  testId = 'log-grid',
}: LogGridProps) {
  const [derivedOpen, setDerivedOpen] = React.useState(false);
  const [editColumn, setEditColumn] = React.useState<{ key: string; equation: string } | null>(
    null
  );
  const [editing, setEditing] = React.useState<{ logId: number; columnId: string } | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [reorderColumnId, setReorderColumnId] = React.useState<string | null>(null);
  const tableName = context.split('/').pop() ?? 'Table';
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setReorderColumnId(null);
  }, [context]);

  React.useEffect(() => {
    onBrowseRowsChange?.(rows);
  }, [rows, onBrowseRowsChange]);

  React.useEffect(() => {
    if (!view.freeze && !view.autoUpdate) return;
    onViewChange({ freeze: undefined, autoUpdate: false, ...(view.freeze ? { offset: 0 } : {}) });
  }, [view.freeze, view.autoUpdate, onViewChange]);

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

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(view.sorting) : updater;
    onViewChange({ sorting: next, offset: 0 });
  };

  const onViewChangeRef = React.useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setReorderColumnId(null);
    if (!over || active.id === over.id) return;
    const order = [...(view.columnOrder.length ? view.columnOrder : columns)];
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onViewChange({ columnOrder: arrayMove(order, oldIndex, newIndex) });
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

  const openDerivedEdit = (key: string) => {
    const meta = fields[key] ?? fields[sanitizeId(key)];
    setEditColumn({ key: sanitizeId(key), equation: meta?.artifacts ?? '' });
    setDerivedOpen(true);
  };

  const openDerivedEditRef = React.useRef(openDerivedEdit);
  openDerivedEditRef.current = openDerivedEdit;

  const columnDefs = React.useMemo<ColumnDef<LogGridRow>[]>(() => {
    return visible.map((key) => {
      const fieldKey = sanitizeId(key);
      const meta = fields[key] ?? fields[fieldKey];
      const isDerived = meta?.fieldType === 'derived_entry';
      const mutable = meta?.mutable !== 'false' && !isDerived;
      return {
        id: key,
        accessorFn: (row) => row.entries[fieldKey] ?? row.entries[key],
        header: ({ column }) => {
          return (
            <LogGridColumnHeader
              column={column}
              columnKey={key}
              fieldKey={fieldKey}
              dataType={meta?.dataType}
              filters={view.filters}
              onFiltersChange={(filters) => onViewChangeRef.current({ filters, offset: 0 })}
              isDerived={isDerived}
              onEditDerived={isDerived ? () => openDerivedEditRef.current(key) : undefined}
              reorderEnabled={reorderColumnId === key}
              onEnableReorder={() => setReorderColumnId(key)}
              onDisableReorder={() => setReorderColumnId(null)}
            />
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
          return (
            <div
              className="min-w-0"
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
              <LogCellValue value={raw} />
            </div>
          );
        },
        enableSorting: true,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commitEdit closes over latest view via refs
  }, [visible, fields, view.filters, editing, editValue, reorderColumnId]);

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: {
      sorting: view.sorting,
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
  const selectionAnchorRef = React.useRef<string | null>(null);
  const isSelectingRef = React.useRef(false);

  React.useEffect(() => {
    selectionAnchorRef.current = null;
    isSelectingRef.current = false;
  }, [context]);

  React.useEffect(() => {
    if (
      selection?.mode === 'cell' &&
      selection.selectedCells.length === 0 &&
      !isSelectingRef.current
    ) {
      selectionAnchorRef.current = null;
    }
  }, [selection]);

  React.useEffect(() => {
    const endSelect = () => {
      isSelectingRef.current = false;
    };
    window.addEventListener('mouseup', endSelect);
    window.addEventListener('pointerup', endSelect);
    window.addEventListener('blur', endSelect);
    return () => {
      window.removeEventListener('mouseup', endSelect);
      window.removeEventListener('pointerup', endSelect);
      window.removeEventListener('blur', endSelect);
    };
  }, []);

  const selectCell = React.useCallback(
    (cellId: string, modifiers: { additive?: boolean; range?: boolean } = {}) => {
      if (selection?.mode !== 'cell') return;

      if (modifiers.range) {
        const anchor = selectionAnchorRef.current ?? selection.selectedCells[0] ?? cellId;
        if (!selectionAnchorRef.current) selectionAnchorRef.current = anchor;
        const range = cellsInBoundingRange(rows, visible, anchor, cellId);
        if (!range.length) {
          selection.onSelectCells([cellId]);
          selectionAnchorRef.current = cellId;
          return;
        }
        const startIndex = selection.selectedCells.indexOf(anchor);
        const prev = startIndex >= 0 ? selection.selectedCells.slice(0, startIndex) : [];
        selection.onSelectCells(Array.from(new Set([...prev, ...range])));
        return;
      }

      if (modifiers.additive) {
        const next = selection.selectedCells.includes(cellId)
          ? selection.selectedCells.filter((id) => id !== cellId)
          : [...selection.selectedCells, cellId];
        selection.onSelectCells(next);
        // Keep anchor even if the cell was toggled off — drag can re-select from here.
        selectionAnchorRef.current = cellId;
        return;
      }

      const next =
        selection.selectedCells.length === 1 && selection.selectedCells[0] === cellId
          ? []
          : [cellId];
      selection.onSelectCells(next);
      // Anchor stays on the pressed cell so drag-from-deselect still expands a range.
      selectionAnchorRef.current = cellId;
    },
    [selection, rows, visible]
  );

  const onCellPointerDown = React.useCallback(
    (e: React.MouseEvent | React.PointerEvent, cellId: string) => {
      if (selection?.mode !== 'cell') return;
      if ('button' in e && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      isSelectingRef.current = true;
      if (e.shiftKey) {
        selectCell(cellId, { range: true });
      } else if (e.metaKey || e.ctrlKey) {
        selectCell(cellId, { additive: true });
      } else {
        selectCell(cellId);
      }
    },
    [selection, selectCell]
  );

  const onCellPointerEnter = React.useCallback(
    (e: React.MouseEvent | React.PointerEvent, cellId: string) => {
      if (selection?.mode !== 'cell') return;
      if (!isSelectingRef.current) return;
      // Primary button still held (mouse + Mac trackpad click-drag).
      if ('buttons' in e && e.buttons !== 1) {
        isSelectingRef.current = false;
        return;
      }
      selectCell(cellId, { range: true });
    },
    [selection, selectCell]
  );

  const onCellPointerUp = React.useCallback(() => {
    isSelectingRef.current = false;
  }, []);

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

  const moveCellFocus = (key: string) => {
    if (selection?.mode !== 'cell' || !rows.length || !visible.length) return;
    const current = selection.selectedCells[selection.selectedCells.length - 1];
    let rowIdx = 0;
    let colIdx = 0;
    if (current) {
      const { logId, columnId } = parseCellId(current);
      const r = rows.findIndex((row) => String(row.logId) === logId);
      const c = visible.indexOf(columnId);
      if (r >= 0) rowIdx = r;
      if (c >= 0) colIdx = c;
    }
    if (key === 'ArrowUp') rowIdx = Math.max(0, rowIdx - 1);
    if (key === 'ArrowDown') rowIdx = Math.min(rows.length - 1, rowIdx + 1);
    if (key === 'ArrowLeft') colIdx = Math.max(0, colIdx - 1);
    if (key === 'ArrowRight') colIdx = Math.min(visible.length - 1, colIdx + 1);
    const nextId = makeCellId(rows[rowIdx].logId, visible[colIdx]);
    selection.onSelectCells([nextId]);
    selectionAnchorRef.current = nextId;
  };

  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (selection?.mode !== 'cell') return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, [contenteditable="true"]')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      selection.onSelectCells([]);
      selectionAnchorRef.current = null;
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!canDelete) return;
      e.preventDefault();
      setDeleteConfirmOpen(true);
      return;
    }
    if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight'
    ) {
      e.preventDefault();
      moveCellFocus(e.key);
    }
  };

  const hasData = rows.length > 0;
  const showError = Boolean(error && !rows.length);

  return (
    <div
      ref={rootRef}
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
      data-testid={testId}
      tabIndex={0}
      onKeyDown={onGridKeyDown}
    >
      {isLoading && !hasData ? (
        <SkeletonTable rows={8} cols={Math.max(visible.length, 4)} />
      ) : (
        <>
          <LogGridToolbar
            columns={columns}
            view={view}
            onViewChange={onViewChange}
            commonSearch={commonSearch}
            totalCount={totalCount}
            pageStart={pageStart}
            pageEnd={pageEnd}
            canPrev={canPrev}
            canNext={canNext}
            canDelete={canDelete}
            isFetching={isFetching}
            onDeleteRows={() => setDeleteConfirmOpen(true)}
          />

          {showError ? (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-3 p-8"
              data-testid="log-grid-error"
            >
              <p className="text-body-muted">Could not load rows. Please try again.</p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry} data-testid="log-grid-retry">
                  Retry
                </Button>
              )}
            </div>
          ) : !isLoading && !hasData ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <p className="text-body-muted">No rows match the current filters.</p>
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="overflow-hidden border-b border-border">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToHorizontalAxis]}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={visible} strategy={horizontalListSortingStrategy}>
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
                              return (
                                <SortableHeader
                                  key={header.id}
                                  header={header}
                                  reorderEnabled={reorderColumnId === header.column.id}
                                  className="relative h-8 whitespace-nowrap px-1 text-[11px] text-muted-foreground"
                                  style={{
                                    width: header.getSize(),
                                  }}
                                  resizer={
                                    header.column.getCanResize() ? (
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
                                    ) : null
                                  }
                                >
                                  {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                      )}
                                </SortableHeader>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody className={selection?.mode === 'cell' ? 'select-none' : undefined}>
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
                                return (
                                  <TableCell
                                    key={cell.id}
                                    data-testid={`log-grid-cell-${cellId}`}
                                    style={{
                                      width: cell.column.getSize(),
                                    }}
                                    className={cn(
                                      'max-w-[220px] truncate px-2.5 py-1.5 font-mono text-[12px]',
                                      selection?.mode === 'cell' && 'select-none',
                                      cellSelected &&
                                        'bg-primary-tint-10 ring-1 ring-inset ring-primary'
                                    )}
                                    onMouseDown={(e) => onCellPointerDown(e, cellId)}
                                    onMouseEnter={(e) => onCellPointerEnter(e, cellId)}
                                    onMouseUp={onCellPointerUp}
                                  >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </SortableContext>
                </DndContext>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}

          <LogDerivedColumnDialog
            open={derivedOpen}
            onOpenChange={(open) => {
              setDerivedOpen(open);
              if (!open) setEditColumn(null);
            }}
            projectName={projectName}
            context={context}
            tableName={tableName}
            columns={columns}
            editColumn={editColumn}
            onCreated={() => onDerivedCreated?.()}
          />

          <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete selected rows?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the selected log rows. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  data-testid="log-grid-delete-confirm"
                  onClick={() => void deleteSelectedRows()}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
