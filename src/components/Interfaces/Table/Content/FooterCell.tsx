import { CSSProperties, ReactNode } from "react";

import { Cell, Column, Row, flexRender, Table } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, Transform } from "@dnd-kit/utilities";

import { TableCell } from "@/components/UI/table";

import ColumnResizer from "@/components/Common/Tables/Data/Buttons/ColumnResize";
import { DraggingColumnsState, PinningColumnState } from "@/types/evals/columns";
import { getNextLeafColumn, getPreviousLeafColumn } from "@/utils/evals/columnOperations";

const FooterCell = ({ 
    column, 
    resizeMap, 
    children, 
    draggingColumns,
    pinningState,
    setPinningState,
    columnOrder,
    table,
    columnPinning,
    setColumnPinning
}: { 
    column: Column<any| unknown>,
    resizeMap: { [x: string]: (event: unknown) => void },
    children: ReactNode,
    draggingColumns: DraggingColumnsState;
    pinningState: PinningColumnState;
    setPinningState: (state: PinningColumnState) => void;
    columnOrder: string[];
    table: Table<any>;
    columnPinning: { left?: string[]; right?: string[] };
    setColumnPinning: (pinning: { left?: string[]; right?: string[] }) => void;
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

    // Handle pinning animation
    const isPinning = pinningState.isPinning && (
        column.id === pinningState.columnId || // Current column being pinned
        (pinningState.direction === 'right' && column.id === getNextLeafColumn(column, columnOrder, table)?.id) || // Next column when pinning right
        (pinningState.direction === 'left' && column.id === getPreviousLeafColumn(column, columnOrder, table)?.id) // Previous column when pinning left
    );

    // Determine the applied transform for both dragging and pinning
    const appliedTransform: Transform | null = isDragging
        ? transform 
        : isInActiveGroup 
            ? draggingColumns.active.transform ?? null 
            : isInOverGroup
                ? draggingColumns.over.transform ?? null 
                : isPinning
                    ? pinningState.transform
                    : isParentColumn 
                        ? null 
                        : transform;

    const appliedTransition = isPinning 
        ? "none" 
        : "width transform 0.2s ease-in-out";

    // Add pinning border highlight
    const pinningBorderStyle = isPinning ? {
        '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            bottom: 0,
            [pinningState.direction === 'right' ? 'right' : 'left']: 0,
            width: '2px',
            background: 'var(--primary)',
            opacity: 0.7,
            transform: CSS.Translate.toString(pinningState.transform),
            transition: 'transform 0.2s ease-in-out',
        }
    } : {};

    const style: CSSProperties = {
        boxShadow: isLastLeftPinnedColumn ? '-4px 0 4px -4px gray inset' : undefined,
        opacity: isColumnDragging ? 0.8 : 1,
        position: isPinned ? "sticky" : "relative",
        left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
        right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
        transform: CSS.Translate.toString(appliedTransform), // translate instead of transform to avoid squishing
        transition: appliedTransition,
        maxWidth: `${Math.round(column.getSize())}px`,
        zIndex: isColumnDragging || isPinned ? 1 : 0,
        backgroundColor: isPinned ? "var(--background)" : "",
        ...pinningBorderStyle
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
