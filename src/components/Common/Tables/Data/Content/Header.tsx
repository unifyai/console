'use client';

import {
  useState,
  CSSProperties,
  ReactNode,
  useRef,
  SetStateAction,
  Dispatch,
  useEffect,
  useCallback,
} from 'react';
import { sanitizeId } from '@/utils/interfaces/table/columnOperations';
import { useMemo } from 'react';

import { flexRender, Header, Column, Table, Cell } from '@tanstack/react-table';
import { useSortable } from '@dnd-kit/sortable';
import { CSS, Transform } from '@dnd-kit/utilities';

import { TableHead } from '@/components/UI/table';
import {
  getNextLeafColumn,
  getPreviousLeafColumn,
} from '@/utils/interfaces/table/columnOperations';
import { DraggingColumnPinnerState, DraggingColumnsState } from '@/types/interfaces/columns';
import { getCellsFromHeader, getSelectableTableCells } from '@/hooks/Interfaces/useCellSelection';
import { getColumnGroupIDs } from '@/utils/interfaces/table/table';

// Column action components
import ColumnSort from '../Buttons/ColumnSort';
import ColumnHide from '../Buttons/ColumnHide';
import ColumnShow from '../Buttons/ColumnShow';
import ColumnContext from '../Buttons/ColumnContext';
import ColumnPinner from '../Buttons/ColumnPinner';
import ColumnRename from '@/components/Pages/Interfaces/Blocks/Table/Buttons/ColumnRename';
import ColumnResizer from '@/components/Common/Tables/Data/Buttons/ColumnResize';

// Shadcn UI dropdown
import { DropdownMenuGroup, DropdownMenuItem } from '@/components/UI/dropdown-menu';
import BaseDropdown from '@/components/Common/Dropdowns/Base';

