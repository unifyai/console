"use client";

import { useMemo, ReactNode, MouseEvent, JSX, Ref, Dispatch, SetStateAction, useState, useEffect } from "react";

import { ColumnFiltersState, ColumnPinningState, GroupingState, Header, SortingState, Updater, useReactTable } from "@tanstack/react-table";
import { getFilteredRowModel, getExpandedRowModel } from "@tanstack/react-table";
import { ColumnDef, Table as TanstackTable, Column as TanstackColumn, Cell as TanstackCell, Row as TanstackRow } from "@tanstack/react-table";

import { useSensors, useSensor, MouseSensor, TouchSensor, KeyboardSensor } from "@dnd-kit/core";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";

import { getCoreRowModel, handleDragCancel, handleDragEnd, handleDragMove, handleDragOver, handleDragStart } from "@/utils/evals/table";
import { Table, TableHeader, TableRow, TableBody, TableCell, TableFooter } from "@/components/UI/table";

import DataTableHeader from "./Content/Header";
import DataTableRow from "./Content/Row";

import { StateProps, SetStateProps } from "@/types/dataTable";
import { GroupedLogProps, LogProps } from "@/types/evals/logs";
import { useCellSelection } from "@/hooks/Logs/useCellSelection";
import { useTableGrouping } from "@/hooks/useTableGrouping";
import { RowExpandingProps } from "./Buttons/RowExpanding";

interface DataTableProps<TData extends LogProps | GroupedLogProps> {
    className?: string;
    interactive?: boolean;
    data: TData[];
    columns: ColumnDef<TData, unknown>[];
    state: StateProps;
    setState: SetStateProps;
    FooterCell?: (column: TanstackColumn<any | unknown>, resizeMap: {[x: string]: (event: unknown) => void;}, table: TanstackTable<any | unknown>) => ReactNode;
    ColumnFilters?: (column: TanstackColumn<any | unknown>) => ReactNode;
    ColumnCreate?: (previousColumn: string, setOpen: (open: boolean) => void) => ReactNode;
    ColumnUpdate?: (key: string) => ReactNode;
    AggregatedCell?: (cell: TanstackCell<any, unknown>, row: TanstackRow<any | unknown>) => ReactNode;
    ExtraCellContent?: (cell: TanstackCell<any, unknown>, isCellExpanded: (cell: TanstackCell<any, unknown>) => boolean, setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>) => ReactNode;
    ExtraComponents?: (table: TanstackTable<any | unknown>) => ReactNode;
    RowExpanding?: (props: RowExpandingProps) => ReactNode;
}

