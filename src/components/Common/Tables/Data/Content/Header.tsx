"use client";

import { Dispatch, SetStateAction, CSSProperties, ReactNode } from "react";

import { flexRender, Header, Column, Table, Cell } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { TableHead } from "@/components/UI/table";
import ColumnSort from "../Buttons/ColumnSort";
import ColumnGroupBy from "../Buttons/ColumnGroupBy";
import ColumnHide from "../Buttons/ColumnHide";
import ColumnShow from "../Buttons/ColumnShow";

const DataTableHeader = ({table, header, cellSelection, columnVisibility, setColumnVisibility, ColumnFilters}: {
  table: Table<any | unknown>,
  header: Header<any, unknown>,
  cellSelection: {
    handleCellMouseDown: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
    handleCellMouseUp: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
    handleCellMouseOver: (e: React.MouseEvent<HTMLElement>, target: Cell<any, any> | Header<any, any>) => void;
    handleCellsKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  },
  columnVisibility: { [key: string]: boolean },
  setColumnVisibility: (columnVisibility: { [key: string]: boolean }) => void,
  ColumnFilters?: (column: Column<any | unknown>) => ReactNode;
}) => {
  
  const { attributes, isDragging, listeners, setNodeRef, transform } = useSortable({id: header.column.id});

  const isPinned = header.column.getIsPinned(); 
  const isLastLeftPinnedColumn =  isPinned === "left" && header.column.getIsLastColumn('left')

  const style: CSSProperties = {
    boxShadow: isLastLeftPinnedColumn ? '-4px 0 4px -4px gray inset'  : undefined,
    opacity: isDragging ? 0.8 : 1,
    position: isPinned ? "sticky" : "relative",
    left: isPinned === "left" ? `${header.column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${header.column.getAfter("right")}px` : undefined,
    transform: CSS.Translate.toString(transform), // translate instead of transform to avoid squishing
    transition: "width transform 0.2s ease-in-out",
    whiteSpace: "nowrap",
    width: `${Math.round(header.getSize())}px`,
    zIndex: isDragging || isPinned ? 1 : 0,
    borderRight: "1px solid var(--muted)",
    borderBottom: "1px solid var(--muted)",
    borderTop: "1px solid var(--muted)",
    backgroundColor: isPinned ? "var(--background)" : ""
  };
  
  return (
    <TableHead 
      onMouseDown={(e) => cellSelection.handleCellMouseDown(e, header)}
      onMouseUp={(e) => cellSelection.handleCellMouseUp(e, header)}
      onMouseOver={(e) => cellSelection.handleCellMouseOver(e, header)}
      colSpan={header.colSpan} 
      ref={setNodeRef} 
      style={style} 
      className="py-2 border-1 border-gray-200 relative"
    >
        <div className="flex-col items-center">
          {/* Content */}
          <div {...attributes} {...listeners} className={`cursor-grabbing select-none`}>
            {header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.header, header.getContext())
            }
          </div>

          {/* Column actions */}
          {!header.isPlaceholder && header.subHeaders.length === 0 && header.column.columnDef.meta?.columnType != "util" &&
            <div className="items-center">
              <ColumnGroupBy column={header.column}/>
              <ColumnSort column={header.column}/>
              {ColumnFilters && ColumnFilters(header.column)}
              <ColumnHide column={header.column}/>
            </div>
          }
        </div>

        {!header.isPlaceholder && header.subHeaders.length === 0 && header.column.columnDef.meta?.columnType != "util" &&
          <ColumnShow table={table} header={header} columnVisibility={columnVisibility} setColumnVisibility={setColumnVisibility}  />
        }

    </TableHead>
  );
};

export default DataTableHeader;
