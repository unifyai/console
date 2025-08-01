import { CSSProperties, ReactNode } from "react";

import { Column, Row, Table as TanTable } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, Transform } from "@dnd-kit/utilities";

import { TableCell } from "@/components/UI/table";
import ColumnResizer from "@/components/Common/Tables/Data/Buttons/ColumnResize";
import ColumnPinner from "@/components/Common/Tables/Data/Buttons/ColumnPinner";

import { DraggingColumnsState, DraggingColumnPinnerState } from "@/types/interfaces/columns";
import TableResizer from "@/components/Common/Tables/Data/Buttons/TableResize";

const FooterCell = ({ 
    column, 
    resizeMap, 
    children, 
    draggingColumns,
    draggingColumnPinner,
    setDraggingColumnPinner,
    columnPinning,
    columnOrder,
    table,
    isRightmost
}: { 
    column: Column<any| unknown>,
    resizeMap: { [x: string]: (event: unknown) => void },
    children: ReactNode,
    draggingColumns: DraggingColumnsState;
    draggingColumnPinner: DraggingColumnPinnerState;
    setDraggingColumnPinner: (state: DraggingColumnPinnerState) => void;
    columnPinning: { left?: string[]; right?: string[] };
    columnOrder: string[];
    table: TanTable<any>;
    isRightmost?: boolean
}) => {
    const { isDragging, setNodeRef, transform } = useSortable({id: column.id,});

    // Pre-calculate checks for active and over states
    const isInActiveGroup = draggingColumns.active.ids?.includes(column.id);
    const isInOverGroup = draggingColumns.over.ids?.includes(column.id);

    // Consolidate into a single flag for overall dragging state
    const isPartOfDraggingState = isInActiveGroup || isInOverGroup;

    // For dragging columns that are parents, use the transform/transition from the parent dragging state
    const isColumnDragging = isDragging || isPartOfDraggingState;

    const isPinned = column.getIsPinned();
    const isLastLeftPinnedColumn = isPinned === "left" && column.getIsLastColumn('left');
    const isParentColumn = column.columnDef.meta?.isParent;

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


    // --- Border Logic (copied from DataTableCell for consistency) ---
    const leafCols = table.getAllLeafColumns();
    const maxDepth = Math.max(...leafCols.map(c => c.depth));
    let ancestor = column;
    const boundaryDepths: number[] = [];
    while (ancestor) {
        if (ancestor.columnDef.meta?.isParent) {
            const leafs = ancestor.getLeafColumns();
            if (leafs.length > 0 && leafs[leafs.length - 1].id === column.id) {
                boundaryDepths.push(ancestor.depth);
            }
        }
        ancestor = ancestor.parent!;
    }
    const boundaryDepth = boundaryDepths.length ? Math.min(...boundaryDepths) : column.depth;
    const borderThickness = column.id === "RowNumbering" ? 1 : Math.max(1, maxDepth - boundaryDepth + 1);


    const style: CSSProperties = {
        boxShadow: isLastLeftPinnedColumn ? '-4px 0 4px -4px gray inset' : undefined,
        borderTop: "1px solid var(--muted)",
        borderBottom: "1px solid var(--muted)",
        borderLeft: column.id === "RowNumbering" ? "1px solid var(--muted)" : undefined,
        borderRight: `${borderThickness}px solid var(--muted)`,
        opacity: isColumnDragging ? 0.8 : 1,
        position: isPinned ? "sticky" : undefined,
        left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
        right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
        transform: CSS.Translate.toString(appliedTransform), // translate instead of transform to avoid squishing
        transition: appliedTransition,
        width: `${Math.round(column.getSize())}px`,
        zIndex: isColumnDragging || isPinned ? 1 : 0,
        backgroundColor: isPinned ? "var(--background)" : "",
    };

    const nestedExpand = (row: Row<any>, expanded: boolean) => {
        row.toggleExpanded(expanded)
        if (row.subRows.length > 0)
            row.subRows.forEach(r => nestedExpand(r, expanded))
    }

    const showResizer = column.getCanResize() && !draggingColumnPinner.isPinning;

    return (
        <TableCell 
            style={style}
            ref={setNodeRef} 
            className={`group/cell relative select-none overflow-visible ${column.id === "RowNumbering" ? "text-left" : "text-center"}`}
        >
            <div className={`font-bold min-h-[1rem] flex flex-col ${column.id === "RowNumbering" ? "items-start justify-start pl-2" : "text-nowrap text-ellipsis items-center justify-center"}`}>
                {children}
            </div>
            {/* Pin handle */}
            {isLastLeftPinnedColumn && (
              <div className="absolute inset-y-0 right-0" style={{ width: 5 }}>
                <ColumnPinner
                  column={column}
                  table={table}
                  columnOrder={columnOrder}
                  draggingColumnPinner={draggingColumnPinner}
                  setDraggingColumnPinner={setDraggingColumnPinner}
                />
              </div>
            )}

            {showResizer && (
              <>
                <ColumnResizer column={column} resizeHandler={resizeMap[column.id]} />
                {isRightmost && <TableResizer table={table} setColumnSizing={table.options.onColumnSizingChange as any} />}
              </>
            )}
        </TableCell>
    );
};

export default FooterCell;
