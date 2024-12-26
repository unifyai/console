import { CSSProperties, ReactNode } from "react";

import { Header, Cell, Row, flexRender } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { TableCell } from "@/components/UI/table";

import { ChevronRight } from "lucide-react";
import ColumnResizer from "../Buttons/ColumnResize";

const DataTableCell = ({ cell, row, isCellSelected, cellSelection, resizeMap, AggregatedCell, ExtraCellContent }: { 
    cell: Cell<any, unknown>, 
    row: Row<any | unknown>,
    isCellSelected: (cell: Cell<any, any>) => boolean,
    cellSelection: {
      handleCellMouseDown: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
      handleCellMouseUp: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
      handleCellMouseOver: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
      handleCellsKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
    }
    resizeMap: { [x: string]: (event: unknown) => void },
    AggregatedCell?: (cell: Cell<any, unknown>, row: Row<any | unknown>) => ReactNode,
    ExtraCellContent?: (cell: Cell<any, unknown>) => ReactNode
  }) => {
      const { isDragging, setNodeRef, transform } = useSortable({
        id: cell.column.id,
      });

      const columnID = cell.column.columnDef.id!;
      const isPinned = cell.column.getIsPinned();
      const isLastLeftPinnedColumn =  isPinned === "left" && cell.column.getIsLastColumn('left')

      const properties = row.getAllCells().map((cell) => cell.column.id);
  
      const style: CSSProperties = {
        boxShadow: isLastLeftPinnedColumn ? '-4px 0 4px -4px gray inset'  : undefined,
        opacity: isDragging ? 0.8 : 1,
        position: isPinned ? "sticky" : "relative",
        left: isPinned === "left" ? `${cell.column.getStart("left")}px` : undefined,
        right: isPinned === "right" ? `${cell.column.getAfter("right")}px` : undefined,
        transform: CSS.Translate.toString(transform), // translate instead of transform to avoid squishing
        transition: "width transform 0.2s ease-in-out",
        height: "21px",
        minWidth: columnID === "RowNumbering" ? "120px" : undefined,
        maxWidth: `${Math.round(cell.column.getSize())}px`,
        zIndex: isDragging || isPinned ? 1 : 0,
        borderRight: "1px solid var(--muted)",
        backgroundColor: isPinned ? "var(--background)" : "",
      };

      if (cell.isRowSpanned) return null;
    
      const nestedExpand = (row: Row<any>, expanded: boolean) => {
        row.toggleExpanded(expanded)
        if (row.subRows.length > 0)
          row.subRows.forEach(r => nestedExpand(r, expanded))
      }

      return (
        <TableCell 
          onMouseDown={(e) => cellSelection.handleCellMouseDown(e, cell)}
          onMouseUp={(e) => cellSelection.handleCellMouseUp(e, cell)}
          onMouseOver={(e) => cellSelection.handleCellMouseOver(e, cell)}
          onKeyDown={(e) => cellSelection.handleCellsKeyDown(e)}
          rowSpan={cell.rowSpan}
          style={style}
          tabIndex={0}  // Needed to ensure the table is focusable and the keyboard actions are working
          ref={setNodeRef}
          className={`
            group/cell relative select-none overflow-visible 
            ${isCellSelected(cell) ? `bg-primary ${isPinned ? "" : "text-primary-foreground"}` : ""}
            ${!cell.getIsGrouped() && !cell.getIsAggregated() && !cell.getIsPlaceholder() && !isCellSelected(cell) && "hover:bg-muted opacity-[.01]"}
          `}
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

          {ExtraCellContent && ExtraCellContent(cell)}

        </TableCell>
      );
    };

export default DataTableCell;
