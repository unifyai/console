"use client";

import { useState, CSSProperties, ReactNode, useRef, SetStateAction, Dispatch, useEffect } from "react";

import { flexRender, Header, Column, Table, Cell } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, Transform } from "@dnd-kit/utilities";

import { TableHead } from "@/components/UI/table";
import { getNextLeafColumn, getPreviousLeafColumn } from "@/utils/evals/columnOperations";
import { DraggingColumnPinnerState, DraggingColumnsState } from "@/types/evals/columns";
import { getCellsFromHeader, getSelectableTableCells } from "@/hooks/Logs/useCellSelection";
import { getColumnGroupIDs } from "@/utils/evals/table";

// Column action components
import ColumnSort from "../Buttons/ColumnSort";
import ColumnHide from "../Buttons/ColumnHide";
import ColumnShow from "../Buttons/ColumnShow";
import ColumnContext from "../Buttons/ColumnContext";
import ColumnPinner from "../Buttons/ColumnPinner";

// Shadcn UI dropdown
import {
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/UI/dropdown-menu";
import BaseDropdown from "@/components/Common/Dropdowns/Base";

// Icon / button
import ActionButton from "@/components/Common/Buttons/Action";
import { MoreHorizontal, Group, ArrowUpDown, Filter, FolderTree, EyeOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";

import { shouldRenderHeader, calculateRowSpan } from "@/utils/evals/table";

const DataTableHeader = ({
  interactive,
  auto_update,
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
  children,
  columnActionsApplied,
  setColumnActionsApplied
}: {
  interactive?: boolean,
  auto_update?: boolean,
  data: any[],
  table: Table<any>,
  headerGroupIndex: number,
  header: Header<any, unknown>,
  isCellSelected: (cell: Cell<any, any>) => boolean,
  cellSelection: {
    handleCellMouseDown: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
    handleCellMouseUp: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
    handleCellMouseOver: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
    handleCellsKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  },
  resizeMap: { [x: string]: (event: unknown) => void },
  columnVisibility: { [key: string]: boolean },
  setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void,
  grouping: string[],
  setGrouping: (grouping: string[]) => void,
  ColumnGroupBy?: (column: Column<any | unknown>, groupLoading: boolean, setGroupLoading: (groupLoading: boolean) => void, setIsGrouped: (isGrouped: boolean) => void, setGroupSortLoading: (groupSortLoading: boolean) => void, renderMode: "button" | "menuItem") => ReactNode,
  ColumnGroupSort?: (column: Column<any | unknown>, groupSortLoading: boolean, setGroupSortLoading: (groupSortLoading: boolean) => void, setSortingDirection: (sortingDirection: "asc" | "desc" | false) => void, renderMode: "button" | "menuItem", direction?: "asc" | "desc") => ReactNode,
  ColumnFilters?: (column: Column<any | unknown>, filterLoading: boolean, setIsFiltered: (isFiltered: boolean) => void, setFilterLoading: (filterLoading: boolean) => void, open: boolean, setOpen: Dispatch<SetStateAction<boolean>>, renderMode: "button" | "menuItem") => ReactNode,
  ColumnDelete?: (column: Column<any | unknown>) => ReactNode,
  ColumnCreate?: (previousColumn: string, setOpen: (open: boolean) => void) => ReactNode,
  ColumnUpdate?: (key: string, updateLoading: boolean, setUpdateLoading: (updateLoading: boolean) => void, open: boolean, setOpen: Dispatch<SetStateAction<boolean>>, renderMode: "button" | "menuItem" ) => ReactNode,
  context: string | null,
  setContext: (context: string | null) => void,
  draggingColumns: DraggingColumnsState,
  columnOrder: string[],
  setColumnOrder: (columnOrder: string[]) => void,
  columnPinning: { left?: string[]; right?: string[] },
  draggingColumnPinner: DraggingColumnPinnerState,
  setDraggingColumnPinner: (state: DraggingColumnPinnerState) => void,
  children?: ReactNode,
  columnActionsApplied: { [depth: number]: { [columnId: string]: boolean } },
  setColumnActionsApplied: Dispatch<SetStateAction<{ [depth: number]: { [columnId: string]: boolean } }>>
}) => {

  const { attributes, listeners, setNodeRef, isDragging, transform } = useSortable({
    id: header.column.id,
    data: {
      group: getColumnGroupIDs(header.column)
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
  const isLastLeftPinnedColumn = isPinned === "left" && header.column.getIsLastColumn('left');
  const isParentColumn = header.column.columnDef.meta?.isParent;
  const isNotUtilColumn = header.column.columnDef.meta?.columnType != "util";
  const isDerivedColumn = header.column.columnDef.meta?.fieldType === "derived_entry";
  const isImageColumn = header.column.columnDef.meta?.dataType === "image";
  const isGroupSortableColumn = 
    header.column.columnDef.meta?.dataType === "float" || 
    header.column.columnDef.meta?.dataType === "int" || 
    header.column.columnDef.meta?.dataType === "bool" || 
    header.column.columnDef.meta?.dataType === "timestamp" || 
    header.column.columnDef.meta?.dataType === "time" ||
    header.column.columnDef.meta?.dataType === "date" ||
    header.column.columnDef.meta?.dataType === "timedelta"

  // Handle pinning animation
  const isPinning = draggingColumnPinner.isPinning && (
    header.column.id === draggingColumnPinner.columnId || // Current column being pinned
    (draggingColumnPinner.direction === 'right' && header.column.id === getNextLeafColumn(header.column, columnOrder, table)?.id) || // Next column when pinning right
    (draggingColumnPinner.direction === 'left' && header.column.id === getPreviousLeafColumn(header.column, columnOrder, table)?.id) // Previous column when pinning left
  );

  // Determine the applied transform for both dragging and pinning
  const appliedTransform: Transform | null = isDragging
    ? transform 
    : isInActiveGroup 
      ? draggingColumns.active.transform ?? null 
      : isInOverGroup
        ? draggingColumns.over.transform ?? null 
        : isParentColumn 
          ? null 
          : transform;

  const appliedTransition = isDragging 
    ? "width transform 0.2s ease-in-out"
    : undefined;

  // Add pinning border highlight
  const pinningBorderStyle = isPinning ? {
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      bottom: 0,
      [draggingColumnPinner.direction === 'right' ? 'right' : 'left']: 0,
      width: '2px',
      background: 'var(--primary)',
      opacity: 0.7,
    }
  } : {};

  // Track loading states for column actions
  const [groupLoading, setGroupLoading] = useState(false);
  const [sortLoading, setSortLoading] = useState(false);
  const [groupSortLoading, setGroupSortLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  // Determine which actions should be shown in dropdown vs as buttons
  const [isGrouped, setIsGrouped] = useState(false);
  const [sortingDirection, setSortingDirection] = useState<"asc" | "desc" | false>(false);
  const [groupSortingDirection, setGroupSortingDirection] = useState<"asc" | "desc" | false>(false);
  const [isFiltered, setIsFiltered] = useState(false);

  // Open states for dialogs
  const [filterOpen, setFilterOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Event listeners to update open / loading states
  useEffect(() => {
    if (groupSortLoading || groupLoading || sortLoading || filterLoading || updateLoading) {
      setDropdownOpen(false);
    }
    else {
      setDropdownOpen(false);
    }
  }, [data, groupSortLoading, groupLoading, sortLoading, filterLoading, updateLoading])
  useEffect(() => setFilterLoading(false),[data])
  useEffect(() => setSortLoading(false),[data])
  useEffect(() => setGroupSortLoading(false),[data])

  // Functions to control which buttons should be shown
  const showGroupButton = () => {
    return (!isImageColumn && (groupLoading || isGrouped));
  }

  const showSortButton = () => {
    return (!isParentColumn && (sortLoading || sortingDirection != false));
  }

  const showGroupSortButton = () => {
    return (!isParentColumn && grouping.length && (groupSortLoading || groupSortingDirection != false))
  }

  const showFilterButton = () => {
    return (!isParentColumn && (filterLoading || isFiltered));
  }

  const showUpdateButton = () => {
    return (!isParentColumn && isDerivedColumn && updateLoading);
  }

  const hasActiveActions = showGroupSortButton() || showGroupButton() || showSortButton() || showFilterButton() || showUpdateButton();

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
  }, [hasActiveActions, groupSortingDirection, groupSortLoading, groupLoading, isGrouped, sortLoading, sortingDirection, filterLoading, isFiltered, updateLoading, data]);  

  // Visible action buttons for active states
  const activeActionsRef = useRef<HTMLDivElement | null>(null);
  const actionButtonRef = useRef<HTMLButtonElement | null>(null);
  const renderVisibleActions = () => (
    <>
      {ColumnGroupBy && 
        <div
            className={`${showGroupButton() ? "" : "hidden"}`}
        >
          {ColumnGroupBy(
            header.column,
            groupLoading,
            setGroupLoading,
            setGroupSortLoading,
            setIsGrouped,
            "button"
          )}
        </div>
      }
      <div
          className={`${showSortButton() ? "" : "hidden"}`}
      >
        {(
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
      </div>
      <div
          className={`${showGroupSortButton() ? "" : "hidden"}`}
      >
        {ColumnGroupSort && ColumnGroupSort(
          header.column,
          groupSortLoading,
          setGroupSortLoading,
          setGroupSortingDirection,
          "button"
        )}
      </div>
      {showFilterButton() && (
        ColumnFilters && ColumnFilters(
          header.column,
          filterLoading,
          setIsFiltered,
          setFilterLoading,
          filterOpen,
          setFilterOpen,
          "button"
        )
      )}
      {showUpdateButton() && (
        ColumnUpdate && ColumnUpdate(
          header.column.id,
          updateLoading,
          setUpdateLoading,
          updateOpen,
          setUpdateOpen,
          "button"
        )
      )}
    </>
  );

  // Calculate row span for vertical merging and skip children
  // headers whose parent are spanned vertically
  const calculatedRowSpan = calculateRowSpan(header, table, headerGroupIndex)
  if (!shouldRenderHeader(header, table, headerGroupIndex)) {
      return null;
  }

  // Handle header coloring.
  // - Applies selection (hover) background color on any column header for which all (some) cells are selected
  // - Applied selection (hover) background color index column header if all (some) table cells are selected
  const isAllColumnSelected = (header: Header<any, unknown>) => {
    const validCells = getCellsFromHeader(header).filter(cell => cell.getValue() !== undefined || cell.column.id === "RowNumbering")
    return validCells.length && validCells.every(cell => isCellSelected(cell))
  }
  const isAllTableSelected = () => 
    table.getRowModel().rows.length && 
    getSelectableTableCells(table).every(cell => isCellSelected(cell)) && 
    Object.entries(columnVisibility).filter(([, v]) => v).length != 1

  const style: CSSProperties = {
    boxShadow: isLastLeftPinnedColumn ? '-4px 0 4px -4px gray inset'  : undefined,
    opacity: isColumnDragging ? 0.8 : 1,
    position: isPinned ? "sticky" : "relative",
    left: isPinned === "left" ? `${header.column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${header.column.getAfter("right")}px` : undefined,
    transform: CSS.Translate.toString(appliedTransform), // translate instead of transform to avoid squishing
    transition: appliedTransition,
    whiteSpace: "nowrap",
    width: `${Math.round(header.getSize())}px`,
    minWidth: hasActiveActions ? activeActionsRef.current?.clientWidth : 0,
    zIndex: isPinned ? 2 : isColumnDragging ? 1 : 0,
    borderLeft: header.column.id === "RowNumbering" ? "1px solid var(--muted)" : undefined,
    borderRight: "1px solid var(--muted)",
    borderTop: "1px solid var(--muted)",
    borderBottom: (header.depth + calculatedRowSpan) >= table.getHeaderGroups().length ? "1px solid var(--muted)" : undefined,
    verticalAlign: calculatedRowSpan > 1 ? 'middle' : undefined,
    color: isAllColumnSelected(header) ? "var(--primary-foreground)" : "",
  };

  /** Determine background color using tailwind classes, applying style in the following order of priority
   * Selection
   * Pinning (only if not selected)
   * Default & Hover (only if not selected and not pinned)
  */
  const isIndexColumn = header.column.id === "RowNumbering"
  const isPlaceholderColumn = header.isPlaceholder
  const isSelected = isNotUtilColumn && !isPlaceholderColumn ? isAllColumnSelected(header) : isAllTableSelected();
  const selectionClass = isSelected ? 'bg-primary' : '';
  const pinnedClass = isPinned && !isSelected ? 'bg-background' : '';
  const defaultBgClass = !isSelected && !isPinned ? 'bg-transparent' : '';
  const hoverClass = !isSelected && !isPinned && !dropdownOpen && (!isPlaceholderColumn || isIndexColumn) ? 'hover:bg-muted' : '';

  const maxLabelWidth = Math.max(Number((style.width as string).split("px")[0]) - (actionButtonRef.current?.clientWidth ?? 0), 10)

  return (
    <TableHead 
      rowSpan={calculatedRowSpan}
      colSpan={header.colSpan} 
      ref={setNodeRef} 
      style={style} 
      className={`
        relative px-0 py-0
        ${selectionClass}
        ${pinnedClass}
        ${defaultBgClass}
        ${hoverClass}
      `}
      data-column-id={header.column.id}
    >

      {/* Grab area */}
      {isNotUtilColumn && 
        <div 
          className="cursor-grabbing h-2 w-full absolute" 
          {...attributes} 
          {...listeners}
        />
      }

      {/* Header content */}
      <div className={`px-2 py-1 ${!isNotUtilColumn ? "h-10" : ""}`}>

        {/* Single outer div to handle hovered logic. Distinguish parent vs child inside. */}
        <div
          onMouseDown={(e) => cellSelection.handleCellMouseDown(e, header)}
          onMouseUp={(e) => cellSelection.handleCellMouseUp(e, header)}
          onMouseOver={(e) => cellSelection.handleCellMouseOver(e, header)}
          className={`flex items-center justify-center h-full text-center px-1 select-none ${
            !isNotUtilColumn ? "h-10" : ""
          }`}
        >
          {header.isPlaceholder ? null : (
            <>
              {isParentColumn ? (
                <>
                  {/* PARENT COLUMN LAYOUT */}
                  <span
                    className="flex items-center justify-between cursor-pointer overflow-hidden mr-4"
                    style={{maxWidth: maxLabelWidth}}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </span>
                  {/* parent inlined dropdown */}
                  {interactive == true && (
                    <div
                      className="flex items-center gap-0.5"
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
                          icon={<MoreHorizontal className="h-4 w-4" />}
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDropdownOpen(true);
                          }}
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
                              "menuItem"
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
                </>
              ) : (
                isNotUtilColumn && (
                  <>
                    {/* CHILD COLUMN LAYOUT */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className="flex items-center justify-between cursor-pointer overflow-hidden"
                            style={{maxWidth: maxLabelWidth}}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{`${header.id.split("/").at(-1)}: ${header.column.columnDef.meta?.dataType || "unknown"}`}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* triple-dot for child columns */}
                    {interactive == true && (
                      <div className="ml-4 flex-none dropdown-menu" onMouseDown={(e) => e.stopPropagation()}>
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
                              icon={<MoreHorizontal className="h-4 w-4" />}
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDropdownOpen(true);
                              }}
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
                                  "menuItem"
                                )}
                                </DropdownMenuItem>
                              )}
                              {sortingDirection != "asc" && (
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
                              {sortingDirection != "desc" && (
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
                              {groupSortingDirection != "asc" && !isGrouped && grouping.length && isGroupSortableColumn && ColumnGroupSort 
                                  ? (
                                      <DropdownMenuItem>
                                        {ColumnGroupSort(
                                          header.column,
                                          groupSortLoading,
                                          setGroupSortLoading,
                                          setGroupSortingDirection,
                                          "menuItem",
                                          "asc"
                                        )}
                                      </DropdownMenuItem>
                                    )
                                  : null
                              }
                              {groupSortingDirection != "desc" && !isGrouped && grouping.length && isGroupSortableColumn && ColumnGroupSort 
                                  ? (
                                      <DropdownMenuItem>
                                        {ColumnGroupSort(
                                          header.column,
                                          groupSortLoading,
                                          setGroupSortLoading,
                                          setGroupSortingDirection,
                                          "menuItem",
                                          "desc"
                                        )}
                                      </DropdownMenuItem>
                                    )
                                  : null
                              }
                              {ColumnFilters && (
                                ColumnFilters(
                                  header.column,
                                  filterLoading,
                                  setIsFiltered,
                                  setFilterLoading,
                                  filterOpen,
                                  setFilterOpen,
                                  "menuItem",
                                )
                              )}
                              <DropdownMenuItem>
                                <ColumnHide
                                  column={header.column}
                                  columnVisibility={columnVisibility}
                                  setColumnVisibility={setColumnVisibility}
                                  renderMode="menuItem"
                                />
                              </DropdownMenuItem>
                              {isDerivedColumn && ColumnUpdate && (
                                  ColumnUpdate(
                                    header.column.id,
                                    updateLoading,
                                    setUpdateLoading,
                                    updateOpen,
                                    setUpdateOpen,
                                    "menuItem",
                                  )
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
            className={`flex items-center justify-left gap-1 ${
              hasActiveActions ? "" : "hidden"
            }`}
          >
            {renderVisibleActions()}
          </div>
        )}

        {/* Hidden action components for group, sort, filter, context, hide (need to be rendered on the DOM even if hidden in order to be able to forward refs) */}
        {(!hasActiveActions) && (
          <div className={`${
            Object.values(columnActionsApplied[header.column.columnDef.meta?.renderedDepth ?? 0] || {}).some(Boolean)
            ? "invisible"
            : "hidden"
          }`}>
            {!isImageColumn && ColumnGroupBy && (
              ColumnGroupBy(
                header.column,
                groupLoading,
                setGroupLoading,
                setGroupSortLoading,
                setIsGrouped,
                "button"
              )
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
            {!isParentColumn && ColumnFilters && (
              ColumnFilters(
                header.column,
                filterLoading,
                setIsFiltered,
                setFilterLoading,
                filterOpen,
                setFilterOpen,
                "button"
              )
            )}
            {isParentColumn && <ColumnContext
              interactive={interactive}
              column={header.column}
              context={context}
              setContext={setContext}
              data={data}
              renderMode="button"
            />}
            <ColumnHide
              column={header.column}
              columnVisibility={columnVisibility}
              setColumnVisibility={setColumnVisibility}
              renderMode="button"
            />
          </div>
        )}

        {/* Right edge components stack */}
        <div className="absolute -right-2 top-0 bottom-0" style={{ width: '15px', height: '100%' }}>
            {/* Column pinner - top third */}
            {isLastLeftPinnedColumn && (
                <div className="absolute top-0 right-0" style={{ height: '33.33%' }}>
                    <ColumnPinner 
                        column={header.column}
                        table={table}
                        columnPinning={columnPinning}
                        columnOrder={columnOrder}
                        draggingColumnPinner={draggingColumnPinner}
                        setDraggingColumnPinner={setDraggingColumnPinner}
                    />
                </div>
            )}

            {/* Column show - half */}
            {!header.isPlaceholder && (
              <div className={`absolute ${hasActiveActions ? "top-1/2" : "top-1/3"} right-0 transform -translate-y-1/2`} style={{ height: '33.33%' }}>
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
      </div>
      {children}
    </TableHead>
  );
};

export default DataTableHeader;
