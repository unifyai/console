import { CSSProperties, ReactNode } from "react";

import { Column, Row } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, Transform } from "@dnd-kit/utilities";

import { TableCell } from "@/components/UI/table";

import ColumnResizer from "@/components/Common/Tables/Data/Buttons/ColumnResize";
import { DraggingColumnsState } from "@/types/evals/columns";

const FooterCell = ({ 
    column, 
    resizeMap, 
    children, 
    draggingColumns,
}: { 
    column: Column<any| unknown>,
    resizeMap: { [x: string]: (event: unknown) => void },
    children: ReactNode,
    draggingColumns: DraggingColumnsState;
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

    return (
        <TableCell 
            style={style}
            ref={setNodeRef} 
            className="group/cell relative select-none overflow-visible"
        >
            {children}
            <ColumnResizer column={column} resizeHandler={resizeMap[column.id]}/>
        </TableCell>
    );
};

export default FooterCell;
