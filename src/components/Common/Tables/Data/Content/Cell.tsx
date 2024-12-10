import { CSSProperties, ReactNode } from "react";

import { Cell, Row, flexRender } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { TableCell } from "@/components/UI/table";

import { ChevronRight } from "lucide-react";
import AddHiddenColumn from "../Buttons/AddHiddenColumn";
import { SetStateProps, StateProps } from "@/types/dataTable";

const DataTableCell = ({ cell, row, state, setState, AggregatedCell, ExtraCellContent }: { 
    cell: Cell<any, unknown>, 
    row: Row<any | unknown>, 
    state: StateProps,
    setState: SetStateProps,
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
        width: `calc(var(--header-${cell.column.id}-size) * 1px)`,
        zIndex: isDragging || isPinned ? 1 : 0,
      };

      if (cell.isRowSpanned) return null;
    
      return (
        <TableCell 
          rowSpan={cell.rowSpan}
          style={style}
          ref={setNodeRef} 
          className={`group/cell relative select-none overflow-visible ${row.getIsSelected() ? "bg-secondary" : ""}`}
        >

          <div className="truncate ...">
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
          
          {Object.values(state.columnVisibility).some(value => !value) && <AddHiddenColumn cell={cell} state={state} setState={setState}/>}

          {ExtraCellContent && ExtraCellContent(cell)}

        </TableCell>
      );
    };

export default DataTableCell;
