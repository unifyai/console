"use client";

import { useState, CSSProperties, ReactNode, useRef, SetStateAction, Dispatch, useEffect } from "react";

import { flexRender, Header, Column, Table, Cell } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, Transform } from "@dnd-kit/utilities";

import { TableHead } from "@/components/UI/table";
import { getNextLeafColumn, getPreviousLeafColumn } from "@/utils/evals/columnOperations";
import { DraggingColumnsState, PinningColumnState } from "@/types/evals/columns";
import { getCellsFromHeader, getSelectableTableCells } from "@/hooks/Logs/useCellSelection";
import { getColumnGroupIDs } from "@/utils/evals/table";

// Column action components
import ColumnSort from "../Buttons/ColumnSort";
import ColumnGroupBy from "../Buttons/ColumnGroupBy";
import ColumnHide from "../Buttons/ColumnHide";
import ColumnShow from "../Buttons/ColumnShow";
import ColumnContext from "../Buttons/ColumnContext";
import ColumnResizer from "../Buttons/ColumnResize";
import ColumnPinner from "../Buttons/ColumnPinner";

// Shadcn UI dropdown
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/UI/dropdown-menu";

// Icon / button
import ActionButton from "@/components/Common/Buttons/Action";
import { MoreHorizontal, Group, ArrowUpDown, Filter, FolderTree, EyeOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";

const DataTableHeader = ({
  interactive,
  auto_update,
  data,
  table,
  header,
  isCellSelected,
  cellSelection,
  resizeMap,
  columnVisibility,
  setColumnVisibility,
  grouping,
  setGrouping,
  ColumnFilters,
  ColumnCreate,
  ColumnUpdate,
  context,
  setContext,
  draggingColumns,
  columnOrder,
  setColumnOrder,
  columnPinning,
  pinningState,
  setPinningState,
  children,
  columnActionsApplied,
  setColumnActionsApplied
}: {
  interactive?: boolean,
  auto_update?: boolean,
  data: any[],
  table: Table<any>,
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
  ColumnFilters?: (column: Column<any | unknown>, filterLoading: boolean, setIsFiltered: (isFiltered: boolean) => void, setFilterLoading: (filterLoading: boolean) => void, open: boolean, setOpen: Dispatch<SetStateAction<boolean>>, renderMode: "button" | "menuItem") => ReactNode,
  ColumnCreate?: (previousColumn: string, setOpen: (open: boolean) => void) => ReactNode,
  ColumnUpdate?: (key: string, updateLoading: boolean, setUpdateLoading: (updateLoading: boolean) => void, open: boolean, setOpen: Dispatch<SetStateAction<boolean>>, renderMode: "button" | "menuItem" ) => ReactNode,
  context: string | null,
  setContext: (context: string | null) => void,
  draggingColumns: DraggingColumnsState,
  columnOrder: string[],
  setColumnOrder: (columnOrder: string[]) => void,
  columnPinning: { left?: string[]; right?: string[] },
  pinningState: PinningColumnState,
  setPinningState: (state: PinningColumnState) => void,
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

  // Handle pinning animation
  const isPinning = pinningState.isPinning && (
    header.column.id === pinningState.columnId || // Current column being pinned
    (pinningState.direction === 'right' && header.column.id === getNextLeafColumn(header.column, columnOrder, table)?.id) || // Next column when pinning right
    (pinningState.direction === 'left' && header.column.id === getPreviousLeafColumn(header.column, columnOrder, table)?.id) // Previous column when pinning left
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
      [pinningState.direction === 'right' ? 'right' : 'left']: 0,
      width: '2px',
      background: 'var(--primary)',
      opacity: 0.7,
    }
  } : {};

  // Track loading states for column actions
  const [sortLoading, setSortLoading] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  // Determine which actions should be shown in dropdown vs as buttons
  const [isGrouped, setIsGrouped] = useState(false);
  const [isSorted, setIsSorted] = useState(false);
  const [isFiltered, setIsFiltered] = useState(false);

  // Open states for dialogs
  const [filterOpen, setFilterOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const showGroupButton = () => {
    return (!isImageColumn && (groupLoading || isGrouped));
  }

  const showSortButton = () => {
    return (!isParentColumn && (sortLoading || isSorted));
  }

  const showFilterButton = () => {
    return (!isParentColumn && (filterLoading || isFiltered));
  }

  const showUpdateButton = () => {
    return (!isParentColumn && isDerivedColumn && updateLoading);
  }

  const hasActiveActions = showGroupButton() || showSortButton() || showFilterButton() || showUpdateButton();

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
  }, [hasActiveActions, groupLoading, isGrouped, sortLoading, isSorted, filterLoading, isFiltered, updateLoading, data]);  

  // Handle header coloring.
  // - Applies selection (hover) background color on any column header for which all (some) cells are selected
  // - Applied selection (hover) background color index column header if all (some) table cells are selected
  const [hovered, setHovered] = useState(false);
  const isAllColumnSelected = (header: Header<any, unknown>) =>
    table.getRowModel().rows.length && getCellsFromHeader(header).every(cell => isCellSelected(cell))
  const isAllTableSelected = () => 
    table.getRowModel().rows.length && getSelectableTableCells(table).every(cell => isCellSelected(cell))

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
    minWidth: isDerivedColumn ? '150px' : undefined,
    zIndex: isColumnDragging || isPinned ? 1 : 0,
    borderRight: "1px solid var(--muted)",
    borderBottom: "1px solid var(--muted)",
    borderTop: "1px solid var(--muted)",
    color: isAllColumnSelected(header) ? "var(--primary-foreground)" : "",
    backgroundColor: isNotUtilColumn
      ? isAllColumnSelected(header) ? `var(--primary)` : hovered ? "var(--muted)" : isPinned ? "var(--background)" : ""
      : isAllTableSelected() ? `var(--primary)` : hovered ? "var(--muted)" : "var(--background)",
  };

  // Visible action buttons for active states
  const renderVisibleActions = () => (
    <>
      {showGroupButton() && (
        <ColumnGroupBy
          interactive={interactive}
          auto_update={auto_update}
          column={header.column}
          grouping={grouping}
          setGrouping={setGrouping}
          data={data}
          groupLoading={groupLoading}
          setGroupLoading={setGroupLoading}
          setIsGrouped={setIsGrouped}
          renderMode="button"
        />
      )}
      {showSortButton() && (
        <ColumnSort
          interactive={interactive}
          column={header.column}
          data={data}
          sortLoading={sortLoading}
          setSortLoading={setSortLoading}
          setIsSorted={setIsSorted}
          renderMode="button"             
        />
      )}
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

  return (
    <TableHead 
      colSpan={header.colSpan} 
      ref={setNodeRef} 
      style={style} 
      className={`relative px-0 py-0`}
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
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
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
                  <span className="text-center flex-shrink-0 mr-4">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </span>
                  {/* parent inlined dropdown */}
                  {interactive == true && (
                    <div
                      className="flex items-center gap-0.5"
                      onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                      <DropdownMenuTrigger asChild>
                        <ActionButton
                          tooltip="Parent Column Actions"
                          icon={<MoreHorizontal className="h-4 w-4" />}
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDropdownOpen(true);
                          }}
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[8rem]">
                        <DropdownMenuGroup>
                          {!isGrouped && (
                            <DropdownMenuItem>
                              <ColumnGroupBy
                                interactive={interactive}
                                auto_update={auto_update}
                                column={header.column}
                                grouping={grouping}
                                setGrouping={setGrouping}
                                data={data}
                                groupLoading={groupLoading}
                                setGroupLoading={setGroupLoading}
                                setIsGrouped={setIsGrouped}
                                renderMode="menuItem"
                              />
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
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                          <div className="flex items-center justify-between w-full">
                            <span className="text-center flex-1">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>type: {header.column.columnDef.meta?.dataType || "unknown"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* triple-dot for child columns */}
                    {interactive == true && (
                      <div className="ml-4 flex-none dropdown-menu" onMouseDown={(e) => e.stopPropagation()}>
                        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                          <DropdownMenuTrigger asChild>
                            <ActionButton
                              tooltip="Child Column Actions"
                              icon={<MoreHorizontal className="h-4 w-4" />}
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDropdownOpen(true);
                              }}
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="min-w-[8rem]"
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onPointerOver={(e) => e.stopPropagation()}
                          >
                            <DropdownMenuGroup>
                            {!isImageColumn && !isGrouped && (
                              <DropdownMenuItem>
                                  <ColumnGroupBy
                                    interactive={interactive}
                                    auto_update={auto_update}
                                    column={header.column}
                                    grouping={grouping}
                                    setGrouping={setGrouping}
                                    data={data}
                                    groupLoading={groupLoading}
                                    setGroupLoading={setGroupLoading}
                                    setIsGrouped={setIsGrouped}
                                    renderMode="menuItem"
                                  />
                                </DropdownMenuItem>
                              )}
                              {!isSorted && (
                                <DropdownMenuItem>
                                  <ColumnSort
                                    interactive={interactive}
                                    column={header.column}
                                    data={data}
                                    sortLoading={sortLoading}
                                    setSortLoading={setSortLoading}
                                    setIsSorted={setIsSorted}
                                    renderMode="menuItem"
                                  />
                                </DropdownMenuItem>
                              )}
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
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </>
                )
              )}
            </>
          )}
        </div>

        {/* If user has used group/sort/filter => row of icons */}
        {!header.isPlaceholder && isNotUtilColumn && hasActiveActions && (
          <div className="flex items-center justify-left gap-1">
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
            {!isImageColumn && (
              <ColumnGroupBy
                interactive={interactive}
                auto_update={auto_update}
                column={header.column}
                grouping={grouping}
                setGrouping={setGrouping}
                data={data}
                groupLoading={groupLoading}
                setGroupLoading={setGroupLoading}
                setIsGrouped={setIsGrouped}
                renderMode="button"
              />
            )}
            {!isParentColumn && (
              <ColumnSort
                interactive={interactive}
                column={header.column}
                data={data}
                sortLoading={sortLoading}
                setSortLoading={setSortLoading}
                setIsSorted={setIsSorted}
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
                        pinningState={pinningState}
                        setPinningState={setPinningState}
                    />
                </div>
            )}

            {/* Column show - middle third */}
            {!header.isPlaceholder && (
                <div className="absolute top-1/3 right-0" style={{ height: '33.33%' }}>
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

            {/* Column resizer - bottom third */}
            <div className="absolute bottom-0 right-0" style={{ height: '33.33%' }}>
                <ColumnResizer column={header.column} resizeHandler={resizeMap[header.column.id]}/>
            </div>
        </div>
      </div>
      {children}
    </TableHead>
  );
};

export default DataTableHeader;
