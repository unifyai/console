"use client";

import { useState, CSSProperties, ReactNode, Dispatch, SetStateAction } from "react";

import { Header, Cell, Row, flexRender } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, Transform } from "@dnd-kit/utilities";

import { TableCell } from "@/components/UI/table";
import { DraggingColumnsState } from "@/types/evals/columns";

import { CornerDownLeft } from "lucide-react";
import ColumnResizer from "../Buttons/ColumnResize";
import { Skeleton } from "@/components/UI/skeleton";
import { sanitizeId } from "@/utils/evals/columnOperations";
import { RowExpandingProps } from "../Buttons/RowExpanding";
import { StateProps } from "@/types/dataTable";

const DataTableCell = ({
  cell,
  row,
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
  setExpandingRowId,
  state,
  children,
}: {
  cell: Cell<any, unknown>,
  row: Row<any>,
  selectedCells: string[],
  isCellSelected: (cell: Cell<any, any>) => boolean,
  cellSelection: {
    handleCellMouseDown: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
    handleCellMouseUp: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
    handleCellMouseOver: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
    handleCellsKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  },
  resizeMap: { [x: string]: (event: unknown) => void },
  ExtraCellContent?: (cell: Cell<any, unknown>, isCellExpanded: (cell: Cell<any, unknown>) => boolean, setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>) => ReactNode,
  AggregatedCell?: (cell: Cell<any, unknown>, row: Row<any>) => ReactNode,
  isCellExpanded: (cell: Cell<any, unknown>) => boolean,
  setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>,
  draggingColumns: DraggingColumnsState,
  RowExpanding?: (props: RowExpandingProps) => ReactNode,
  isAnimating: boolean,
  setExpandingRowId: (id: string | null) => void,
  state: StateProps,
  children?: ReactNode,
}) => {
  const { isDragging, setNodeRef, transform } = useSortable({
    id: cell.column.id,
  });

  const columnID = cell.column.columnDef.id!;
  const cellID = `${cell.row.id}_${sanitizeId(columnID)}`
  const isNewCell = state.tableDataItem.newCells ? state.tableDataItem.newCells.includes(cellID) : undefined;

  // Pre-calculate checks for active and over states
  const isInActiveGroup = draggingColumns.active.ids?.includes(columnID);
  const isInOverGroup = draggingColumns.over.ids?.includes(columnID);

  // Consolidate into a single flag for overall dragging state
  const isPartOfDraggingState = isInActiveGroup || isInOverGroup;

  // For dragging columns that are parents, use the transform/transition from the parent dragging state
  const isColumnDragging = isDragging || isPartOfDraggingState;

  const isPinned = cell.column.getIsPinned();
  const isParentColumn = cell.column.columnDef.meta?.isParent;
  const isLastLeftPinnedColumn = isPinned === "left" && cell.column.getIsLastColumn('left');

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

  const properties = row.getAllCells().map((cell) => cell.column.id);

  // Handle cell coloring.
  // - Applies background color on any non aggregated, non placeholder, non grouped cell when hovered / selected
  // - Applied background color on any index cell if all non aggregated, non placeholder, non grouped cells in the same row are selected
  const [hovered, setHovered] = useState(false);
  const isSelectableCell = (cell: Cell<any, unknown>) =>
    !cell.getIsGrouped() && !cell.getIsAggregated() && !cell.getIsPlaceholder() && cell.column.getIsVisible()
  const isAllRowSelected = (cell: Cell<any, unknown>) => 
    cell.getContext().row.getAllCells()
        .filter(c => isSelectableCell(c) && c.column.id != "RowNumbering")
        .every(c => isCellSelected(c))

  const style: CSSProperties = {
    boxShadow: isLastLeftPinnedColumn ? '-4px 0 4px -4px gray inset'  : undefined,
    opacity: isColumnDragging ? 0.8 : 1,
    position: isPinned ? "sticky" : "relative",
    left: isPinned === "left" ? `${cell.column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${cell.column.getAfter("right")}px` : undefined,
    transform: CSS.Translate.toString(appliedTransform), // translate instead of transform to avoid squishing
    transition: appliedTransition,
    height: "21px",
    minWidth: columnID === "RowNumbering" ? "120px" : undefined,
    maxWidth: `${Math.round(cell.column.getSize())}px`,
    zIndex: isColumnDragging || isPinned ? 1 : 0,
    borderRight: "1px solid var(--muted)",
    outline: "none",
    color: cell.column.id != "RowNumbering"
      ? isCellSelected(cell) ? "var(--primary-foreground)" : ""
      : isSelectableCell(cell) && isAllRowSelected(cell) ? "var(--primary-foreground)" : "",
    backgroundColor: cell.column.id != "RowNumbering"
      ? isCellSelected(cell) ? `var(--primary)` : hovered ? "var(--muted)" : isPinned ? "var(--background)" : ""
      : isSelectableCell(cell) && isAllRowSelected(cell) ? `var(--primary)` : hovered ? "var(--muted)" : isPinned ? "var(--background)" : "",
  };

  const [isLoading, setIsLoading] = useState(false);

  // Check if this row is grouped and has subrows that have not been populated yet
  const hasSkeletonLogs = 'groupCount' in row.original && 
        row.original.groupCount > 0 &&
        !row.original.isPopulated;

  // Check if this cell should show grouping controls
  const shouldShowGrouping = cell.getIsGrouped() || 
    ('groupCount' in row.original && row.original.groupCount > 0 && columnID === sanitizeId(row.original.groupingColumnId));

  if (cell.isRowSpanned) return null;

  const isNotUtilColumn = cell.column.columnDef.meta?.columnType !== "util";

  return (
    <TableCell 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => cellSelection.handleCellMouseDown(e, cell)}
      onMouseUp={(e) => cellSelection.handleCellMouseUp(e, cell)}
      onMouseOver={(e) => cellSelection.handleCellMouseOver(e, cell)}
      onKeyDown={(e) => cellSelection.handleCellsKeyDown(e)}
      rowSpan={cell.rowSpan}
      style={style}
      tabIndex={0}  // Needed to ensure the table is focusable and the keyboard actions are working
      ref={setNodeRef}
      className={`group/cell relative select-none ${isNewCell ? 'animate-fade-accent' : ''}`}
    >
      <div className="overflow-hidden text-nowrap text-ellipsis ...">
        {shouldShowGrouping 
          ? (properties.includes(columnID) &&
            <div className="flex flex-row gap-2 items-center text-left truncate ... overflow-hidden">
              {RowExpanding && (
                RowExpanding({
                  row,
                  groupingColumnId: row.original.groupingColumnId,
                  isLoading,
                  isAnimating,
                  onExpand: () => Promise.resolve(),
                  setExpandingRowId,
                })
              )}
              {isLoading ? (
                <div className="flex-1">
                  <Skeleton className="h-4 w-[100px]" />
                </div>
              ) : (
                <>
                  ({row.original.groupCount}){" "}
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </>
              )}
            </div>
          ) 
          : cell.getIsAggregated() && isNotUtilColumn
            ? (flexRender(AggregatedCell && AggregatedCell(cell, row), cell.getContext())) 
            : cell.getIsPlaceholder() 
                ? null // For cells with repeated values, render null 
              : (flexRender(cell.column.columnDef.cell, cell.getContext()))
        }
      </div>

      <ColumnResizer column={cell.column} resizeHandler={resizeMap[cell.column.id]}/>

      {ExtraCellContent && !hasSkeletonLogs && isSelectableCell(cell) && ExtraCellContent(cell, isCellExpanded, setExpandedCells)}

      {selectedCells.length > 0 && selectedCells.indexOf(cell.id) === selectedCells.length - 1 &&
        <CornerDownLeft className="absolute z-20 text-white bottom-1 right-0.5 w-5 h-3 font-bold"/>
      }

      {children}
    </TableCell>
  );
};

export default DataTableCell;