// Icon / button
import ActionButton from '@/components/Common/Buttons/Action';
import { MoreVertical, Group, ArrowUpDown, Filter, FolderTree, EyeOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

import { shouldRenderHeader, calculateRowSpan } from '@/utils/interfaces/table/table';
import BaseDialog from '@/components/Common/Dialogs/Base';
import { Input } from '@/components/UI/input';
import SubmitButton from '@/components/Common/Buttons/Submit';
import { isImeComposing } from '@/utils/keyboard';

const DataTableHeader = ({
  interactive,
  autoUpdate,
  data,
  table,
  header,
  headerGroupIndex,
  isCellSelected,
  cellSelection,
  resizeMap,
  columnVisibility,
  setColumnVisibility,
  grouping,
  setGrouping,
  ColumnGroupBy,
  ColumnGroupSort,
  ColumnFilters,
  ColumnDelete,
  ColumnCreate,
  ColumnUpdate,
  context,
  setContext,
  draggingColumns,
  columnOrder,
  setColumnOrder,
  columnPinning,
  draggingColumnPinner,
  setDraggingColumnPinner,
  onRenameColumn,
  children,
  columnActionsApplied,
  setColumnActionsApplied,
  isRightmost,
}: {
  interactive?: boolean;
  autoUpdate?: boolean;
  data: any[];
  table: Table<any>;
  headerGroupIndex: number;
  header: Header<any, unknown>;
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
  columnVisibility: { [key: string]: boolean };
  setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void;
  grouping: string[];
  setGrouping: (grouping: string[]) => void;
  ColumnGroupBy?: (
    column: Column<any | unknown>,
    groupLoading: boolean,
    setGroupLoading: (groupLoading: boolean) => void,
    setIsGrouped: (isGrouped: boolean) => void,
    setGroupSortLoading: (groupSortLoading: boolean) => void,
    renderMode: 'button' | 'menuItem'
  ) => ReactNode;
  ColumnGroupSort?: (
    column: Column<any | unknown>,
    groupSortLoading: boolean,
    setGroupSortLoading: (groupSortLoading: boolean) => void,
    setSortingDirection: (sortingDirection: 'asc' | 'desc' | false) => void,
    renderMode: 'button' | 'menuItem',
    direction?: 'asc' | 'desc'
  ) => ReactNode;
  ColumnFilters?: (
    column: Column<any | unknown>,
    filterLoading: boolean,
    setIsFiltered: (isFiltered: boolean) => void,
    setFilterLoading: (filterLoading: boolean) => void,
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>,
    renderMode: 'button' | 'menuItem'
  ) => ReactNode;
  ColumnDelete?: (column: Column<any | unknown>) => ReactNode;
  ColumnCreate?: (previousColumn: string, setOpen: (open: boolean) => void) => ReactNode;
  ColumnUpdate?: (
    key: string,
    updateLoading: boolean,
    setUpdateLoading: (updateLoading: boolean) => void,
    open: boolean,
    setOpen: Dispatch<SetStateAction<boolean>>,
    renderMode: 'button' | 'menuItem'
  ) => ReactNode;
  context: string | null;
  setContext: (context: string | null) => void;
  draggingColumns: DraggingColumnsState;
  columnOrder: string[];
  setColumnOrder: (columnOrder: string[]) => void;
  columnPinning: { left?: string[]; right?: string[] };
  draggingColumnPinner: DraggingColumnPinnerState;
  setDraggingColumnPinner: (state: DraggingColumnPinnerState) => void;
  onRenameColumn?: (oldName: string, newName: string) => void;
  children?: ReactNode;
  columnActionsApplied: { [depth: number]: { [columnId: string]: boolean } };
  setColumnActionsApplied: Dispatch<
    SetStateAction<{ [depth: number]: { [columnId: string]: boolean } }>
  >;
  isRightmost?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useSortable({
    id: header.column.id,
    data: {
      group: getColumnGroupIDs(header.column),
    },
  });

  // Pre-calculate checks for active and over states
  const isInActiveGroup = draggingColumns.active.ids?.includes(header.column.id);
  const isInOverGroup = draggingColumns.over.ids?.includes(header.column.id);

  // Consolidate into a single flag for overall dragging state
  const isPartOfDraggingState = isInActiveGroup || isInOverGroup;

  // For dragging columns that are parents, use the transform/transition from the parent dragging state
  const isColumnDragging = isDragging || isPartOfDraggingState;

  const isPinned = header.column.getIsPinned();
  const isLastLeftPinnedColumn = isPinned === 'left' && header.column.getIsLastColumn('left');
  const isParentColumn = header.column.columnDef.meta?.isParent;

  const isNotUtilColumn = header.column.columnDef.meta?.columnType != 'util';
  const isDerivedColumn = header.column.columnDef.meta?.fieldType === 'derived_entry';
  const isImageColumn = header.column.columnDef.meta?.dataType === 'image';
  const isGroupSortableColumn =
    header.column.columnDef.meta?.dataType === 'float' ||
    header.column.columnDef.meta?.dataType === 'int' ||
    header.column.columnDef.meta?.dataType === 'bool' ||
    header.column.columnDef.meta?.dataType === 'timestamp' ||
    header.column.columnDef.meta?.dataType === 'time' ||
    header.column.columnDef.meta?.dataType === 'date' ||
    header.column.columnDef.meta?.dataType === 'timedelta';

  // Handle pinning animation
  const isPinning =
    draggingColumnPinner.isPinning &&
    (header.column.id === draggingColumnPinner.columnId || // Current column being pinned
      (draggingColumnPinner.direction === 'right' &&
        header.column.id === getNextLeafColumn(header.column, columnOrder, table)?.id) || // Next column when pinning right
      (draggingColumnPinner.direction === 'left' &&
        header.column.id === getPreviousLeafColumn(header.column, columnOrder, table)?.id)); // Previous column when pinning left

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

  // Add pinning border highlight
  const pinningBorderStyle = isPinning
    ? {
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          [draggingColumnPinner.direction === 'right' ? 'right' : 'left']: 0,
          width: '2px',
          background: 'var(--primary)',
          opacity: 0.7,
        },
      }
    : {};

  // Track loading states for column actions
  const [groupLoading, setGroupLoading] = useState(false);
  const [sortLoading, setSortLoading] = useState(false);
  const [groupSortLoading, setGroupSortLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  // Determine which actions should be shown in dropdown vs as buttons
  const [isGrouped, setIsGrouped] = useState(false);
  const [sortingDirection, setSortingDirection] = useState<'asc' | 'desc' | false>(false);
  const [groupSortingDirection, setGroupSortingDirection] = useState<'asc' | 'desc' | false>(false);
  const [isFiltered, setIsFiltered] = useState(false);

  // Open states for dialogs
  const [filterOpen, setFilterOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState<string>('');

  // Event listeners to update open / loading states
  useEffect(() => {
    if (groupSortLoading || groupLoading || sortLoading || filterLoading || updateLoading) {
      setDropdownOpen(false);
    } else {
      setDropdownOpen(false);
    }
  }, [data, groupSortLoading, groupLoading, sortLoading, filterLoading, updateLoading]);
  useEffect(() => setFilterLoading(false), [data]);
  useEffect(() => setSortLoading(false), [data]);
  useEffect(() => setGroupSortLoading(false), [data]);

  // Functions to control which buttons should be shown
  const showGroupButton = useCallback(() => {
    return !isImageColumn && (groupLoading || isGrouped);
  }, [isImageColumn, groupLoading, isGrouped]);

  const showSortButton = useCallback(() => {
    return !isParentColumn && (sortLoading || sortingDirection != false);
  }, [isParentColumn, sortLoading, sortingDirection]);

  const showGroupSortButton = useCallback(() => {
    return (
      !isParentColumn && grouping.length && (groupSortLoading || groupSortingDirection != false)
    );
  }, [isParentColumn, grouping, groupSortLoading, groupSortingDirection]);

  const showFilterButton = useCallback(() => {
    return !isParentColumn && (filterLoading || isFiltered);
  }, [isParentColumn, filterLoading, isFiltered]);

  const showUpdateButton = useCallback(() => {
    return !isParentColumn && isDerivedColumn && updateLoading;
  }, [isParentColumn, isDerivedColumn, updateLoading]);

  const hasActiveActions = useMemo(() => {
    return (
      showGroupSortButton() ||
      showGroupButton() ||
      showSortButton() ||
      showFilterButton() ||
      showUpdateButton()
    );
  }, [showGroupSortButton, showGroupButton, showSortButton, showFilterButton, showUpdateButton]);

  useEffect(() => {
    setColumnActionsApplied((prev) => {
      const depth = header.column.columnDef.meta?.renderedDepth ?? 0;
      const columnId = header.column.id;

      return {
        ...prev,
        [depth]: {
          ...prev[depth], // Preserve existing columns at the same depth
          [columnId]: hasActiveActions, // Update the current column
        },
      };
    });
  }, [
    hasActiveActions,
    groupSortingDirection,
    groupSortLoading,
    groupLoading,
    isGrouped,
    sortLoading,
    sortingDirection,
    filterLoading,
    isFiltered,
    updateLoading,
    data,
    header.column.id,
    header.column.columnDef.meta?.renderedDepth,
    setColumnActionsApplied,
  ]);

  // Visible action buttons for active states
  const activeActionsRef = useRef<HTMLDivElement | null>(null);
  const actionButtonRef = useRef<HTMLButtonElement | null>(null);
  const renderVisibleActions = () => (
    <>
      {ColumnGroupBy && (
        <div className={`${showGroupButton() ? '' : 'hidden'}`}>
          {ColumnGroupBy(
            header.column,
            groupLoading,
            setGroupLoading,
            setGroupSortLoading,
            setIsGrouped,
            'button'
          )}
        </div>
      )}
      <div className={`${showSortButton() ? '' : 'hidden'}`}>
        {
          <ColumnSort
            interactive={interactive}
            column={header.column}
            data={data}
            sortLoading={sortLoading}
            setSortLoading={setSortLoading}
            setSortingDirection={setSortingDirection}
            renderMode="button"
          />
        }
      </div>
      <div className={`${showGroupSortButton() ? '' : 'hidden'}`}>
        {ColumnGroupSort &&
          ColumnGroupSort(
            header.column,
            groupSortLoading,
            setGroupSortLoading,
            setGroupSortingDirection,
            'button'
          )}
      </div>
      {showFilterButton() &&
        ColumnFilters &&
        ColumnFilters(
          header.column,
          filterLoading,
          setIsFiltered,
          setFilterLoading,
          filterOpen,
          setFilterOpen,
          'button'
        )}
      {showUpdateButton() &&
        ColumnUpdate &&
        ColumnUpdate(
          header.column.id,
          updateLoading,
          setUpdateLoading,
          updateOpen,
          setUpdateOpen,
          'button'
        )}
    </>
  );

  // Calculate row span for vertical merging and skip children
  // headers whose parent are spanned vertically
  const calculatedRowSpan = calculateRowSpan(header, table, headerGroupIndex);
  // Always render header cell (even placeholders) to keep vertical borders continuous
  const shouldRender = shouldRenderHeader(header, table, headerGroupIndex);

  // Handle header coloring.
  // - Applies selection (hover) background color on any column header for which all (some) cells are selected
  // - Applied selection (hover) background color index column header if all (some) table cells are selected
  const isAllColumnSelected = (header: Header<any, unknown>) => {
    const validCells = getCellsFromHeader(header).filter(
      (cell) => cell.getValue() !== undefined || cell.column.id === 'RowNumbering'
    );
    return validCells.length && validCells.every((cell) => isCellSelected(cell));
  };
  const isAllTableSelected = () =>
    table.getRowModel().rows.length &&
    getSelectableTableCells(table).every((cell) => isCellSelected(cell)) &&
    Object.entries(columnVisibility).filter(([, v]) => v).length != 1;

  // determine border thickness so headers share group boundary thickness
  const leafCols = table.getAllLeafColumns();
  const maxDepth = Math.max(...leafCols.map((c) => c.depth));
  let ancestorCol = header.column;
  const boundaryDepths: number[] = [];
  while (ancestorCol) {
    if (ancestorCol.columnDef.meta?.isParent) {
      const leafs = ancestorCol.getLeafColumns();
      if (leafs[leafs.length - 1].id === header.column.id) {
        boundaryDepths.push(ancestorCol.depth);
      }
    }
    ancestorCol = ancestorCol.parent!;
  }
  const boundaryDepth = boundaryDepths.length ? Math.min(...boundaryDepths) : header.column.depth;
  const borderThickness =
    header.column.id === 'RowNumbering' ? 1 : Math.max(1, maxDepth - boundaryDepth + 1);

  // compute left offset: if any child pinned, use its start; otherwise use index column width
  const indexColumn = table.getColumn('RowNumbering');
  const indexWidth = indexColumn?.getSize() ?? 0;
  const pinnedLeaf = header.column.getLeafColumns().find((c) => c.getIsPinned());
  const pinnedAreaWidth = pinnedLeaf ? pinnedLeaf.getStart('left') : indexWidth;
  // determine if all visible leaf children are pinned
  const allVisibleLeafsPinned = header.column
    .getLeafColumns()
    .filter((c) => c.getIsVisible())
    .every((c) => c.getIsPinned());

  // determine stickiness: child columns pinned directly or parent when all visible leaves pinned
  const isParentFullyPinned = isParentColumn && allVisibleLeafsPinned;
  const isChildPinned = isPinned && !isParentColumn;
  const style: CSSProperties = {
    boxShadow: isLastLeftPinnedColumn ? `-4px 0 4px -4px var(--border) inset` : undefined,
    opacity: isColumnDragging ? 0.8 : 1,
    position: isChildPinned || isParentFullyPinned ? 'sticky' : undefined,
    left: isParentFullyPinned
      ? `${pinnedAreaWidth}px`
      : isChildPinned
        ? `${header.column.getStart('left')}px`
        : undefined,
    right: isPinned === 'right' ? `${header.column.getAfter('right')}px` : undefined,
    transform: CSS.Translate.toString(appliedTransform), // translate instead of transform to avoid squishing
    transition: appliedTransition,
    whiteSpace: 'normal',
    width: `${Math.round(header.getSize())}px`,
    minWidth: hasActiveActions ? activeActionsRef.current?.clientWidth : 0,
    zIndex: isChildPinned || isParentFullyPinned ? 2 : isColumnDragging ? 1 : 0,
    borderLeft: header.column.id === 'RowNumbering' ? '1px solid var(--muted)' : undefined,
    borderRight: `${borderThickness}px solid var(--muted)`,
    borderTop: '1px solid var(--muted)',
    borderBottom:
      header.depth + calculatedRowSpan >= table.getHeaderGroups().length
        ? '1px solid var(--muted)'
        : undefined,
    verticalAlign: calculatedRowSpan > 1 ? 'middle' : undefined,
    color: isAllColumnSelected(header) ? 'var(--primary-foreground)' : '',
  };

  /** Determine background color using tailwind classes, applying style in the following order of priority
   * Selection
   * Pinning (only if not selected)
   * Default & Hover (only if not selected and not pinned)
   */
  const isIndexColumn = header.column.id === 'RowNumbering';
  const isPlaceholderColumn = header.isPlaceholder;
  const isSelected =
    isNotUtilColumn && !isPlaceholderColumn ? isAllColumnSelected(header) : isAllTableSelected();
  const selectionClass = isSelected ? 'bg-primary' : '';
  const pinnedClass = isPinned && !isSelected ? 'bg-background' : '';
  const defaultBgClass = !isSelected && !isPinned ? 'bg-transparent' : '';
  const hoverClass =
    !isSelected &&
    (!isPinned || isIndexColumn) &&
    !dropdownOpen &&
    (!isPlaceholderColumn || isIndexColumn)
      ? 'hover:bg-muted'
      : '';

  const maxLabelWidth = Math.max(
    Number((style.width as string).split('px')[0]) - (actionButtonRef.current?.clientWidth ?? 0),
    10
  );

  // Double click rename handler for leaf (child) columns
  const handleHeaderDoubleClick = () => {
    if (!interactive || !onRenameColumn || isParentColumn || header.isPlaceholder) return;
    const rawId = header.id.split('/').pop() || header.id;
    setRenameValue(rawId);
    setRenameOpen(true);
  };

  const renameDialog = (
    <BaseDialog
      context="tile"
      open={renameOpen}
      setOpen={setRenameOpen}
      button={null}
      triggerClassName="hidden"
      title="Rename Column"
      body={
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (isImeComposing(e)) return;
            if (e.key === 'Enter') submitRename();
          }}
          autoFocus
        />
      }
      footer={
        <div className="flex justify-end">
          <SubmitButton text="Rename" onClick={() => submitRename()} />
        </div>
      }
    />
  );

  const submitRename = () => {
    const rawId = header.id.split('/').pop() || header.id;
    const oldName = sanitizeId(rawId);
    const newName = renameValue.trim();
    if (newName && newName !== oldName) {
      onRenameColumn?.(oldName, newName);
    }
    setRenameOpen(false);
  };

  return (
    <TableHead
      rowSpan={calculatedRowSpan}
      colSpan={header.colSpan}
      ref={setNodeRef}
      style={style}
      className={`relative px-0 py-0 ${selectionClass} ${pinnedClass} ${defaultBgClass} ${hoverClass} `}
      data-column-id={header.column.id}
    >
      {/* Grab area */}
      {isNotUtilColumn && (
        <div className="absolute h-2 w-full cursor-grabbing" {...attributes} {...listeners} />
      )}

      {/* Header content */}
      <div className={`h-full px-1 py-1`} onDoubleClick={handleHeaderDoubleClick}>
        {/* Single outer div to handle hovered logic. Distinguish parent vs child inside. */}
        <div
          onMouseDown={(e) => cellSelection.handleCellMouseDown(e, header)}
          onMouseUp={(e) => cellSelection.handleCellMouseUp(e, header)}
          onMouseOver={(e) => cellSelection.handleCellMouseOver(e, header)}
          className={`flex h-full select-none flex-wrap items-center justify-between px-1 text-center`}
        >
          {header.isPlaceholder ? null : (
            <>
              {isParentColumn ? (
                <div
                  className="sticky flex h-full items-center overflow-hidden px-1"
                  style={{ left: `${pinnedAreaWidth}px` }}
                >
                  {/* PARENT COLUMN LAYOUT (sticky) */}
                  <span
                    className="flex-1 cursor-pointer overflow-hidden truncate"
                    style={{ maxWidth: maxLabelWidth }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </span>
                  {interactive && (
                    <div
                      className="flex items-center gap-0.5 pl-2"
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                    >
                      <BaseDropdown
                        context="tile"
                        open={dropdownOpen}
                        setOpen={setDropdownOpen}
                        align="end"
                        className="min-w-[8rem]"
                        button={
                          <ActionButton
                            tooltip="Parent column actions"
                            icon={<MoreVertical className="h-4 w-4" />}
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDropdownOpen(true);
                            }}
                            className="mr-1 h-4 w-4 pt-2"
                          />
                        }
                      >
                        <DropdownMenuGroup>
                          {!isGrouped && ColumnGroupBy && (
                            <DropdownMenuItem>
                              {ColumnGroupBy(
                                header.column,
                                groupLoading,
                                setGroupLoading,
                                setGroupSortLoading,
                                setIsGrouped,
                                'menuItem'
                              )}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem>
                            <ColumnContext
                              interactive={interactive}
                              column={header.column}
                              context={context}
                              setContext={setContext}
                              data={data}
                              renderMode="menuItem"
                            />
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <ColumnHide
                              column={header.column}
                              columnVisibility={columnVisibility}
                              setColumnVisibility={setColumnVisibility}
                              renderMode="menuItem"
                            />
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </BaseDropdown>
                    </div>
                  )}
                  {/* Pin handle for parent column */}
                  <div className="ml-2 flex-none">
                    <ColumnPinner
                      column={header.column}
                      table={table}
                      columnOrder={columnOrder}
                      draggingColumnPinner={draggingColumnPinner}
                      setDraggingColumnPinner={setDraggingColumnPinner}
                    />
                  </div>
                </div>
              ) : (
                isNotUtilColumn && (
                  <>
                    {/* CHILD COLUMN LAYOUT */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="min-w-0 flex-1 cursor-pointer overflow-hidden truncate whitespace-nowrap">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="whitespace-pre-wrap">
                          <div className="flex flex-col gap-1">
                            <span>{`${header.id.split('/').at(-1)}: ${header.column.columnDef.meta?.dataType || 'unknown'}`}</span>
                            {header.column.columnDef.meta?.description && (
                              <span className="text-caption">
                                {header.column.columnDef.meta.description}
                              </span>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* triple-dot for child columns */}
                    {interactive == true && (
                      <div
                        className="dropdown-menu flex-none"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <BaseDropdown
                          context="tile"
                          open={dropdownOpen}
                          setOpen={setDropdownOpen}
                          align="end"
                          className="min-w-[8rem]"
                          onPointerDown={(e) => e.stopPropagation()}
                          onPointerUp={(e) => e.stopPropagation()}
                          onPointerOver={(e) => e.stopPropagation()}
                          button={
                            <ActionButton
                              ref={actionButtonRef}
                              tooltip="Child column actions"
                              icon={<MoreVertical className="h-4 w-4" />}
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDropdownOpen(true);
                              }}
                              className="mr-1 h-4 w-4 pt-2"
                            />
                          }
                        >
                          <DropdownMenuGroup>
                            {!isImageColumn && !isGrouped && ColumnGroupBy && (
                              <DropdownMenuItem>
                                {ColumnGroupBy(
                                  header.column,
                                  groupLoading,
                                  setGroupLoading,
                                  setGroupSortLoading,
                                  setIsGrouped,
                                  'menuItem'
                                )}
                              </DropdownMenuItem>
                            )}
                            {sortingDirection != 'asc' && (
                              <DropdownMenuItem>
                                <ColumnSort
                                  interactive={interactive}
                                  column={header.column}
                                  data={data}
                                  sortLoading={sortLoading}
                                  setSortLoading={setSortLoading}
                                  setSortingDirection={setSortingDirection}
                                  direction="asc"
                                  renderMode="menuItem"
                                />
                              </DropdownMenuItem>
                            )}
                            {sortingDirection != 'desc' && (
                              <DropdownMenuItem>
                                <ColumnSort
                                  interactive={interactive}
                                  column={header.column}
                                  data={data}
                                  sortLoading={sortLoading}
                                  setSortLoading={setSortLoading}
                                  setSortingDirection={setSortingDirection}
                                  direction="desc"
                                  renderMode="menuItem"
                                />
                              </DropdownMenuItem>
                            )}
                            {groupSortingDirection != 'asc' &&
                            !isGrouped &&
                            grouping.length &&
                            isGroupSortableColumn &&
                            ColumnGroupSort ? (
                              <DropdownMenuItem>
                                {ColumnGroupSort(
                                  header.column,
                                  groupSortLoading,
                                  setGroupSortLoading,
                                  setGroupSortingDirection,
                                  'menuItem',
                                  'asc'
                                )}
                              </DropdownMenuItem>
                            ) : null}
                            {groupSortingDirection != 'desc' &&
                            !isGrouped &&
                            grouping.length &&
                            isGroupSortableColumn &&
                            ColumnGroupSort ? (
                              <DropdownMenuItem>
                                {ColumnGroupSort(
                                  header.column,
                                  groupSortLoading,
                                  setGroupSortLoading,
                                  setGroupSortingDirection,
                                  'menuItem',
                                  'desc'
                                )}
                              </DropdownMenuItem>
                            ) : null}
                            {ColumnFilters &&
                              ColumnFilters(
                                header.column,
                                filterLoading,
                                setIsFiltered,
                                setFilterLoading,
                                filterOpen,
                                setFilterOpen,
                                'menuItem'
                              )}
                            <DropdownMenuItem>
                              <ColumnHide
                                column={header.column}
                                columnVisibility={columnVisibility}
                                setColumnVisibility={setColumnVisibility}
                                renderMode="menuItem"
                              />
                            </DropdownMenuItem>
                            {isDerivedColumn &&
                              ColumnUpdate &&
                              ColumnUpdate(
                                header.column.id,
                                updateLoading,
                                setUpdateLoading,
                                updateOpen,
                                setUpdateOpen,
                                'menuItem'
                              )}
                            {ColumnRename && (
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <ColumnRename
                                  column={header.column}
                                  onRename={onRenameColumn!}
                                  renderMode="menuItem"
                                />
                              </DropdownMenuItem>
                            )}
                            {ColumnDelete && !isGrouped && ColumnDelete(header.column)}
                          </DropdownMenuGroup>
                        </BaseDropdown>
                      </div>
                    )}
                  </>
                )
              )}
            </>
          )}
        </div>

        {/* 
          Always render the row of action icons,
          but hide it with a class if there are no active actions
        */}
        {!header.isPlaceholder && isNotUtilColumn && (
          <div
            ref={activeActionsRef}
            className={`justify-left flex items-center gap-1${hasActiveActions ? '' : 'hidden'}`}
          >
            {renderVisibleActions()}
          </div>
        )}

        {/* Hidden action components for group, sort, filter, context, hide (need to be rendered on the DOM even if hidden in order to be able to forward refs) */}
        {!hasActiveActions && (
          <div
            className={`flex ${
              Object.values(
                columnActionsApplied[header.column.columnDef.meta?.renderedDepth ?? 0] || {}
              ).some(Boolean)
                ? 'invisible'
                : 'hidden'
            }`}
          >
            {!isImageColumn &&
              ColumnGroupBy &&
              ColumnGroupBy(
                header.column,
                groupLoading,
                setGroupLoading,
                setGroupSortLoading,
                setIsGrouped,
                'button'
              )}
            {!isParentColumn && (
              <ColumnSort
                interactive={interactive}
                column={header.column}
                data={data}
                sortLoading={sortLoading}
                setSortLoading={setSortLoading}
                setSortingDirection={setSortingDirection}
                renderMode="button"
              />
            )}
            {!isParentColumn &&
              ColumnFilters &&
              ColumnFilters(
                header.column,
                filterLoading,
                setIsFiltered,
                setFilterLoading,
                filterOpen,
                setFilterOpen,
                'button'
              )}
            {isParentColumn && (
              <ColumnContext
                interactive={interactive}
                column={header.column}
                context={context}
                setContext={setContext}
                data={data}
                renderMode="button"
              />
            )}
            <ColumnHide
              column={header.column}
              columnVisibility={columnVisibility}
              setColumnVisibility={setColumnVisibility}
              renderMode="button"
            />
          </div>
        )}

        {/* Right edge: Column show icon only */}
        {!header.isPlaceholder && (
          <div
            className="absolute inset-y-0 right-0 flex items-center justify-center"
            style={{ width: '15px' }}
          >
            <ColumnShow
              table={table}
              header={header}
              columnVisibility={columnVisibility}
              setColumnVisibility={setColumnVisibility}
              columnOrder={columnOrder}
              setColumnOrder={setColumnOrder}
              ColumnCreate={ColumnCreate}
            />
          </div>
        )}
      </div>
      {children}

      {/* Rename dialog */}
      {renameDialog}

      {/* Column resizer – aligned exactly at the border */}
      {(() => {
        const canResize = header.column.getCanResize();
        if (!canResize) return null;

        return (
          <ColumnResizer column={header.column as any} resizeHandler={header.getResizeHandler()} />
        );
      })()}
    </TableHead>
  );
};

export default DataTableHeader;
