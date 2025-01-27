"use client";

import { useState, CSSProperties, ReactNode } from "react";

import { flexRender, Header, Column, Table, Cell } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, Transform } from "@dnd-kit/utilities";

import { TableHead } from "@/components/UI/table";
import ColumnSort from "../Buttons/ColumnSort";
import ColumnGroupBy from "../Buttons/ColumnGroupBy";
import ColumnHide from "../Buttons/ColumnHide";
import ColumnShow from "../Buttons/ColumnShow";
import ColumnContext from "../Buttons/ColumnContext";
import { getCellsFromHeader, getSelectableTableCells } from "@/hooks/Logs/useCellSelection";
import { getColumnGroupIDs } from "@/utils/evals/table";
import { DraggingColumnsState } from "@/types/evals/columns";

const DataTableHeader = ({
  interactive,
  table,
  header,
  isCellSelected,
  cellSelection,
  columnVisibility,
  setColumnVisibility,
  grouping,
  setGrouping,
  ColumnFilters,
  ColumnCreate,
  context,
  setContext,
  draggingColumns,
  columnOrder,
  setColumnOrder,
}: {
  interactive?: boolean,
  table: Table<any | unknown>,
  header: Header<any, unknown>,
  isCellSelected: (cell: Cell<any, any>) => boolean,
  cellSelection: {
    handleCellMouseDown: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
    handleCellMouseUp: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
    handleCellMouseOver: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
    handleCellsKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  },
  columnVisibility: { [key: string]: boolean },
  setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void,
  grouping: string[],
  setGrouping: (grouping: string[]) => void,
  ColumnFilters?: (column: Column<any | unknown>) => ReactNode,
  ColumnCreate?: ReactNode,
  context: string | null,
  setContext: (context: string | null) => void,
  draggingColumns: DraggingColumnsState,
  columnOrder: string[],
  setColumnOrder: (columnOrder: string[]) => void,
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
  const isLastLeftPinnedColumn =  isPinned === "left" && header.column.getIsLastColumn('left')
  const isParentColumn = header.column.columnDef.meta?.isParent;
  const isNotUtilColumn = header.column.columnDef.meta?.columnType != "util";
  const isDerivedColumn = header.column.columnDef.meta?.fieldType === "derived_entry";

  // Determine the applied transform
  const appliedTransform: Transform | null = isDragging
    ? transform : isInActiveGroup ? draggingColumns.active.transform ?? null : isInOverGroup
    ? draggingColumns.over.transform ?? null : isParentColumn ? null : transform;

  const appliedTransition = "width transform 0.2s ease-in-out";

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
    zIndex: isColumnDragging || isPinned ? 1 : 0,
    borderRight: "1px solid var(--muted)",
    borderBottom: "1px solid var(--muted)",
    borderTop: "1px solid var(--muted)",
    color: isAllColumnSelected(header) ? "var(--primary-foreground)" : "",
    backgroundColor: isNotUtilColumn
      ? isAllColumnSelected(header) ? `var(--primary)` : hovered ? "var(--muted)" : isPinned ? "var(--background)" : ""
      : isAllTableSelected() ? `var(--primary)` : hovered ? "var(--muted)" : "var(--background)"
  };

  return (
    <TableHead 
      colSpan={header.colSpan} 
      ref={setNodeRef} 
      style={style} 
      className={`relative px-0 py-0`} // Reset padding to let the grabbing area span the entire width       
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
              <span className="text-center flex-shrink-0 mr-4">
                {flexRender(header.column.columnDef.header, header.getContext())}
              </span>

              {/* Inline Column Actions for Parent Columns */}
              {isParentColumn && (
                <div
                  className="flex items-center gap-0.75"
                  onMouseDown={(e) => e.stopPropagation()} // Prevent event bubbling for action buttons
                  onMouseUp={(e) => e.stopPropagation()}   // Prevent event bubbling for action buttons
                >
                  <ColumnGroupBy interactive={interactive} column={header.column} grouping={grouping} setGrouping={setGrouping} />
                  <ColumnContext interactive={interactive} column={header.column} context={context} setContext={setContext} />
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
            <ColumnHide column={header.column} columnVisibility={columnVisibility} setColumnVisibility={setColumnVisibility} />
          </div>
        )}

        {/* Column actions */}
        {!header.isPlaceholder && isNotUtilColumn && !isDerivedColumn &&
          <div className="flex items-center justify-center gap-2 mt-2">
            {!isParentColumn && <ColumnGroupBy interactive={interactive} column={header.column} grouping={grouping} setGrouping={setGrouping}/>}
            {!isParentColumn && <ColumnSort interactive={interactive} column={header.column}/>}
            {!isParentColumn && ColumnFilters && ColumnFilters(header.column)}
          </div>
        }

        {/* New columns */}
        {!header.isPlaceholder &&
          <ColumnShow
            table={table}
            header={header}
            columnVisibility={columnVisibility}
            setColumnVisibility={setColumnVisibility}
            columnOrder={columnOrder}
            setColumnOrder={setColumnOrder}
            ColumnCreate={ColumnCreate}
          />
        }

      </div>
    </TableHead>
  );
};

export default DataTableHeader;