export default function DataTable<TData extends LogProps | GroupedLogProps>({
    className,
    interactive,
    data,
    columns,
    state,
    setState,
    FooterCell,
    ColumnFilters,
    ColumnCreate,
    ColumnUpdate,
    AggregatedCell,
    ExtraCellContent,
    ExtraComponents,
    RowExpanding,
}: DataTableProps<TData>) {
    // Internal state management
    const [isUpdatingLogs, setIsUpdatingLogs] = useState(false);
    const [expandingRowId, setExpandingRowId] = useState<string | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const setUpdatedState = (
        state: any, setterFunction: (x: any) => void, updater: Updater<any>
    ) => {
        const updated = typeof updater === "function" ? updater(state) : updater;

        if (JSON.stringify(updated) != JSON.stringify(state)) {
            setterFunction(updated);
        }
    };

    const { isGroupingUpdating, setIsGroupingUpdating } = useTableGrouping(
        state.grouping,
        setIsUpdatingLogs
    );

    // Effect to handle data updates
    useEffect(() => {
        setIsGroupingUpdating(false);
        setIsUpdatingLogs(false);
    }, [data]);

    // Init table
    const table = useReactTable({
        data,
        columns,
        state,
        autoResetExpanded: false,
        enableColumnResizing: true,
        columnResizeMode: "onChange",
        onColumnVisibilityChange: (updater: Updater<{ [k: string]: boolean }>) => setUpdatedState(
            state.columnVisibility, setState.setColumnVisibility, updater
        ),
        onColumnOrderChange: (updater: Updater<string[]>) => setUpdatedState(state.columnOrder, setState.setColumnOrder, updater),
        // onGroupingChange: (updater: Updater<GroupingState>) => setUpdatedState(state.grouping, setState.setGrouping, updater),
        onSortingChange: (updater: Updater<SortingState>) => setUpdatedState(state.sorting, setState.setSorting, updater),
        onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => setUpdatedState(
            state.columnFilters, setState.setColumnFilters, updater
        ),
        onColumnPinningChange: (updater: Updater<ColumnPinningState>) => setUpdatedState(state.columnPinning, setState.setColumnPinning, updater),
        onColumnSizingChange: setState.setColumnSizing,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        manualGrouping: true,
        manualSorting: true,
        getRowId(originalRow, index, parent) {
            return (originalRow as LogProps | GroupedLogProps).id.toString()
        },
        getSubRows(originalRow: TData, index: number): TData[] | undefined {
            if (!('subRows' in originalRow)) return undefined;
            
            const row = originalRow as GroupedLogProps;
            const subRows = row.subRows;
            return subRows as TData[];
        },
        meta: {
            createColumn: () => {
                // updateLogs(...).then(...)
                // window.location.reload();
        },
        }
    });

    // Set up drag-and-drop
    const sensors = useSensors(
        useSensor(MouseSensor, {}),
        useSensor(TouchSensor, {}),
        useSensor(KeyboardSensor, {})
    );

    const visibleColumns = table.getVisibleLeafColumns();
    const finalColumns = (
        visibleColumns.length > 1
            ? visibleColumns[0].id != "RowNumbering"
                ? [visibleColumns[1], visibleColumns[0], ...visibleColumns.slice(2)]
                : visibleColumns
            : visibleColumns
    );

    const resizeMap = table.getFlatHeaders().map(
        (header: Header<TData, unknown>) => ({[header.column.id]: header.getResizeHandler()})
    ).reduce((acc: { [key: string]: (event: unknown) => void }, curr: { [key: string]: (event: unknown) => void }) => ({...acc, ...curr}), {});

    const { isCellSelected, isRowSelected, isCellExpanded, setExpandedCells, ...cellSelection } = useCellSelection({
        table,
        selectedCells: state.selectedCells,
        setSelectedCells: setState.setSelectedCells
    });

    // Helper function to render skeleton rows
    const renderSkeletonRows = (count: number = 10) => (
        Array.from({ length: count }).map((_, rowIdx) => (
            <TableRow key={rowIdx} className="animate-pulse">
                {finalColumns.map((col, colIdx) => (
                    <TableCell key={colIdx} className="p-2">
                        <div className="h-4 bg-muted rounded" />
                    </TableCell>
                ))}
            </TableRow>
        ))
    );

    return (<div className="relative flex h-fit w-full gap-2">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToHorizontalAxis]}
                    onDragStart={(event) => handleDragStart(event, state.draggingColumns, setState.setDraggingColumns, table.getAllFlatColumns())}
                    onDragMove={(event) => handleDragMove(event, state.draggingColumns, setState.setDraggingColumns, table.getAllFlatColumns())}
                    onDragOver={(event) => handleDragOver(event, state.draggingColumns, setState.setDraggingColumns, table.getAllFlatColumns())}
                    onDragEnd={(event) => handleDragEnd(event, state.columnOrder, setState.setColumnOrder, state.grouping, setState.setGrouping, setState.setDraggingColumns, table.getAllFlatColumns())}
                    onDragCancel={(event) => handleDragCancel(setState.setDraggingColumns)}
                >
                    <Table className={`relative w-full ${className}`} style={{ width: table.getTotalSize() }}>
                        <TableHeader className="sticky top-0 z-20 bg-background" style={{ boxShadow: '0 -4px 4px -4px gray inset' }}>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    <SortableContext items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                                        {headerGroup.headers.map((header) => (
                                            <DataTableHeader
                                                key={header.id}
                                                interactive={interactive}
                                                data={data}
                                                header={header}
                                                table={table}
                                                isCellSelected={isCellSelected}
                                                cellSelection={cellSelection}
                                                resizeMap={resizeMap}
                                                columnVisibility={state.columnVisibility}
                                                setColumnVisibility={setState.setColumnVisibility}
                                                grouping={state.grouping}
                                                setGrouping={setState.setGrouping}
                                                ColumnFilters={ColumnFilters}
                                                ColumnCreate={ColumnCreate}
                                                ColumnUpdate={ColumnUpdate}
                                                context={state.context}
                                                setContext={setState.setContext}
                                                draggingColumns={state.draggingColumns}
                                                columnOrder={state.columnOrder}
                                                setColumnOrder={setState.setColumnOrder}
                                                columnPinning={state.columnPinning}
                                                pinningState={state.pinningState}
                                                setPinningState={setState.setPinningState}
                                            />
                                        ))}
                                    </SortableContext>
                                </TableRow>
                            ))}
                        </TableHeader>

                        <TableBody className="contents overflow-y-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
                            {isUpdatingLogs ? (
                                // Show skeletons for the entire table when updating logs globally
                                renderSkeletonRows(10)
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <>
                                        <DataTableRow
                                            key={row.id}
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
                                            selectedCells={state.selectedCells}
                                            resizeMap={resizeMap}
                                            draggingColumns={state.draggingColumns}
                                            isAnimating={isAnimating}
                                        />
                                        {/* Show skeletons under the expanding row */}
                                        {expandingRowId === row.id && 
                                         'groupCount' in row.original && 
                                         typeof row.original.groupCount === 'number' &&
                                         row.original.groupCount > 0 &&
                                         !row.original.isPopulated &&
                                         renderSkeletonRows(row.original.groupCount)}
                                    </>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={finalColumns.length} className="text-center">
                                        No entry found
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>

                        <TableFooter className="sticky bottom-0 z-20 bg-background border-t-2 border-foreground" style={{ boxShadow: '0 4px 4px -4px gray inset' }}>
                            <TableRow>
                                {isUpdatingLogs ? (
                                    finalColumns.map((_, idx) => (
                                        <TableCell key={idx} className="p-2">
                                            <div className="h-4 bg-muted rounded animate-pulse" />
                                        </TableCell>
                                    ))
                                ) : (
                                    finalColumns.map((column, index) => (
                                        <SortableContext key={index} items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                                            {FooterCell && FooterCell(column, resizeMap, table)}
                                        </SortableContext>
                                    ))
                                )}
                            </TableRow>
                        </TableFooter>
                    </Table>
                </DndContext>
                {ExtraComponents && ExtraComponents(table)}
    </div>);
}
