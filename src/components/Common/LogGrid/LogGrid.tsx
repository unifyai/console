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
  cellsForColumn,
  cellsForColumnRange,
  isAllRowSelected,
  selectionPerimeterBoxShadow,
  LOG_ROW_NUMBER_COL,
  type LogFieldsResponseProps,
  type LogGridRow,
  type LogViewState,
  type SelectionModel,
} from '@/lib/logs';
import { sanitizeId, visibleColumnIds } from '@/lib/logs/columns';
import {
  appendGridGroupSubRows,
  fetchGroupChildren,
  flattenLeafRows,
  getNewGridCellIds,
  groupHasMoreChildren,
  parseGrouping,
  updateGridGroupSubRows,
  withGroupedColumnsFirst,
} from '@/lib/logs/grouping';
import { buildNestedRowLabelMap } from '@/lib/logs/rowLabels';
import { sortingStateToOrchestra } from '@/lib/logs/querySpec';
import { deleteLogRow } from '@/lib/logs/mutations';
import { LogDerivedColumnDialog } from './LogDerivedColumnDialog';
import { LogCellValue } from './LogCellValue';
import { LogCellInlineEditor } from './LogCellInlineEditor';
import { LogGridColumnHeader, LogGridSortableHead } from './LogGridColumnHeader';
import { LogGridToolbar } from './LogGridToolbar';
import { snakeToCamel } from '@/utils/casing';

function nudgeElement(element: HTMLElement | null) {
  if (!element) return;
  element.classList.remove('animate-nudge');
  void element.offsetWidth;
  element.classList.add('animate-nudge');
}

function formatInlineDraft(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function LogGridColumnResizer({
  columnId,
  isResizing,
  resizeHandler,
  tableHeight,
}: {
  columnId: string;
  isResizing: boolean;
  resizeHandler: (event: unknown) => void;
  tableHeight: number;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        resizeHandler(e);
      }}
      onTouchStart={resizeHandler}
      className={cn(
        'absolute right-0 top-0 z-10 w-1 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary',
        isResizing && 'bg-primary'
      )}
      style={{ height: tableHeight > 0 ? tableHeight : '100%' }}
      data-testid={`log-grid-resize-${sanitizeId(columnId)}`}
    />
  );
}

