"use client";

import { useState, CSSProperties, ReactNode, Dispatch, SetStateAction } from "react";

import { Header, Cell, Row, flexRender } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, Transform } from "@dnd-kit/utilities";

import { TableCell } from "@/components/UI/table";

import { ChevronRight, CornerDownLeft } from "lucide-react";
import ColumnResizer from "../Buttons/ColumnResize";
import { DraggingColumnsState } from "@/types/evals/columns";

const DataTableCell = ({ cell, row, selectedCells, isCellSelected, cellSelection, resizeMap, isCellExpanded, setExpandedCells, draggingColumns, AggregatedCell, ExtraCellContent }: { 
    cell: Cell<any, unknown>, 
    row: Row<any | unknown>,
    selectedCells: string[],
    isCellSelected: (cell: Cell<any, any>) => boolean,
    cellSelection: {
      handleCellMouseDown: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
      handleCellMouseUp: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
      handleCellMouseOver: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
      handleCellsKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
    }
    resizeMap: { [x: string]: (event: unknown) => void },
    isCellExpanded: (cell: Cell<any, unknown>) => boolean,
    setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>,
    draggingColumns: DraggingColumnsState,
    AggregatedCell?: (cell: Cell<any, unknown>, row: Row<any | unknown>) => ReactNode,
    ExtraCellContent?: (cell: Cell<any, unknown>, isCellExpanded: (cell: Cell<any, unknown>) => boolean, setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>) => ReactNode
  }) => {
      const { isDragging, setNodeRef, transform } = useSortable({
        id: cell.column.id,
      });

      const columnID = cell.column.columnDef.id!;

      // Pre-calculate checks for active and over states
      const isInActiveGroup = draggingColumns.active.ids?.includes(columnID);
      const isInOverGroup = draggingColumns.over.ids?.includes(columnID);

      // Consolidate into a single flag for overall dragging state
      const isPartOfDraggingState = isInActiveGroup || isInOverGroup;

      // For dragging columns that are parents, use the transform/transition from the parent dragging state
      const isColumnDragging = isDragging || isPartOfDraggingState;

      const isPinned = cell.column.getIsPinned();
      const isParentColumn = cell.column.columnDef.meta?.isParent;

      // Determine the applied transform
      const appliedTransform: Transform | null = isDragging
        ? transform : isInActiveGroup ? draggingColumns.active.transform ?? null : isInOverGroup
        ? draggingColumns.over.transform ?? null : isParentColumn ? null : transform;

      const appliedTransition = "width transform 0.2s ease-in-out";

      const isLastLeftPinnedColumn =  isPinned === "left" && cell.column.getIsLastColumn('left')

      const properties = row.getAllCells().map((cell) => cell.column.id);
  
      // Handle cell coloring.
      // - Applies background color on any non aggregated, non placeholder, non grouped cell when hovered / selected
      // - Applied background color on any index cell if all non aggregated, non placeholder, non grouped cells in the same row are selected
      const [hovered, setHovered] = useState(false);
      const isSelectableCell = (cell: Cell<any, unknown>) =>
        !cell.getIsGrouped() && !cell.getIsAggregated() && !cell.getIsPlaceholder()
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
          : isSelectableCell(cell) && isAllRowSelected(cell) ? `var(--primary)` : hovered ? "var(--muted)" : isPinned ? "var(--background)" : ""
      };

      if (cell.isRowSpanned) return null;
    
      const nestedExpand = (row: Row<any>, expanded: boolean) => {
        row.toggleExpanded(expanded)
        if (row.subRows.length > 0)
          row.subRows.forEach(r => nestedExpand(r, expanded))
      }

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
          className={`group/cell relative select-none`}
        >
          <div className="overflow-hidden text-nowrap text-ellipsis ...">
            {cell.getIsGrouped() 
              ? ( properties.includes(columnID) &&
                <div className="flex flex-row gap-2 items-center text-left truncate ... overflow-hidden">
                  <button className={`${row.getIsExpanded() ? "rotate-90" : ""} cursor-pointer`} onClick={(e) => {
                      e.stopPropagation();
                      nestedExpand(row, !row.getIsExpanded());
                    }}>
                    <ChevronRight/>
                  </button>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}{" "}
                    ({row.subRows.length})
                </div> ) 
              : cell.getIsAggregated() ? (flexRender(AggregatedCell && AggregatedCell(cell, row), cell.getContext())) 
              : cell.getIsPlaceholder() 
                  ? null // For cells with repeated values, render null 
                  : (flexRender(cell.column.columnDef.cell, cell.getContext()))
            }
          </div>

          <ColumnResizer column={cell.column} resizeHandler={resizeMap[cell.column.id]}/>

          {ExtraCellContent && isSelectableCell(cell) && ExtraCellContent(cell, isCellExpanded, setExpandedCells)}

          {selectedCells.length > 0 && selectedCells.indexOf(cell.id) === selectedCells.length - 1 &&
            <CornerDownLeft className="absolute z-20 text-white bottom-1 right-0.5 w-5 h-3 font-bold"/>
          }

        </TableCell>
      );
    };

export default DataTableCell;
