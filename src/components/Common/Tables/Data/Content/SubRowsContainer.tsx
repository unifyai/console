import React, { ReactNode, Dispatch, SetStateAction } from "react";
import { Row, Cell, Table } from "@tanstack/react-table";
import { StateProps } from "@/types/dataTable";
import { TableRow, TableCell, TableBody, Table as TableUI } from "@/components/UI/table";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import DataTableRow from "./Row";
import { LogProps, GroupedLogProps } from "@/types/interfaces/logs";
import { RowExpandingProps } from "../Buttons/RowExpanding";
import styles from "./SubRowsContainer.module.css";

interface SubRowsContainerProps<TData extends LogProps | GroupedLogProps> {
    parentRow: Row<TData>;
    subRows: Row<TData>[];
    table: Table<TData>;
    state: StateProps;
    setExpandingRowId: (id: string | null) => void;
    expandingRowId: string | null;
    RowExpanding?: (props: RowExpandingProps) => ReactNode;
    ExtraCellContent?: (cell: Cell<TData, unknown>, isCellExpanded: (cell: Cell<TData, unknown>) => boolean, setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>) => ReactNode;
    AggregatedCell?: (cell: Cell<TData, unknown>, row: Row<TData>) => ReactNode;
    renderSkeletonRows: (count?: number) => ReactNode;
    cellSelection: any;
    isCellSelected: (cell: Cell<TData, unknown>) => boolean;
    isCellExpanded: (cell: Cell<TData, unknown>) => boolean;
    setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>;
    selectedCells: string[];
    resizeMap: {[x: string]: (event: unknown) => void;};
    draggingColumns: any;
    isAnimating: boolean;
    setDraggingColumnPinner: (state: any) => void;
    columnCount: number;
    // GroupLoadMore component and props
    GroupLoadMore?: React.ComponentType<{
        groupId: string;
        colSpan: number;
        interactive?: boolean;
        hasNextPage?: boolean;
    }> | null;
    interactive?: boolean;
    groupHasNextPage?: boolean; // External hasNextPage calculation for this group
}

/**
 * SubRowsContainer handles rendering subRows within a scrollable container
 * and manages GroupLoadMore placement at the end of subRows
 */
export default function SubRowsContainer<TData extends LogProps | GroupedLogProps>({
    parentRow,
    subRows,
    table,
    state,
    setExpandingRowId,
    expandingRowId,
    RowExpanding,
    ExtraCellContent,
    AggregatedCell,
    renderSkeletonRows,
    cellSelection,
    isCellSelected,
    isCellExpanded,
    setExpandedCells,
    selectedCells,
    resizeMap,
    draggingColumns,
    isAnimating,
    setDraggingColumnPinner,
    columnCount,
    GroupLoadMore,
    interactive = true,
    groupHasNextPage = false,
}: SubRowsContainerProps<TData>) {
    
    // Don't render if no subRows
    if (!subRows.length) {
        return null;
    }

    // Get column widths from parent table to ensure alignment
    const getColumnWidths = () => {
        const columns = table.getVisibleLeafColumns();
        return columns.map(column => column.getSize());
    };

    const columnWidths = getColumnWidths();

    // Recursively render subRows and their own subRows as regular table rows
    const renderSubRow = (row: Row<TData>): ReactNode => {
        // Get this row's children if any
        const rowSubRows = subRows.filter(subRow => {
            const subRowParentId = (subRow as any).parentId;
            return subRowParentId === row.id;
        });

        return (
            <React.Fragment key={row.id}>
                {/* Render the subRow itself as a regular DataTableRow */}
                <DataTableRow
                    row={row}
                    table={table}
                    state={state}
                    setExpandingRowId={setExpandingRowId}
                    expandingRowId={expandingRowId}
                    RowExpanding={RowExpanding}
                    ExtraCellContent={ExtraCellContent}
                    AggregatedCell={AggregatedCell}
                    renderSkeletonRows={renderSkeletonRows}
                    cellSelection={cellSelection}
                    isCellSelected={isCellSelected}
                    isCellExpanded={isCellExpanded}
                    setExpandedCells={setExpandedCells}
                    selectedCells={selectedCells}
                    resizeMap={resizeMap}
                    draggingColumns={draggingColumns}
                    isAnimating={isAnimating}
                    setDraggingColumnPinner={setDraggingColumnPinner}
                />

                {/* Recursively render this row's subRows if expanded and they exist */}
                {row.getIsExpanded() && rowSubRows.length > 0 && (
                    <SubRowsContainer
                        parentRow={row}
                        subRows={rowSubRows}
                        table={table}
                        state={state}
                        setExpandingRowId={setExpandingRowId}
                        expandingRowId={expandingRowId}
                        RowExpanding={RowExpanding}
                        ExtraCellContent={ExtraCellContent}
                        AggregatedCell={AggregatedCell}
                        renderSkeletonRows={renderSkeletonRows}
                        cellSelection={cellSelection}
                        isCellSelected={isCellSelected}
                        isCellExpanded={isCellExpanded}
                        setExpandedCells={setExpandedCells}
                        selectedCells={selectedCells}
                        resizeMap={resizeMap}
                        draggingColumns={draggingColumns}
                        isAnimating={isAnimating}
                        setDraggingColumnPinner={setDraggingColumnPinner}
                        columnCount={columnCount}
                        GroupLoadMore={GroupLoadMore}
                        interactive={interactive}
                        groupHasNextPage={groupHasNextPage}
                    />
                )}
            </React.Fragment>
        );
    };

    // Get direct children of the parentRow
    const directChildren = subRows.filter(subRow => {
        const subRowParentId = (subRow as any).parentId;
        return subRowParentId === parentRow.id;
    });

    return (
        <>
            <TableRow key={`${parentRow.id}-subrows-container`}>
                <TableCell colSpan={parentRow.getVisibleCells().length} className="p-0">
                    {/* Custom scrollable container with native scrollbar styled to match shadcn */}
                    <div 
                        className={`relative w-full overflow-y-auto overflow-x-hidden max-h-[calc(100vh-350px)] ${styles.customScrollbar}`}
                        style={{
                            // CSS Custom Properties for scrollbar styling
                            '--scrollbar-width': '10px',
                            '--scrollbar-track': 'transparent',
                            '--scrollbar-thumb': 'hsl(var(--border))',
                            '--scrollbar-thumb-hover': 'hsl(var(--border))',
                        } as React.CSSProperties}
                    >
                        <div className="min-w-max w-full">
                            <div className="min-w-fit w-max">
                                <TableUI 
                                    className={`relative LogsTable-${parentRow.id} w-full caption-bottom text-sm border-separate border-spacing-0`}
                                    style={{ width: table.getTotalSize(), tableLayout: 'fixed'}}
                                >
                                    {/* Column group to match parent table's column widths */}
                                    <colgroup>
                                        {columnWidths.map((width, index) => (
                                            <col key={index} style={{ width: `${width}px` }} />
                                        ))}
                                    </colgroup>
                                    <TableBody className="contents">
                                        {/* Render direct children and their nested subRows */}
                                        {directChildren.map(renderSubRow)}
                                    </TableBody>
                                </TableUI>
                            </div>
                        </div>
                    </div>
                </TableCell>
            </TableRow>

            {/* GroupLoadMore for this parent group */}
            {GroupLoadMore && (
                <GroupLoadMore
                    groupId={parentRow.id}
                    colSpan={columnCount}
                    interactive={interactive}
                    hasNextPage={groupHasNextPage}
                />
            )}
        </>
    );
} 