function SortableHeader({
  header,
  children,
  resizer,
  className,
  style,
  reorderEnabled,
  onMouseDown,
}: {
  header: Header<LogGridRow, unknown>;
  children: React.ReactNode;
  resizer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  reorderEnabled: boolean;
  onMouseDown?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
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
      onMouseDown={onMouseDown}
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
  filter?: string | null;
  error?: Error | null;
  onRetry?: () => void;
  /** Flat rows currently browsable for selection inspectors. */
  onBrowseRowsChange?: (rows: LogGridRow[]) => void;
  /** `#` column labels keyed by logId (leaves) or group.id (headers). */
  onRowLabelsChange?: (labels: Map<string, string>) => void;
  /** Whether any cells are selected (enables the view-pane toolbar toggle). */
  hasSelection?: boolean;
  viewPanelOpen?: boolean;
  onToggleViewPanel?: () => void;
  /**
   * Opens the cell view pane (e.g. multi-cell Enter, row-index double-click).
   * No-op if already open.
   */
  onOpenViewPanel?: () => void;
  /**
   * Optional cell view pane rendered beside the table (below the toolbar),
   * so its header aligns with the column-header row.
   */
  viewPanel?: React.ReactNode;
  /** When provided, non-editable columns show a lock icon in the header. */
  isColumnEditable?: (columnId: string) => boolean;
  /** Persist an in-cell edit. Return true when saved (or no-op). */
  onCommitCellEdit?: (logId: number, columnId: string, draft: string) => Promise<boolean>;
  /** Initial draft text for the in-cell editor. */
  draftForCell?: (columnId: string, value: unknown) => string;
  /** When false, hide row/cell delete affordances (default true). */
  allowDelete?: boolean;
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
  filter = null,
  error = null,
  onRetry,
  onBrowseRowsChange,
  onRowLabelsChange,
  hasSelection = false,
  viewPanelOpen = false,
  onToggleViewPanel,
  onOpenViewPanel,
  viewPanel,
  isColumnEditable,
  onCommitCellEdit,
  draftForCell,
  allowDelete = true,
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
  const [editingCellId, setEditingCellId] = React.useState<string | null>(null);
  const [editingAnchorEl, setEditingAnchorEl] = React.useState<HTMLElement | null>(null);
  const prevDisplayRowsRef = React.useRef<LogGridRow[]>([]);
  /** Skip one flash pass after lazy group expand (children are not live/refresh inserts). */
  const suppressNextFlashRef = React.useRef(false);
  /** Last known DOM node per cell id — used when Enter starts edit without a click target. */
  const cellElByIdRef = React.useRef(new Map<string, HTMLElement>());
  const tableName = context.split('/').pop() ?? 'Table';
  const rootRef = React.useRef<HTMLDivElement>(null);
  const scrollViewportRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [tableHeight, setTableHeight] = React.useState(0);
  const loadMoreSentinelRef = React.useRef<HTMLDivElement>(null);

  const groupingIds = React.useMemo(() => parseGrouping(view.grouping), [view.grouping]);
  const isGrouped = groupingIds.length > 0;
  const displayRows = isGrouped ? treeRows : rows;

  const rowLabelMap = React.useMemo(
    () => buildNestedRowLabelMap(displayRows, { offset: view.offset, grouped: isGrouped }),
    [displayRows, view.offset, isGrouped]
  );

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
    onRowLabelsChange?.(rowLabelMap);
  }, [rowLabelMap, onRowLabelsChange]);

  React.useEffect(() => {
    const prev = prevDisplayRowsRef.current;
    if (suppressNextFlashRef.current) {
      suppressNextFlashRef.current = false;
      prevDisplayRowsRef.current = displayRows;
      return;
    }
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

  // Prefer the saved order (canonical init or user drag). Grouped columns are
  // only moved to the front for display — never written back into columnOrder —
  // so Ungroup restores the pre-group positions automatically.
  const baseColumnOrder = view.columnOrder.length ? view.columnOrder : columns;
  const displayColumnOrder = withGroupedColumnsFirst(baseColumnOrder, groupingIds);
  const visible = visibleColumnIds(displayColumnOrder, view.hiddenColumns);

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(view.sorting) : updater;
    onViewChange({ sorting: next, offset: 0 });
  };

  const onViewChangeRef = React.useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  /** True after the user drag-reorders columns; suppresses canonical order resets. */
  const userReorderedColumnsRef = React.useRef(false);

  React.useEffect(() => {
    userReorderedColumnsRef.current = false;
  }, [context]);

  const setGrouping = React.useCallback(
    (nextGrouping: string) => {
      // Keep columnOrder as the user's preferred order (canonical until they drag).
      // Grouped columns are only moved front at render via displayColumnOrder.
      // Resetting to `columns` when the user has not dragged also heals sessions
      // where an older build persisted the front-pin into columnOrder.
      onViewChange({
        grouping: nextGrouping,
        offset: 0,
        autoUpdate: false,
        ...(userReorderedColumnsRef.current ? {} : { columnOrder: columns }),
      });
      setExpanded({});
    },
    [columns, onViewChange]
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
        filter,
        sorting: sortingStateToOrchestra(view.sorting),
        fields,
        pageSize: view.limit || 50,
        offset: 0,
      });
      suppressNextFlashRef.current = true;
      setTreeRows((prev) => updateGridGroupSubRows(prev, group.id, result.rows, result.count));
      setExpandingId(null);
    },
    [context, fields, filter, projectName, view.grouping, view.limit, view.sorting]
  );

  const loadMoreInGroup = React.useCallback(
    async (row: LogGridRow) => {
      if (!row.group || !groupHasMoreChildren(row)) return;
      const group = row.group;
      setExpandingId(group.id);
      const parentId = group.id.includes('>') ? group.id.split('>').slice(0, -1).join('>') : null;
      const offset = row.subRows?.length ?? 0;
      const result = await fetchGroupChildren({
        projectName,
        context,
        grouping: view.grouping,
        groupingColumnId: group.groupingColumnId,
        groupingValue: String(group.groupingValue),
        parentId,
        filter,
        sorting: sortingStateToOrchestra(view.sorting),
        fields,
        pageSize: view.limit || 50,
        offset,
      });
      suppressNextFlashRef.current = true;
      setTreeRows((prev) =>
        appendGridGroupSubRows(prev, group.id, result.rows, {
          totalChildren: result.count || group.totalChildren,
          exhausted: result.rows.length === 0,
        })
      );
      setExpandingId(null);
    },
    [context, fields, filter, projectName, view.grouping, view.limit, view.sorting]
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
    userReorderedColumnsRef.current = true;
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
    const indexSize = isGrouped ? 88 : 48;
    const indexColumn: ColumnDef<LogGridRow> = {
      id: LOG_ROW_NUMBER_COL,
      header: '#',
      cell: ({ row }) => {
        const key = row.original.group?.id ?? String(row.original.logId);
        return rowLabelMap.get(key) ?? String(view.offset + row.index + 1);
      },
      size: indexSize,
      minSize: isGrouped ? 72 : 40,
      maxSize: isGrouped ? 140 : 64,
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
              isLocked={!!isColumnEditable && !isColumnEditable(key)}
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
                className="-ml-1 flex min-w-0 items-center gap-1"
                style={{ paddingLeft: row.depth * 12 }}
                data-testid={`log-grid-group-cell-${group.id}`}
              >
                <button
                  type="button"
                  className={cn(
                    // Size to the icon so its left edge can align with leaf values (a fixed
                    // w-5 centered target insets the glyph). -ml-1 above offsets Lucide's
                    // viewBox padding so the chevron optically matches the numbers below.
                    'inline-flex shrink-0 items-center justify-center text-muted-foreground transition-transform',
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
    isGrouped,
    rowLabelMap,
    isColumnEditable,
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

  React.useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const update = () => setTableHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [displayRows, visible, isLoading]);

  const selectableRows = React.useMemo(() => flattenLeafRows(displayRows), [displayRows]);
  // Status shows leaf logs loaded in the tree, not top-level group headers.
  const loadedCount = selectableRows.length;

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

  /** Whole-column selection via the column header (Interfaces header click). */
  const selectColumn = React.useCallback(
    (columnId: string, modifiers: { additive?: boolean; range?: boolean } = {}) => {
      if (selection?.mode !== 'cell') return;
      if (!visible.includes(columnId)) return;
      const colCells = cellsForColumn(selectableRows, columnId);
      if (!colCells.length) return;
      const anchorCell = colCells[0]!;

      if (modifiers.range) {
        const anchor = selectionAnchorRef.current ?? selection.selectedCells[0] ?? anchorCell;
        if (!selectionAnchorRef.current) selectionAnchorRef.current = anchor;
        const startColumnId = parseCellId(anchor).columnId;
        selection.onSelectCells(
          cellsForColumnRange(selectableRows, visible, startColumnId, columnId)
        );
        return;
      }

      if (modifiers.additive) {
        const allSelected = colCells.every((id) => selection.selectedCells.includes(id));
        selection.onSelectCells(
          allSelected
            ? selection.selectedCells.filter((id) => !colCells.includes(id))
            : [...selection.selectedCells, ...colCells]
        );
        selectionAnchorRef.current = anchorCell;
        return;
      }

      const allSelected = colCells.every((id) => selection.selectedCells.includes(id));
      selection.onSelectCells(allSelected ? [] : colCells);
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
      if (e.currentTarget instanceof HTMLElement) {
        cellElByIdRef.current.set(cellId, e.currentTarget);
      }
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

  /** Empty chrome / non-cell clicks clear the selection (Excel-style). */
  const clearSelectionOnBackgroundPointerDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (selection?.mode !== 'cell') return;
      if (selection.selectedCells.length === 0) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Cells and row indices manage selection themselves (and stopPropagation).
      if (
        target.closest(
          '[data-testid^="log-grid-cell-"], [data-testid^="log-grid-row-index-"], [data-testid^="log-grid-group-expand-"], [data-testid^="log-grid-group-cell-"]'
        )
      ) {
        return;
      }
      // Headers, menus, filters, and portaled overlays (React portals still bubble
      // through the component tree into this ScrollArea handler).
      if (
        target.closest(
          'thead, [data-testid^="log-grid-header-"], [data-testid="log-grid-row-index-header"], [data-testid="log-grid-inline-editor"], button, input, textarea, [role="separator"], [role="menu"], [role="menuitem"], [data-radix-portal], [data-radix-popper-content-wrapper], [data-radix-popover-content]'
        )
      ) {
        return;
      }
      selection.onSelectCells([]);
      selectionAnchorRef.current = null;
    },
    [selection]
  );

  const openViewPanel = React.useCallback(() => {
    onOpenViewPanel?.();
  }, [onOpenViewPanel]);

  const closeInlineEditor = React.useCallback(() => {
    setEditingCellId(null);
    setEditingAnchorEl(null);
  }, []);

  const nudgeColumnLock = React.useCallback((columnId: string) => {
    const fieldKey = sanitizeId(columnId);
    const testId = `log-grid-column-lock-${fieldKey}`;
    const el = rootRef.current?.querySelector(
      `[data-testid="${testId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`
    ) as HTMLElement | null;
    nudgeElement(el);
  }, []);

  const findCellElement = React.useCallback((cellId: string): HTMLElement | null => {
    const cached = cellElByIdRef.current.get(cellId);
    if (cached?.isConnected) return cached;

    const testId = `log-grid-cell-${cellId}`;
    const matchIn = (root: ParentNode | null): HTMLElement | null => {
      if (!root) return null;
      for (const el of root.querySelectorAll('[data-testid^="log-grid-cell-"]')) {
        if (el.getAttribute('data-testid') === testId) return el as HTMLElement;
      }
      return null;
    };
    const found =
      matchIn(rootRef.current) ?? matchIn(typeof document !== 'undefined' ? document : null);
    if (found) cellElByIdRef.current.set(cellId, found);
    return found;
  }, []);

  const beginCellEdit = React.useCallback(
    (cellId: string, anchorEl?: HTMLElement | null) => {
      if (selection?.mode !== 'cell') return;
      selection.onSelectCells([cellId]);
      selectionAnchorRef.current = cellId;
      rootRef.current?.focus({ preventScroll: true });

      const { columnId } = parseCellId(cellId);
      if (!columnId) return;

      if (isColumnEditable && !isColumnEditable(columnId)) {
        closeInlineEditor();
        nudgeColumnLock(columnId);
        return;
      }

      if (!onCommitCellEdit) {
        closeInlineEditor();
        return;
      }

      const el = anchorEl ?? findCellElement(cellId);
      if (!el) return;
      setEditingCellId(cellId);
      setEditingAnchorEl(el);
    },
    [
      selection,
      isColumnEditable,
      onCommitCellEdit,
      closeInlineEditor,
      nudgeColumnLock,
      findCellElement,
    ]
  );

  const onCellDoubleClick = React.useCallback(
    (cellId: string, anchorEl: HTMLElement) => {
      cellElByIdRef.current.set(cellId, anchorEl);
      beginCellEdit(cellId, anchorEl);
    },
    [beginCellEdit]
  );

  const onRowIndexDoubleClick = React.useCallback(
    (logId: string) => {
      if (selection?.mode !== 'cell') return;
      const rowCells = cellsForRow(logId, visible);
      if (!rowCells.length) return;
      closeInlineEditor();
      selection.onSelectCells(rowCells);
      selectionAnchorRef.current = rowCells[0] ?? null;
      rootRef.current?.focus({ preventScroll: true });
      openViewPanel();
    },
    [selection, visible, openViewPanel, closeInlineEditor]
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
    allowDelete &&
    ((selection?.mode === 'row' && !!selection.selectedRowId) ||
      (selection?.mode === 'cell' && selectedCellLogIds.length > 0));

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
      if (editingCellId) {
        closeInlineEditor();
        return;
      }
      selection.onSelectCells([]);
      selectionAnchorRef.current = null;
      return;
    }
    if (e.key === 'Enter') {
      if (selection.selectedCells.length === 0) return;
      e.preventDefault();
      if (selection.selectedCells.length === 1) {
        const cellId = selection.selectedCells[0]!;
        beginCellEdit(cellId, findCellElement(cellId));
        return;
      }
      closeInlineEditor();
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

  const editingCellDraft = React.useMemo(() => {
    if (!editingCellId) return null;
    const { logId, columnId } = parseCellId(editingCellId);
    if (!columnId) return null;
    const row = selectableRows.find((r) => String(r.logId) === logId);
    const fieldKey = sanitizeId(columnId);
    const value = row?.entries[fieldKey] ?? row?.entries[columnId];
    const draftText = draftForCell?.(columnId, value) ?? formatInlineDraft(value);
    const logIdNum = Number(logId);
    if (!Number.isFinite(logIdNum)) return null;
    return { logId: logIdNum, columnId, fieldLabel: fieldKey, draftText };
  }, [editingCellId, selectableRows, draftForCell]);

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

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {showError ? (
              <div
                className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 p-8"
                data-testid="log-grid-error"
              >
                <p className="text-body-muted">Could not load rows. Please try again.</p>
                {onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    data-testid="log-grid-retry"
                  >
                    Retry
                  </Button>
                )}
              </div>
            ) : !isLoading && !hasData ? (
              <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-8">
                <p className="text-body-muted">No rows match the current filters.</p>
              </div>
            ) : (
              <ScrollArea
                className="min-h-0 min-w-0 flex-1"
                viewportRef={scrollViewportRef}
                viewportTestId="log-grid-scroll-viewport"
                // Radix wraps children in display:table which breaks position:sticky;
                // block restores sticky left pinning for the row-index column.
                viewportClassName="[&>div]:!block"
                viewportProps={{ onMouseDown: clearSelectionOnBackgroundPointerDown }}
              >
                {/* min-h-full so empty space below short tables still receives clicks */}
                <div
                  className="min-h-full"
                  data-testid="log-grid-background"
                  onMouseDown={clearSelectionOnBackgroundPointerDown}
                >
                  <div className="w-max border-b border-border">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToHorizontalAxis]}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext items={visible} strategy={horizontalListSortingStrategy}>
                        <Table
                          ref={tableRef}
                          style={{ width: table.getTotalSize(), tableLayout: 'fixed' }}
                        >
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
                                        style={{
                                          width: header.getSize(),
                                          minWidth: header.getSize(),
                                        }}
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
                                      className={cn(
                                        'sticky top-0 z-20 h-8 whitespace-nowrap border-r border-border bg-card px-1 text-[11px] text-muted-foreground',
                                        selection?.mode === 'cell' && 'cursor-pointer select-none'
                                      )}
                                      style={{
                                        width: header.getSize(),
                                      }}
                                      onMouseDown={(e) => {
                                        if (selection?.mode !== 'cell') return;
                                        if (e.button !== 0) return;
                                        e.stopPropagation();
                                        e.preventDefault();
                                        rootRef.current?.focus({ preventScroll: true });
                                        if (e.shiftKey) {
                                          selectColumn(header.column.id, { range: true });
                                        } else if (e.metaKey || e.ctrlKey) {
                                          selectColumn(header.column.id, { additive: true });
                                        } else {
                                          selectColumn(header.column.id);
                                        }
                                      }}
                                      resizer={
                                        header.column.getCanResize() ? (
                                          <LogGridColumnResizer
                                            columnId={header.column.id}
                                            isResizing={header.column.getIsResizing()}
                                            resizeHandler={header.getResizeHandler()}
                                            tableHeight={tableHeight}
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
                          <TableBody
                            className={selection?.mode === 'cell' ? 'select-none' : undefined}
                          >
                            {table.getRowModel().rows.map((row, rowIndex) => {
                              const isGroup = !!row.original.group;
                              const isSelected =
                                !isGroup && selectedRowId === String(row.original.logId);
                              const flatRows = table.getRowModel().rows;
                              const groupLoadMoreTargets: LogGridRow[] = [];
                              let ancestor = row.getParentRow();
                              while (ancestor) {
                                if (
                                  ancestor.original.group &&
                                  groupHasMoreChildren(ancestor.original)
                                ) {
                                  const next = flatRows[rowIndex + 1];
                                  let nextUnderAncestor = false;
                                  if (next) {
                                    let walk = next.getParentRow();
                                    while (walk) {
                                      if (walk.id === ancestor.id) {
                                        nextUnderAncestor = true;
                                        break;
                                      }
                                      walk = walk.getParentRow();
                                    }
                                  }
                                  if (!nextUnderAncestor) {
                                    groupLoadMoreTargets.push(ancestor.original);
                                  }
                                }
                                ancestor = ancestor.getParentRow();
                              }
                              return (
                                <React.Fragment key={row.id}>
                                  <TableRow
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
                                              {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                              )}
                                            </TableCell>
                                          );
                                        }
                                        const logId = String(row.original.logId);
                                        const rowFullySelected =
                                          !!selectedCells &&
                                          isAllRowSelected(selectedCells, logId, visible);
                                        const firstColSelected =
                                          !!selectedCells &&
                                          visible.length > 0 &&
                                          selectedCells.has(makeCellId(logId, visible[0]!));
                                        return (
                                          <TableCell
                                            key={cell.id}
                                            data-testid={`log-grid-row-index-${logId}`}
                                            style={{
                                              width: cell.column.getSize(),
                                              minWidth: cell.column.getSize(),
                                            }}
                                            className={cn(
                                              'sticky left-0 z-20 cursor-pointer select-none border-r px-1 py-1.5 text-center font-mono text-[12px]',
                                              firstColSelected
                                                ? 'border-transparent'
                                                : 'border-border',
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
                                            {flexRender(
                                              cell.column.columnDef.cell,
                                              cell.getContext()
                                            )}
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
                                            {flexRender(
                                              cell.column.columnDef.cell,
                                              cell.getContext()
                                            )}
                                          </TableCell>
                                        );
                                      }
                                      const cellId = makeCellId(row.original.logId, cell.column.id);
                                      const cellSelected = selectedCells?.has(cellId);
                                      const isNewCell = newCells.has(cellId);
                                      const colIdx = visible.indexOf(cell.column.id);
                                      const rightNeighborSelected =
                                        !!selectedCells &&
                                        colIdx >= 0 &&
                                        colIdx < visible.length - 1 &&
                                        selectedCells.has(
                                          makeCellId(row.original.logId, visible[colIdx + 1]!)
                                        );
                                      return (
                                        <TableCell
                                          key={cell.id}
                                          data-testid={`log-grid-cell-${cellId}`}
                                          style={{
                                            width: cell.column.getSize(),
                                            boxShadow:
                                              cellSelected && selectedCells
                                                ? selectionPerimeterBoxShadow(
                                                    selectedCells,
                                                    row.original.logId,
                                                    cell.column.id,
                                                    visible,
                                                    selectableRows
                                                  )
                                                : undefined,
                                          }}
                                          className={cn(
                                            'max-w-[220px] truncate border-r px-2.5 py-1.5 font-mono text-[12px] hover:bg-muted',
                                            selection?.mode === 'cell' && 'select-none',
                                            cellSelected
                                              ? rightNeighborSelected
                                                ? 'border-transparent bg-primary-tint-10'
                                                : 'border-primary bg-primary-tint-10'
                                              : 'border-border',
                                            isNewCell && 'animate-fade-accent'
                                          )}
                                          onMouseDown={(e) => onCellPointerDown(e, cellId)}
                                          onMouseEnter={(e) => onCellPointerEnter(e, cellId)}
                                          onMouseUp={onCellPointerUp}
                                          onDoubleClick={(e) =>
                                            onCellDoubleClick(cellId, e.currentTarget)
                                          }
                                        >
                                          {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext()
                                          )}
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                  {groupLoadMoreTargets.map((target) => {
                                    const group = target.group!;
                                    const busy = expandingId === group.id;
                                    return (
                                      <TableRow
                                        key={`load-more-${group.id}`}
                                        data-testid={`log-grid-group-load-more-${group.id}`}
                                      >
                                        <TableCell
                                          colSpan={visible.length + 1}
                                          className="border-r border-border px-2.5 py-2"
                                          style={{
                                            paddingLeft: (row.depth + 1) * 12,
                                          }}
                                        >
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="text-caption h-7"
                                            disabled={busy}
                                            data-testid={`log-grid-group-load-more-btn-${sanitizeId(group.fieldKey)}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void loadMoreInGroup(target);
                                            }}
                                          >
                                            {busy ? 'Loading more…' : 'Load more'}
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </React.Fragment>
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
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
            {viewPanel}
          </div>

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

          {editingCellId && editingAnchorEl && editingCellDraft && onCommitCellEdit ? (
            <LogCellInlineEditor
              anchorEl={editingAnchorEl}
              draftText={editingCellDraft.draftText}
              fieldLabel={editingCellDraft.fieldLabel}
              scrollParent={scrollViewportRef.current}
              onCancel={closeInlineEditor}
              onCommit={async (draft) =>
                onCommitCellEdit(editingCellDraft.logId, editingCellDraft.columnId, draft)
              }
            />
          ) : null}
        </>
      )}
    </div>
  );
}
