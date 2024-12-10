"use client";

import { Dispatch, SetStateAction, CSSProperties, ReactNode } from "react";

import { flexRender, Header, Column } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { TableHead } from "@/components/UI/table";
import ColumnSort from "../Buttons/ColumnSort";
import ColumnGroupBy from "../Buttons/ColumnGroupBy";
import ColumnHide from "../Buttons/ColumnHide";
import ColumnSearch from "../Buttons/ColumnSearch";
import ColumnResizer from "../Buttons/ColumnResize";

const DataTableHeader = ({header, ColumnFilters}: {
  header: Header<any, unknown>,
  ColumnFilters?: (column: Column<any | unknown>) => ReactNode;
}) => {
  
  const { attributes, isDragging, listeners, setNodeRef, transform } = useSortable({id: header.column.id});

  const isPinned = header.column.getIsPinned(); 

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: isPinned ? "sticky" : "relative",
    left: isPinned === "left" ? `${header.column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${header.column.getAfter("right")}px` : undefined,
    transform: CSS.Translate.toString(transform), // translate instead of transform to avoid squishing
    transition: "width transform 0.2s ease-in-out",
    whiteSpace: "nowrap",
    width: `calc(var(--header-${header?.id}-size) * 1px)`,
    zIndex: isDragging || isPinned ? 1 : 0,
  };

  return (
    <TableHead 
      colSpan={header.colSpan} 
      ref={setNodeRef} 
      style={style} 
      className="py-2 border-1 border-gray-200 rounded-md"
    >
        <div className={`${header.subHeaders.length > 0 ? "text-center" : "inline-flex w-full justify-between gap-3"} items-center`}>
          
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

        {/*!header.isPlaceholder && header.subHeaders.length === 0 && header.column.columnDef.meta?.columnType != "util" &&
          <ColumnSearch column={header.column}/>
        */}

        <ColumnResizer header={header}/>
    </TableHead>
  );
};

export default DataTableHeader;
