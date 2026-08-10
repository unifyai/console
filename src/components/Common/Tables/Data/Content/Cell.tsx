'use client';

import { useState, CSSProperties, ReactNode, Dispatch, SetStateAction, useEffect } from 'react';

import { Header, Cell, Row, Table, flexRender } from '@tanstack/react-table';
import { useSortable } from '@dnd-kit/sortable';
import { CSS, Transform } from '@dnd-kit/utilities';

import { TableCell } from '@/components/UI/table';
import { DraggingColumnsState } from '@/types/interfaces/columns';

import { CornerDownLeft } from 'lucide-react';
import ColumnResizer from '../Buttons/ColumnResize';
import ColumnPinner from '../Buttons/ColumnPinner';
import { Skeleton } from '@/components/UI/skeleton';
import { sanitizeId } from '@/utils/interfaces/table/columnOperations';
import { RowExpandingProps } from '../Buttons/RowExpanding';
import { StateProps } from '@/types/dataTable';
import { isImeComposing } from '@/utils/keyboard';

const DataTableCell = ({
  cell,
  row,
  table,
  selectedCells,
  isCellSelected,
  cellSelection,
  resizeMap,
  ExtraCellContent,
  AggregatedCell,
  isCellExpanded,
  setExpandedCells,
  draggingColumns,
  RowExpanding,
  isAnimating,
  expandingRowId,
  setExpandingRowId,
  state,
  children,
  setDraggingColumnPinner,
  isRightmost,
  // Inline editing
  editEnabled,
  isCellMutable,
  onCommitCellEdit,
  onBlockedEdit,
  editingCellId,
  setEditingCellId,
}: {
  cell: Cell<any, unknown>;
  row: Row<any>;
  table: Table<any>;
  selectedCells: string[];
  isCellSelected: (cell: Cell<any, any>) => boolean;
  cellSelection: {
    handleCellMouseDown: (
      e: React.MouseEvent<HTMLElement>,
      target: Cell<any, any> | Header<any, any>
    ) => void;
    handleCellMouseUp: (
      e: React.MouseEvent<HTMLElement>,
      target: Cell<any, any> | Header<any, any>
    ) => void;
    handleCellMouseOver: (
      e: React.MouseEvent<HTMLElement>,
      target: Cell<any, any> | Header<any, any>
    ) => void;
    handleCellsKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  };
  resizeMap: { [x: string]: (event: unknown) => void };
  ExtraCellContent?: (
    cell: Cell<any, unknown>,
    isCellExpanded: (cell: Cell<any, unknown>) => boolean,
    setExpandedCells: Dispatch<SetStateAction<{ [k: string]: boolean }>>
  ) => ReactNode;
  AggregatedCell?: (cell: Cell<any, unknown>, row: Row<any>) => ReactNode;
  isCellExpanded: (cell: Cell<any, unknown>) => boolean;
  setExpandedCells: Dispatch<SetStateAction<{ [k: string]: boolean }>>;
  draggingColumns: DraggingColumnsState;
  RowExpanding?: (props: RowExpandingProps) => ReactNode;
  isAnimating: boolean;
  expandingRowId: string | null;
  setExpandingRowId: (id: string | null) => void;
  state: StateProps;
  children?: ReactNode;
  setDraggingColumnPinner: (state: any) => void;
  isRightmost?: boolean;
  // Inline editing
  editEnabled?: boolean;
  isCellMutable?: (cell: Cell<any, unknown>) => boolean;
  onCommitCellEdit?: (payload: {
    rowIds: string[];
    source: 'entries' | 'params';
    path: (string | number)[];
    newValue: any;
  }) => Promise<void>;
  onBlockedEdit?: (cell: Cell<any, unknown>) => void;
  editingCellId?: string | null;
  setEditingCellId?: (id: string | null) => void;
}) => {
  const { isDragging, setNodeRef, transform } = useSortable({
    id: cell.column.id,
  });

  const columnID = cell.column.columnDef.id!;
  const cellID = `${cell.row.id}_${sanitizeId(columnID)}`;
  const isNewCell = state.newCells ? state.newCells.includes(cellID) : undefined;

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState<any>(undefined);

  // Derived helpers for editing
  const dataType = cell.column.columnDef.meta?.dataType;
  const fieldType = cell.column.columnDef.meta?.fieldType;
  const isGroupCell = cell.getIsGrouped();
  const isPlaceholder = cell.getIsPlaceholder();
  const canAttemptEdit =
    !!editEnabled && !isGroupCell && !isPlaceholder && cell.column.id !== 'RowNumbering';
  const cellIsMutable = typeof isCellMutable === 'function' ? isCellMutable(cell) : true;

  const thisCellId = `${row.id}:${cell.column.id}`;

  const startEdit = () => {
    if (!canAttemptEdit || !cellIsMutable) return;
    // Claim the global editor slot
    if (typeof setEditingCellId === 'function') setEditingCellId(thisCellId);
    // Set initial draft from current rendered value (use raw accessor value)
    let value = cell.getValue();
    setDraftValue(value);
    setIsEditing(true);
  };
  // If user double-clicked but cell is not editable, call the blocked callback
  const maybeStartOrBlock = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (!canAttemptEdit) return;
    if (!cellIsMutable) {
      if (typeof setEditingCellId === 'function') setEditingCellId(null);
      if (typeof onBlockedEdit === 'function') onBlockedEdit(cell);
      return;
    }
    startEdit();
  };

  const cancelEdit = () => {
    setIsEditing(false);
    if (typeof setEditingCellId === 'function' && editingCellId === thisCellId)
      setEditingCellId(null);
  };

  const commitEdit = async () => {
    if (!onCommitCellEdit) {
      setIsEditing(false);
      if (typeof setEditingCellId === 'function' && editingCellId === thisCellId)
        setEditingCellId(null);
      return;
    }
    try {
      setIsCommitting(true);
      // Immediately close the editor and release the global lock
      setIsEditing(false);
      if (typeof setEditingCellId === 'function' && editingCellId === thisCellId)
        setEditingCellId(null);
      // Build payload
      const rowId = String(row.id);
      const columnIdSanitized = sanitizeId(cell.column.id);
      const source: 'entries' | 'params' =
        cell.column.columnDef.meta?.columnType === 'params' ? 'params' : 'entries';
      const path = columnIdSanitized.split('/');
      await onCommitCellEdit({ rowIds: [rowId], source, path, newValue: draftValue });
    } catch (e) {
      // Editor already closed; just stop committing flag
    } finally {
      setIsCommitting(false);
    }
  };

  // Enforce single-active-editor: if another cell is being edited, close this one
  useEffect(() => {
    if (editingCellId !== thisCellId && isEditing) {
      setIsEditing(false);
    }
  }, [editingCellId, thisCellId, isEditing]);

  // Pre-calculate checks for active and over states
  const isInActiveGroup = draggingColumns.active.ids?.includes(columnID);
  const isInOverGroup = draggingColumns.over.ids?.includes(columnID);

  // Consolidate into a single flag for overall dragging state
  const isPartOfDraggingState = isInActiveGroup || isInOverGroup;

  // For dragging columns that are parents, use the transform/transition from the parent dragging state
  const isColumnDragging = isDragging || isPartOfDraggingState;

  const isPinned = cell.column.getIsPinned();
  const pinnedPosition = cell.column.getIsPinned();
  const isLastLeftPinnedColumn = isPinned === 'left' && cell.column.getIsLastColumn('left');
  const isParentColumn = cell.column.columnDef.meta?.isParent;

  // Determine the applied transform for both dragging and pinning
  const appliedTransform: Transform | null = isDragging
    ? transform
    : isInActiveGroup
      ? (draggingColumns.active.transform ?? null)
      : isInOverGroup
        ? (draggingColumns.over.transform ?? null)
        : isParentColumn
          ? null
          : transform;

  const appliedTransition = isDragging ? 'width transform 0.2s ease-in-out' : undefined;

  const properties = row.getAllCells().map((cell) => cell.column.id);

  // Handle cell coloring.
  // - Applies background color on any non aggregated, non placeholder, non grouped cell when hovered / selected
  // - Applied background color on any index cell if all non aggregated, non placeholder, non grouped cells in the same row are selected
  const [hovered, setHovered] = useState(false);
  const isSelectableCell = (cell: Cell<any, unknown>) =>
    !cell.getIsAggregated() &&
    !cell.getIsPlaceholder() &&
    cell.column.getIsVisible() &&
    (cell.column.id === 'RowNumbering' || cell.getValue() !== undefined);
  const isAllRowSelected = (cell: Cell<any, unknown>) => {
    const dataCells = cell
      .getContext()
      .row.getAllCells()
      .filter((c) => isSelectableCell(c) && c.column.id != 'RowNumbering');
    const allSelected = dataCells.every((c) => isCellSelected(c));
    const allHidden = Object.entries(state.columnVisibility).filter(([, v]) => v).length === 1; // Only RowNumbering column visible
    return allSelected && !allHidden;
  };

  // determine border thickness so cells share group boundary thickness
  const leafCols = table.getAllLeafColumns();
  const maxDepth = Math.max(...leafCols.map((c) => c.depth));
  // find all ancestor group columns where this column is the last leaf
  let ancestor = cell.column;
  const boundaryDepths: number[] = [];
  while (ancestor) {
    if (ancestor.columnDef.meta?.isParent) {
      const leafs = ancestor.getLeafColumns();
      if (leafs[leafs.length - 1].id === cell.column.id) {
        boundaryDepths.push(ancestor.depth);
      }
    }
    ancestor = ancestor.parent!;
  }
  const boundaryDepth = boundaryDepths.length ? Math.min(...boundaryDepths) : cell.column.depth;
  const borderThickness =
    columnID === 'RowNumbering' ? 1 : Math.max(1, maxDepth - boundaryDepth + 1);

  const style: CSSProperties = {
    boxShadow: isLastLeftPinnedColumn ? '-4px 0 4px -4px gray inset' : undefined,
    opacity: isColumnDragging ? 0.8 : 1,
    position: isPinned ? 'sticky' : undefined,
    left: isPinned === 'left' ? `${cell.column.getStart('left')}px` : undefined,
    right: isPinned === 'right' ? `${cell.column.getAfter('right')}px` : undefined,
    transform: CSS.Translate.toString(appliedTransform), // translate instead of transform to avoid squishing
    transition: appliedTransition,
    minWidth: 0,
    width: `${Math.round(cell.column.getSize())}px`,
    zIndex: isColumnDragging || isPinned ? 1 : 0,
    // thin left edge only for row numbers, dynamic right edge for all columns
    borderLeft: columnID === 'RowNumbering' ? '1px solid var(--muted)' : undefined,
    borderRight: `${borderThickness}px solid var(--muted)`,
    borderTop: '1px solid var(--muted)',
    borderBottom: '1px solid var(--muted)',
    outline: 'none',
    color:
      cell.column.id != 'RowNumbering'
        ? isCellSelected(cell)
          ? 'var(--primary-foreground)'
          : ''
        : isSelectableCell(cell) && isAllRowSelected(cell)
          ? 'var(--primary-foreground)'
          : '',
    backgroundColor:
      cell.column.id != 'RowNumbering'
        ? isCellSelected(cell)
          ? `var(--primary)`
          : hovered
            ? 'var(--muted)'
            : isPinned
              ? 'var(--background)'
              : ''
        : isSelectableCell(cell) && isAllRowSelected(cell)
          ? `var(--primary)`
          : hovered
            ? 'var(--muted)'
            : isPinned
              ? 'var(--background)'
              : '',
    backgroundImage:
      cell.column.id !== 'RowNumbering' && cell.getValue() === undefined
        ? `repeating-linear-gradient(90deg, color-mix(in srgb, var(--foreground) 20%, transparent) 0 1px, transparent 1px 4px)`
        : undefined,
  };

  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Check if this row is grouped and has subrows that have not been populated yet
  const hasSkeletonLogs =
    'groupCount' in row.original && row.original.groupCount > 0 && !row.original.isPopulated;

  // Check if this cell should show grouping controls
  const shouldShowGrouping =
    cell.getIsGrouped() ||
    ('groupCount' in row.original &&
      row.original.groupCount > 0 &&
      columnID === sanitizeId(row.original.groupingColumnId));

  if (cell.isRowSpanned) return null;

  const isNotUtilColumn = cell.column.columnDef.meta?.columnType !== 'util';

  const renderEditor = () => {
    const overlayCls = 'absolute inset-0 flex items-center';
    const commonCls =
      'w-full h-full px-2 py-0 text-body-sm bg-background text-foreground outline-none border-0 focus:ring-0 focus:outline-none box-border';
    // Choose widget per dataType
    if (dataType === 'number') {
      return (
        <div className={overlayCls}>
          <input
            type="number"
            className={commonCls}
            value={draftValue ?? ''}
            onChange={(e) => setDraftValue(e.target.value === '' ? '' : Number(e.target.value))}
            onKeyDown={(e) => {
              if (isImeComposing(e)) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
              }
            }}
            autoFocus
            onBlur={() => (isEditing ? setIsEditing(false) : null)}
          />
        </div>
      );
    }
    if (dataType === 'image' || dataType === 'audio' || dataType === 'pdf') {
      // Non-editable rich types
      return (
        <div className="text-caption flex h-full w-full items-center text-muted-foreground">
          Editing not supported for this type
        </div>
      );
    }
    const isMultiline =
      typeof draftValue === 'object' || (typeof draftValue === 'string' && draftValue.length > 100);
    if (isMultiline) {
      return (
        <div className={overlayCls}>
          <textarea
            className={`${commonCls} resize-none overflow-hidden font-mono`}
            rows={1}
            value={
              typeof draftValue === 'string'
                ? draftValue
                : JSON.stringify(draftValue ?? '', null, 2)
            }
            onChange={(e) => setDraftValue(e.target.value)}
            onKeyDown={(e) => {
              if (isImeComposing(e)) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
              }
            }}
            autoFocus
          />
        </div>
      );
    }
    return (
      <div className={overlayCls}>
        <input
          className={commonCls}
          value={draftValue ?? ''}
          onChange={(e) => setDraftValue(e.target.value)}
          onKeyDown={(e) => {
            if (isImeComposing(e)) return;
            if (e.key === 'Enter') {
              e.preventDefault();
              commitEdit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
          }}
          autoFocus
          onBlur={() => (isEditing ? setIsEditing(false) : null)}
        />
      </div>
    );
  };

  const content = (() => {
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <div className="flex-1">{renderEditor()}</div>
        </div>
      );
    }

    return (
      <div
        className="text-body-sm overflow-hidden truncate text-ellipsis text-nowrap ..."
        onDoubleClick={(e) => {
          maybeStartOrBlock(e);
        }}
      >
        {shouldShowGrouping
          ? properties.includes(columnID) && (
              <div className="flex flex-row items-center gap-2 overflow-hidden truncate text-left ...">
                {RowExpanding &&
                  RowExpanding({
                    row,
                    groupingColumnId: row.original.groupingColumnId,
                    isLoading,
                    isAnimating,
                    onExpand: () => Promise.resolve(),
                    setExpandingRowId,
                  })}
                {isLoading ? (
                  <div className="flex-1">
                    <Skeleton className="h-4 w-[100px]" />
                  </div>
                ) : (
                  <>
                    ({row.original.groupCount}){' '}
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </>
                )}
              </div>
            )
          : row.getIsGrouped() && isNotUtilColumn
            ? flexRender(AggregatedCell && AggregatedCell(cell, row), cell.getContext())
            : cell.getIsPlaceholder()
              ? null // For cells with repeated values, render null
              : flexRender(cell.column.columnDef.cell, cell.getContext())}
      </div>
    );
  })();

  return (
    <TableCell
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => cellSelection.handleCellMouseDown(e, cell)}
      onMouseUp={(e) => cellSelection.handleCellMouseUp(e, cell)}
      onMouseOver={(e) => cellSelection.handleCellMouseOver(e, cell)}
      onKeyDown={(e) => cellSelection.handleCellsKeyDown(e)}
      onDoubleClick={(e) => {
        maybeStartOrBlock(e);
      }}
      rowSpan={cell.rowSpan}
      style={style}
      tabIndex={0} // Needed to ensure the table is focusable and the keyboard actions are working
      ref={setNodeRef}
      className={`group/cell relative select-none p-1 ${isNewCell ? 'animate-fade-accent' : ''}`}
    >
      {content}

      {isCommitting && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <Skeleton className="h-full w-full" />
        </div>
      )}

      {(() => {
        const showResizer = cell.column.getCanResize() && !state.draggingColumnPinner.isPinning;
        if (!showResizer) return null;

        return <ColumnResizer column={cell.column} resizeHandler={resizeMap[cell.column.id]} />;
      })()}

      {isLastLeftPinnedColumn && (
        <div className="absolute inset-y-0 right-0" style={{ width: 5 }}>
          <ColumnPinner
            column={cell.column}
            table={table}
            columnOrder={state.columnOrder}
            draggingColumnPinner={state.draggingColumnPinner}
            setDraggingColumnPinner={setDraggingColumnPinner}
          />
        </div>
      )}

      {ExtraCellContent &&
        isSelectableCell(cell) &&
        ExtraCellContent(cell, isCellExpanded, setExpandedCells)}

      {selectedCells.length > 0 && selectedCells.indexOf(cell.id) === selectedCells.length - 1 && (
        <CornerDownLeft className="absolute bottom-1 right-0.5 z-20 h-3 w-5 font-bold text-white" />
      )}

      {children}
    </TableCell>
  );
};

export default DataTableCell;
