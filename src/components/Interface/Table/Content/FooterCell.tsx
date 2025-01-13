import { CSSProperties, ReactNode } from "react";

import { Cell, Column, Row, flexRender } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { TableCell } from "@/components/UI/table";

import ColumnResizer from "@/components/Common/Tables/Data/Buttons/ColumnResize";

const FooterCell = ({ column, resizeMap, children }: { 
    column: Column<any| unknown>,
    resizeMap: { [x: string]: (event: unknown) => void },
    children: ReactNode
  }) => {
      const { isDragging, setNodeRef, transform } = useSortable({
        id: column.id,
      });

      const isPinned = column.getIsPinned();
      const isLastLeftPinnedColumn =  isPinned === "left" && column.getIsLastColumn('left')

      const style: CSSProperties = {
        boxShadow: isLastLeftPinnedColumn ? '-4px 0 4px -4px gray inset'  : undefined,
        opacity: isDragging ? 0.8 : 1,
        position: isPinned ? "sticky" : "relative",
        left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
        right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
        transform: CSS.Translate.toString(transform), // translate instead of transform to avoid squishing
        transition: "width transform 0.2s ease-in-out",
        maxWidth: `${Math.round(column.getSize())}px`,
        zIndex: isDragging || isPinned ? 1 : 0,
        backgroundColor: isPinned ? "var(--background)" : "",
      };
    
      const nestedExpand = (row: Row<any>, expanded: boolean) => {
        row.toggleExpanded(expanded)
        if (row.subRows.length > 0)
          row.subRows.forEach(r => nestedExpand(r, expanded))
      }

      return (
        <TableCell 
          style={style}
          ref={setNodeRef} 
          className="group/cell relative select-none overflow-visible"
        >
          <div className="font-bold overflow-hidden text-nowrap text-ellipsis ...">
            {children}
          </div>

          <ColumnResizer column={column} resizeHandler={resizeMap[column.id]}/>

        </TableCell>
      );
    };

export default FooterCell;
