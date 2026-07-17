'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type {
  ColumnDef,
  ColumnSizingState,
  ExpandedState,
  Header,
  SortingState,
  OnChangeFn,
} from '@tanstack/react-table';
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
import { ChevronRight } from 'lucide-react';
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
  cellsForRow,
  cellsForRowRange,
  isAllRowSelected,
  LOG_ROW_NUMBER_COL,
  type LogFieldsResponseProps,
  type LogGridRow,
  type LogViewState,
  type SelectionModel,
} from '@/lib/logs';
import { sanitizeId, visibleColumnIds } from '@/lib/logs/columns';
import {
  fetchGroupChildren,
  flattenLeafRows,
  getNewGridCellIds,
  parseGrouping,
  updateGridGroupSubRows,
  withGroupedColumnsFirst,
} from '@/lib/logs/grouping';
import { sortingStateToOrchestra } from '@/lib/logs/querySpec';
import { deleteLogRow } from '@/lib/logs/mutations';
import { LogDerivedColumnDialog } from './LogDerivedColumnDialog';
import { LogCellValue } from './LogCellValue';
import { LogGridColumnHeader, LogGridSortableHead } from './LogGridColumnHeader';
import { LogGridToolbar } from './LogGridToolbar';
import { snakeToCamel } from '@/utils/casing';

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
    disabled: !reorderEnabled,
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
  /** Whether more pages are available for infinite scroll. */
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  selection?: SelectionModel;
  onRowActivate?: (row: LogGridRow) => void;
  /** Refresh fields/rows after a derived column is created or updated. */
  onDerivedCreated?: (key: string) => void;
  onMutated?: () => void;
  filterExpr?: string | null;
  error?: Error | null;
  onRetry?: () => void;
  /** Flat rows currently browsable for selection inspectors. */
  onBrowseRowsChange?: (rows: LogGridRow[]) => void;
  /** Whether any cells are selected (enables the view-pane toolbar toggle). */
  hasSelection?: boolean;
  viewPanelOpen?: boolean;
  onToggleViewPanel?: () => void;
  /** Opens the cell view pane (e.g. Enter / double-click). No-op if already open. */
  onOpenViewPanel?: () => void;
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
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  selection,
  onRowActivate,
  onDerivedCreated,
  onMutated,
  filterExpr = null,
  error = null,
  onRetry,
  onBrowseRowsChange,
  hasSelection = false,
  viewPanelOpen = false,
  onToggleViewPanel,
  onOpenViewPanel,
  className,
  testId = 'log-grid',
}: LogGridProps) {
  const [derivedOpen, setDerivedOpen] = React.useState(false);
  const [editColumn, setEditColumn] = React.useState<{ key: string; equation: string } | null>(
    null
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [reorderEnabled, setReorderEnabled] = React.useState(false);
  const [treeRows, setTreeRows] = React.useState<LogGridRow[]>(rows);
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [expandingId, setExpandingId] = React.useState<string | null>(null);
  const [newCells, setNewCells] = React.useState<Set<string>>(() => new Set());
  const prevDisplayRowsRef = React.useRef<LogGridRow[]>([]);
  const tableName = context.split('/').pop() ?? 'Table';
  const rootRef = React.useRef<HTMLDivElement>(null);
  const scrollViewportRef = React.useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = React.useRef<HTMLDivElement>(null);

  const groupingIds = React.useMemo(() => parseGrouping(view.grouping), [view.grouping]);
  const isGrouped = groupingIds.length > 0;
  const displayRows = isGrouped ? treeRows : rows;

  React.useEffect(() => {
    setReorderEnabled(false);
    setExpanded({});
  }, [context]);

  React.useEffect(() => {
    setTreeRows(rows);
    setExpanded({});
  }, [rows]);

  React.useEffect(() => {
    onBrowseRowsChange?.(isGrouped ? flattenLeafRows(displayRows) : displayRows);
  }, [displayRows, isGrouped, onBrowseRowsChange]);

  React.useEffect(() => {
    const prev = prevDisplayRowsRef.current;
    if (prev.length > 0) {
      const ids = getNewGridCellIds(prev, displayRows);
      if (ids.length) setNewCells(new Set(ids));
    }
    prevDisplayRowsRef.current = displayRows;
  }, [displayRows]);

  React.useEffect(() => {
    if (newCells.size === 0) return;
    const timer = window.setTimeout(() => setNewCells(new Set()), 3_000);
    return () => window.clearTimeout(timer);
  }, [newCells]);

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

  const setGrouping = React.useCallback(
    (nextGrouping: string) => {
      const nextIds = parseGrouping(nextGrouping);
      const order = view.columnOrder.length ? view.columnOrder : columns;
      onViewChange({
        grouping: nextGrouping,
        offset: 0,
        autoUpdate: false,
        columnOrder: withGroupedColumnsFirst(order, nextIds),
      });
      setExpanded({});
    },
    [columns, onViewChange, view.columnOrder]
  );

  const expandGroup = React.useCallback(
    async (row: LogGridRow) => {
      if (!row.group || row.group.isPopulated) return;
      const group = row.group;
      setExpandingId(group.id);
      const parentId = group.id.includes('>') ? group.id.split('>').slice(0, -1).join('>') : null;
      const result = await fetchGroupChildren({
        projectName,
        context,
        grouping: view.grouping,
        groupingColumnId: group.groupingColumnId,
        groupingValue: String(group.groupingValue),
        parentId,
        filterExpr,
        sorting: sortingStateToOrchestra(view.sorting),
        fields,
        pageSize: view.limit || 50,
      });
      setTreeRows((prev) => updateGridGroupSubRows(prev, group.id, result.rows, result.count));
      setExpandingId(null);
    },
    [context, fields, filterExpr, projectName, view.grouping, view.limit, view.sorting]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
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

  const openDerivedEdit = (key: string) => {
    const meta = fields[key] ?? fields[sanitizeId(key)];
    setEditColumn({ key: sanitizeId(key), equation: meta?.artifacts ?? '' });
    setDerivedOpen(true);
  };

  const openDerivedEditRef = React.useRef(openDerivedEdit);
  openDerivedEditRef.current = openDerivedEdit;

  const columnDefs = React.useMemo<ColumnDef<LogGridRow>[]>(() => {
    const indexColumn: ColumnDef<LogGridRow> = {
      id: LOG_ROW_NUMBER_COL,
      header: '#',
      cell: ({ row }) => view.offset + row.index + 1,
      size: 48,
      minSize: 40,
      maxSize: 64,
      enableResizing: false,
      enableSorting: false,
    };
    const dataColumns: ColumnDef<LogGridRow>[] = visible.map((key) => {
      const fieldKey = sanitizeId(key);
      const meta = fields[key] ?? fields[fieldKey];
      const isDerived = meta?.fieldType === 'derived_entry';
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
              grouping={view.grouping}
              onGroupingChange={setGrouping}
              isDerived={isDerived}
              onEditDerived={isDerived ? () => openDerivedEditRef.current(key) : undefined}
              reorderEnabled={reorderEnabled}
              onEnableReorder={() => setReorderEnabled(true)}
              onDisableReorder={() => setReorderEnabled(false)}
              onHideColumn={() => {
                if (view.hiddenColumns.includes(key)) return;
                onViewChangeRef.current({
                  hiddenColumns: [...view.hiddenColumns, key],
                });
              }}
            />
          );
        },
        size: view.columnSizing?.[key] ?? 160,
        minSize: 80,
        maxSize: 640,
        enableResizing: true,
        cell: ({ row, getValue }) => {
          const raw = getValue();
          const group = row.original.group;
          const isGroupColumn = !!group && group.fieldKey === fieldKey;
          if (isGroupColumn) {
            const busy = expandingId === group.id;
            return (
              <div
                className="flex min-w-0 items-center gap-1"
                style={{ paddingLeft: row.depth * 12 }}
                data-testid={`log-grid-group-cell-${group.id}`}
              >
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-transform',
                    row.getIsExpanded() && 'rotate-90'
                  )}
                  aria-label={row.getIsExpanded() ? 'Collapse group' : 'Expand group'}
                  data-testid={`log-grid-group-expand-${sanitizeId(fieldKey)}`}
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void (async () => {
                      if (!row.getIsExpanded()) {
                        if (!group.isPopulated) await expandGroup(row.original);
                        row.toggleExpanded(true);
                      } else {
                        row.toggleExpanded(false);
                      }
                    })();
                  }}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <span className="text-caption shrink-0 text-muted-foreground">
                  ({group.groupCount})
                </span>
                <span className="min-w-0 truncate font-mono text-[12px]">
                  <LogCellValue value={raw} />
                </span>
              </div>
            );
          }
          if (group) {
            return null;
          }
          return (
            <div className="min-w-0">
              <LogCellValue value={raw} />
            </div>
          );
        },
        enableSorting: true,
      };
    });
    return [indexColumn, ...dataColumns];
  }, [
    visible,
    fields,
    view.filters,
    view.grouping,
    view.offset,
    view.hiddenColumns,
    view.columnSizing,
    reorderEnabled,
    expandingId,
    expandGroup,
    setGrouping,
  ]);

  const table = useReactTable({
    data: displayRows,
    columns: columnDefs,
    state: {
      sorting: view.sorting,
      columnSizing: view.columnSizing ?? {},
      expanded,
    },
    onSortingChange,
    onColumnSizingChange,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => row.subRows,
    getRowCanExpand: (row) => !!row.original.group,
    manualSorting: true,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    getRowId: (row) => row.group?.id ?? String(row.logId),
    defaultColumn: { size: 160, minSize: 80, maxSize: 640 },
  });

  const loadedCount = displayRows.length;

  const commonSearch = view.commonFilter.includes('§')
    ? view.commonFilter.split('§').slice(1).join('§')
    : '';

  React.useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    const root = scrollViewportRef.current;
    if (!sentinel || !onLoadMore || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { root, rootMargin: '200px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasNextPage, isFetchingNextPage, loadedCount]);

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

  const selectableRows = React.useMemo(() => flattenLeafRows(displayRows), [displayRows]);

  const selectCell = React.useCallback(
    (cellId: string, modifiers: { additive?: boolean; range?: boolean } = {}) => {
      if (selection?.mode !== 'cell') return;

      if (modifiers.range) {
        const anchor = selectionAnchorRef.current ?? selection.selectedCells[0] ?? cellId;
        if (!selectionAnchorRef.current) selectionAnchorRef.current = anchor;
        const range = cellsInBoundingRange(selectableRows, visible, anchor, cellId);
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
    [selection, selectableRows, visible]
  );

  /** Whole-row selection via the left-hand index column (Interfaces RowNumbering). */
  const selectRow = React.useCallback(
    (logId: string, modifiers: { additive?: boolean; range?: boolean } = {}) => {
      if (selection?.mode !== 'cell') return;
      const rowCells = cellsForRow(logId, visible);
      if (!rowCells.length) return;
      const anchorCell = rowCells[0];

      if (modifiers.range) {
        const anchor = selectionAnchorRef.current ?? selection.selectedCells[0] ?? anchorCell;
        if (!selectionAnchorRef.current) selectionAnchorRef.current = anchor;
        const startLogId = parseCellId(anchor).logId;
        selection.onSelectCells(cellsForRowRange(selectableRows, visible, startLogId, logId));
        return;
      }

      if (modifiers.additive) {
        const allSelected = rowCells.every((id) => selection.selectedCells.includes(id));
        selection.onSelectCells(
          allSelected
            ? selection.selectedCells.filter((id) => !rowCells.includes(id))
            : [...selection.selectedCells, ...rowCells]
        );
        selectionAnchorRef.current = anchorCell;
        return;
      }

      const allSelected = rowCells.every((id) => selection.selectedCells.includes(id));
      selection.onSelectCells(allSelected ? [] : rowCells);
      selectionAnchorRef.current = anchorCell;
    },
    [selection, selectableRows, visible]
  );

  const selectAllRows = React.useCallback(() => {
    if (selection?.mode !== 'cell') return;
    const all = flattenLeafRows(displayRows).flatMap((row) => cellsForRow(row.logId, visible));
    const allSelected = all.length > 0 && all.every((id) => selection.selectedCells.includes(id));
    selection.onSelectCells(allSelected ? [] : all);
    selectionAnchorRef.current = allSelected || !all.length ? null : all[0];
  }, [selection, displayRows, visible]);

  const onCellPointerDown = React.useCallback(
    (e: React.MouseEvent | React.PointerEvent, cellId: string) => {
      if (selection?.mode !== 'cell') return;
      if ('button' in e && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      // Second click of a double-click would otherwise toggle the cell off before
      // onDoubleClick runs — skip selection churn and let dblclick force-select.
      if ('detail' in e && e.detail > 1) return;
      isSelectingRef.current = true;
      rootRef.current?.focus({ preventScroll: true });
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

  const onRowIndexPointerDown = React.useCallback(
    (e: React.MouseEvent | React.PointerEvent, logId: string) => {
      if (selection?.mode !== 'cell') return;
      if ('button' in e && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      if ('detail' in e && e.detail > 1) return;
      isSelectingRef.current = true;
      rootRef.current?.focus({ preventScroll: true });
      if (e.shiftKey) {
        selectRow(logId, { range: true });
      } else if (e.metaKey || e.ctrlKey) {
        selectRow(logId, { additive: true });
      } else {
        selectRow(logId);
      }
    },
    [selection, selectRow]
  );

  const onRowIndexPointerEnter = React.useCallback(
    (e: React.MouseEvent | React.PointerEvent, logId: string) => {
      if (selection?.mode !== 'cell') return;
      if (!isSelectingRef.current) return;
      if ('buttons' in e && e.buttons !== 1) {
        isSelectingRef.current = false;
        return;
      }
      selectRow(logId, { range: true });
    },
    [selection, selectRow]
  );

  const onCellPointerUp = React.useCallback(() => {
    isSelectingRef.current = false;
  }, []);

  const openViewPanel = React.useCallback(() => {
    onOpenViewPanel?.();
  }, [onOpenViewPanel]);

  const onCellDoubleClick = React.useCallback(
    (cellId: string) => {
      if (selection?.mode !== 'cell') return;
      selection.onSelectCells([cellId]);
      selectionAnchorRef.current = cellId;
      rootRef.current?.focus({ preventScroll: true });
      openViewPanel();
    },
    [selection, openViewPanel]
  );

  const onRowIndexDoubleClick = React.useCallback(
    (logId: string) => {
      if (selection?.mode !== 'cell') return;
      const rowCells = cellsForRow(logId, visible);
      if (!rowCells.length) return;
      selection.onSelectCells(rowCells);
      selectionAnchorRef.current = rowCells[0] ?? null;
      rootRef.current?.focus({ preventScroll: true });
      openViewPanel();
    },
    [selection, visible, openViewPanel]
  );

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
    if (selection?.mode !== 'cell' || !selectableRows.length || !visible.length) return;
    const current = selection.selectedCells[selection.selectedCells.length - 1];
    let rowIdx = 0;
    let colIdx = 0;
    if (current) {
      const { logId, columnId } = parseCellId(current);
      const r = selectableRows.findIndex((row) => String(row.logId) === logId);
      const c = visible.indexOf(columnId);
      if (r >= 0) rowIdx = r;
      if (c >= 0) colIdx = c;
    }
    const rowFullySelected =
      !!current && isAllRowSelected(selection.selectedCells, parseCellId(current).logId, visible);

    if (rowFullySelected && (key === 'ArrowUp' || key === 'ArrowDown')) {
      if (key === 'ArrowUp') rowIdx = Math.max(0, rowIdx - 1);
      if (key === 'ArrowDown') rowIdx = Math.min(selectableRows.length - 1, rowIdx + 1);
      const next = cellsForRow(selectableRows[rowIdx].logId, visible);
      selection.onSelectCells(next);
      selectionAnchorRef.current = next[0] ?? null;
      return;
    }
    if (rowFullySelected && key === 'ArrowRight') {
      const nextId = makeCellId(selectableRows[rowIdx].logId, visible[0]);
      selection.onSelectCells([nextId]);
      selectionAnchorRef.current = nextId;
      return;
    }
    if (key === 'ArrowUp') rowIdx = Math.max(0, rowIdx - 1);
    if (key === 'ArrowDown') rowIdx = Math.min(selectableRows.length - 1, rowIdx + 1);
    if (key === 'ArrowLeft') colIdx = Math.max(0, colIdx - 1);
    if (key === 'ArrowRight') colIdx = Math.min(visible.length - 1, colIdx + 1);
    const nextId = makeCellId(selectableRows[rowIdx].logId, visible[colIdx]);
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
    if (e.key === 'Enter') {
      if (selection.selectedCells.length === 0) return;
      e.preventDefault();
      openViewPanel();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAllRows();
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

  const hasData = displayRows.length > 0;
  const showError = Boolean(error && !displayRows.length);

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
            loadedCount={loadedCount}
            totalCount={totalCount}
            canDelete={canDelete}
            isFetching={isFetching || isFetchingNextPage}
            onDeleteRows={() => setDeleteConfirmOpen(true)}
            onRefresh={onRetry}
            onAddDerivedColumn={() => {
              setEditColumn(null);
              setDerivedOpen(true);
            }}
            hasSelection={hasSelection}
            viewPanelOpen={viewPanelOpen}
            onToggleViewPanel={onToggleViewPanel}
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
            <ScrollArea
              className="min-h-0 flex-1"
              viewportRef={scrollViewportRef}
              viewportTestId="log-grid-scroll-viewport"
              // Radix wraps children in display:table which breaks position:sticky;
              // block restores sticky left pinning for the row-index column.
              viewportClassName="[&>div]:!block"
            >
              <div className="border-b border-border">
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
                          <TableRow key={headerGroup.id} className="hover:bg-transparent">
                            {headerGroup.headers.map((header) => {
                              if (header.column.id === LOG_ROW_NUMBER_COL) {
                                return (
                                  <TableHead
                                    key={header.id}
                                    className={cn(
                                      // Opaque sticky corner: --muted/--surface/--secondary (dark)
                                      // are translucent and let scrolled content bleed through the pin.
                                      'sticky left-0 top-0 z-30 h-8 cursor-pointer select-none border-r border-border bg-card px-1 text-center text-[11px] text-muted-foreground hover:bg-card-2',
                                      selection?.mode === 'cell' && 'select-none'
                                    )}
                                    style={{ width: header.getSize(), minWidth: header.getSize() }}
                                    data-testid="log-grid-row-index-header"
                                    onMouseDown={(e) => {
                                      if (selection?.mode !== 'cell') return;
                                      if (e.button !== 0) return;
                                      e.stopPropagation();
                                      e.preventDefault();
                                      selectAllRows();
                                    }}
                                  >
                                    #
                                  </TableHead>
                                );
                              }
                              return (
                                <SortableHeader
                                  key={header.id}
                                  header={header}
                                  reorderEnabled={reorderEnabled}
                                  className="sticky top-0 z-20 h-8 whitespace-nowrap border-r border-border bg-card px-1 text-[11px] text-muted-foreground"
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
                                          'absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary',
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
                          const isGroup = !!row.original.group;
                          const isSelected =
                            !isGroup && selectedRowId === String(row.original.logId);
                          return (
                            <TableRow
                              key={row.id}
                              data-testid={
                                isGroup
                                  ? `log-grid-group-row-${row.original.group!.id}`
                                  : `log-grid-row-${row.original.logId}`
                              }
                              className={cn(
                                'hover:bg-transparent',
                                !isGroup && 'cursor-pointer',
                                isSelected && 'bg-muted/60'
                              )}
                              onClick={() => {
                                if (isGroup) return;
                                if (selection?.mode === 'row') {
                                  selection.onSelectRow(String(row.original.logId));
                                }
                                onRowActivate?.(row.original);
                              }}
                            >
                              {row.getVisibleCells().map((cell) => {
                                if (cell.column.id === LOG_ROW_NUMBER_COL) {
                                  if (isGroup) {
                                    return (
                                      <TableCell
                                        key={cell.id}
                                        data-testid={`log-grid-group-index-${row.original.group!.id}`}
                                        style={{
                                          width: cell.column.getSize(),
                                          minWidth: cell.column.getSize(),
                                        }}
                                        className="sticky left-0 z-20 select-none border-r border-border bg-background px-1 py-1.5 text-center font-mono text-[12px] text-muted-foreground"
                                      >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                      </TableCell>
                                    );
                                  }
                                  const logId = String(row.original.logId);
                                  const rowFullySelected =
                                    !!selectedCells &&
                                    isAllRowSelected(selectedCells, logId, visible);
                                  return (
                                    <TableCell
                                      key={cell.id}
                                      data-testid={`log-grid-row-index-${logId}`}
                                      style={{
                                        width: cell.column.getSize(),
                                        minWidth: cell.column.getSize(),
                                      }}
                                      className={cn(
                                        'sticky left-0 z-20 cursor-pointer select-none border-r border-border px-1 py-1.5 text-center font-mono text-[12px]',
                                        rowFullySelected
                                          ? 'bg-primary text-primary-foreground'
                                          : // Opaque hover: muted/primary-tint mix with transparent.
                                            'bg-background text-muted-foreground hover:bg-card-2'
                                      )}
                                      onMouseDown={(e) => onRowIndexPointerDown(e, logId)}
                                      onMouseEnter={(e) => onRowIndexPointerEnter(e, logId)}
                                      onMouseUp={onCellPointerUp}
                                      onDoubleClick={() => onRowIndexDoubleClick(logId)}
                                    >
                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                  );
                                }
                                if (isGroup) {
                                  return (
                                    <TableCell
                                      key={cell.id}
                                      style={{ width: cell.column.getSize() }}
                                      className="max-w-[220px] border-r border-border px-2.5 py-1.5 font-mono text-[12px]"
                                    >
                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                  );
                                }
                                const cellId = makeCellId(row.original.logId, cell.column.id);
                                const cellSelected = selectedCells?.has(cellId);
                                const isNewCell = newCells.has(cellId);
                                return (
                                  <TableCell
                                    key={cell.id}
                                    data-testid={`log-grid-cell-${cellId}`}
                                    style={{
                                      width: cell.column.getSize(),
                                    }}
                                    className={cn(
                                      'max-w-[220px] truncate border-r border-border px-2.5 py-1.5 font-mono text-[12px] hover:bg-muted',
                                      selection?.mode === 'cell' && 'select-none',
                                      cellSelected &&
                                        'bg-primary-tint-10 ring-1 ring-inset ring-primary',
                                      isNewCell && 'animate-fade-accent'
                                    )}
                                    onMouseDown={(e) => onCellPointerDown(e, cellId)}
                                    onMouseEnter={(e) => onCellPointerEnter(e, cellId)}
                                    onMouseUp={onCellPointerUp}
                                    onDoubleClick={() => onCellDoubleClick(cellId)}
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
              {hasNextPage && (
                <div
                  ref={loadMoreSentinelRef}
                  className="flex h-8 items-center justify-center"
                  data-testid="log-grid-load-more-sentinel"
                >
                  {isFetchingNextPage && (
                    <span className="text-caption text-muted-foreground">Loading more…</span>
                  )}
                </div>
              )}
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
            columns={columns}
            editColumn={editColumn}
            onCreated={(key, { created }) => {
              // Fields responses are camelCased at the Orchestra boundary, so pin
              // the camelCase id that LogGrid will actually render.
              const columnId = snakeToCamel(key);
              if (created) {
                const order = view.columnOrder.length ? view.columnOrder : columns;
                if (!order.includes(columnId)) {
                  onViewChange({ columnOrder: [...order, columnId] });
                }
              }
              onDerivedCreated?.(columnId);
            }}
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
