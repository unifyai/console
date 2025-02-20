"use client";

import { useState, CSSProperties, ReactNode } from "react";

import { flexRender, Header, Column, Table, Cell } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, Transform } from "@dnd-kit/utilities";

import { TableHead } from "@/components/UI/table";
import { getNextLeafColumn, getPreviousLeafColumn } from "@/utils/evals/columnOperations";
import { DraggingColumnsState, PinningColumnState } from "@/types/evals/columns";
import ColumnSort from "../Buttons/ColumnSort";
import ColumnGroupBy from "../Buttons/ColumnGroupBy";
import ColumnHide from "../Buttons/ColumnHide";
import ColumnShow from "../Buttons/ColumnShow";
import ColumnContext from "../Buttons/ColumnContext";
import ColumnResizer from "../Buttons/ColumnResize";
import ColumnPinner from "../Buttons/ColumnPinner";
import { getCellsFromHeader, getSelectableTableCells } from "@/hooks/Logs/useCellSelection";
import { getColumnGroupIDs } from "@/utils/evals/table";
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
  children
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
  ColumnFilters?: (column: Column<any | unknown>) => ReactNode,
  ColumnCreate?: (previousColumn: string, setOpen: (open: boolean) => void) => ReactNode,
  ColumnUpdate?: (key: string) => ReactNode,
  context: string | null,
  setContext: (context: string | null) => void,
  draggingColumns: DraggingColumnsState,
  columnOrder: string[],
  setColumnOrder: (columnOrder: string[]) => void,
  columnPinning: { left?: string[]; right?: string[] },
  pinningState: PinningColumnState,
  setPinningState: (state: PinningColumnState) => void,
  children?: ReactNode
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
          className="cursor-grabbing h-3 w-full absolute" 
          {...attributes} 
          {...listeners}
        />
      }

      {/* Header content */}
      <div className={`px-2 py-2 ${!isNotUtilColumn ? "h-10" : ""}`}>

        {/* Header name with column selection */}
        <div
          className={`flex items-center justify-center h-full text-center px-2 py-1 select-none ${!isNotUtilColumn ? "h-10" : ""}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onMouseDown={(e) => cellSelection.handleCellMouseDown(e, header)}
          onMouseUp={(e) => cellSelection.handleCellMouseUp(e, header)}
          onMouseOver={(e) => cellSelection.handleCellMouseOver(e, header)}
        >
          {header.isPlaceholder ? null : (
            <>
              {!isParentColumn ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-center flex-shrink-0 mr-4">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>type: {header.column.columnDef.meta?.dataType || 'unknown'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="text-center flex-shrink-0 mr-4">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </span>
              )}

              {/* Inline Column Actions for Parent Columns */}
              {isParentColumn && (
                <div
                  className="flex items-center gap-0.75"
                  onMouseDown={(e) => e.stopPropagation()} // Prevent event bubbling for action buttons
                  onMouseUp={(e) => e.stopPropagation()}   // Prevent event bubbling for action buttons
                >
                  <ColumnGroupBy interactive={interactive} auto_update={auto_update} column={header.column} grouping={grouping} setGrouping={setGrouping} data={data}/>
                  <ColumnContext interactive={interactive} column={header.column} context={context} setContext={setContext} data={data}/>
                </div>
              )}
            </>
          )}
        </div>

        {/* Absolutely positioned ColumnHide */}
        {!header.isPlaceholder && isNotUtilColumn && (
          <div
            className="absolute top-0 right-0 z-10"
            onMouseDown={(e) => e.stopPropagation()} // Prevent drag interference
            onMouseUp={(e) => e.stopPropagation()} // Prevent drag interference
          >
            <ColumnHide column={header.column} columnVisibility={columnVisibility} setColumnVisibility={setColumnVisibility}/>
          </div>
        )}

        {/* Column actions */}
        {!header.isPlaceholder && isNotUtilColumn &&
          <div className="flex items-center justify-center gap-1 mt-2">
            {!isParentColumn && !isImageColumn && <ColumnGroupBy interactive={interactive} auto_update={auto_update} column={header.column} grouping={grouping} setGrouping={setGrouping} data={data}/>}
            {!isParentColumn && <ColumnSort interactive={interactive} column={header.column} data={data}/>}
            {!isParentColumn && ColumnFilters && ColumnFilters(header.column)}
            {!isParentColumn && isDerivedColumn && ColumnUpdate && ColumnUpdate(header.column.id)}
          </div>
        }

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
