import { CSSProperties, ReactNode } from "react";

import { Cell, Row, flexRender } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { TableCell } from "@/components/UI/table";

import { ChevronRight } from "lucide-react";
import ColumnResizer from "../Buttons/ColumnResize";

const DataTableCell = ({ cell, row, resizeMap, AggregatedCell, ExtraCellContent }: { 
    cell: Cell<any, unknown>, 
    row: Row<any | unknown>, 
    resizeMap: { [x: string]: (event: unknown) => void },
    AggregatedCell?: (cell: Cell<any, unknown>, row: Row<any | unknown>) => ReactNode,
    ExtraCellContent?: (cell: Cell<any, unknown>) => ReactNode
  }) => {
      const { isDragging, setNodeRef, transform } = useSortable({
        id: cell.column.id,
      });

      const columnID = cell.column.columnDef.id!;
      const isPinned = cell.column.getIsPinned();
      const properties = row.getAllCells().map((cell) => cell.column.id);
  
      const style: CSSProperties = {
        opacity: isDragging ? 0.8 : 1,
        position: isPinned ? "sticky" : "relative",
        left: isPinned === "left" ? `${cell.column.getStart("left")}px` : undefined,
        right: isPinned === "right" ? `${cell.column.getAfter("right")}px` : undefined,
        transform: CSS.Translate.toString(transform), // translate instead of transform to avoid squishing
        transition: "width transform 0.2s ease-in-out",
        height: "21px",
        maxWidth: `${Math.round(cell.column.getSize())}px`,
        zIndex: isDragging || isPinned ? 1 : 0,
        borderRight: "1px solid var(--muted)",
        backgroundColor: isPinned ? "var(--background)" : "",
      };

      if (cell.isRowSpanned) return null;
    
      return (
        <TableCell 
          rowSpan={cell.rowSpan}
          style={style}
          ref={setNodeRef} 
          className={`group/cell relative select-none overflow-visible ${row.getIsSelected() ? "bg-secondary text-white" : ""}`}
        >
          <div className="overflow-hidden text-nowrap text-ellipsis ...">
            {cell.getIsGrouped() 
              ? ( properties.includes(columnID) &&
                <div className="flex flex-row gap-2 items-center text-left truncate ... overflow-hidden">
                  <button className={`${row.getIsExpanded() ? "rotate-90" : ""} cursor-pointer`} onClick={(e) => {
                      e.stopPropagation();
                      row.toggleExpanded();
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

          {ExtraCellContent && ExtraCellContent(cell)}

        </TableCell>
      );
    };

export default DataTableCell;
