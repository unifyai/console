import { CSSProperties, ReactNode } from "react";

import { Column, Row, Table as TanTable } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, Transform } from "@dnd-kit/utilities";

import { TableCell } from "@/components/UI/table";
import ColumnResizer from "@/components/Common/Tables/Data/Buttons/ColumnResize";
import ColumnPinner from "@/components/Common/Tables/Data/Buttons/ColumnPinner";

import { DraggingColumnsState, DraggingColumnPinnerState } from "@/types/evals/columns";

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

    const style: CSSProperties = {
        borderTop: "1px solid var(--muted)",
        opacity: isColumnDragging ? 0.8 : 1,
        position: isPinned ? "sticky" : "relative",
        left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
        right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
        transform: CSS.Translate.toString(appliedTransform), // translate instead of transform to avoid squishing
        transition: appliedTransition,
        maxWidth: `${Math.round(column.getSize())}px`,
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
            className="group/cell relative select-none overflow-visible"
        >
            <div className="font-bold overflow-hidden text-nowrap text-ellipsis ...">
                {children}
            </div>
            {/* Pin handle */}
            {isLastLeftPinnedColumn && (
              <div className="absolute inset-y-0 right-0" style={{ width: 5 }}>
                <ColumnPinner
                  column={column}
                  table={table}
                  columnPinning={columnPinning}
                  columnOrder={columnOrder}
                  draggingColumnPinner={draggingColumnPinner}
                  setDraggingColumnPinner={setDraggingColumnPinner}
                />
              </div>
            )}

            {showResizer ? <ColumnResizer column={column} resizeHandler={resizeMap[column.id]} /> : null}
        </TableCell>
    );
};

export default FooterCell;
