"use client";

import { useMemo, ReactNode, MouseEvent, JSX, Ref, Dispatch, SetStateAction, useState } from "react";

import { ColumnFiltersState, ColumnPinningState, GroupingState, Header, SortingState, Updater, useReactTable } from "@tanstack/react-table";
import { getCoreRowModel, getFilteredRowModel, getExpandedRowModel, getGroupedRowModel, getSortedRowModel } from "@tanstack/react-table";
import { ColumnDef, Table as TanstackTable, Column as TanstackColumn, Cell as TanstackCell, Row as TanstackRow } from "@tanstack/react-table";

import { useSensors, useSensor, MouseSensor, TouchSensor, KeyboardSensor } from "@dnd-kit/core";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";

import { handleDragCancel, handleDragEnd, handleDragMove, handleDragOver, handleDragStart } from "@/utils/evals/table";
import { Table, TableHeader, TableRow, TableBody, TableCell, TableFooter } from "@/components/UI/table";

import DataTableHeader from "./Content/Header";
import DataTableCell from "./Content/Cell";

import { StateProps } from "@/types/dataTable";
import { SetStateProps } from "@/types/dataTable";
import { LogProps } from "@/types/evals/logs";
import { useCellSelection } from "@/hooks/Logs/useCellSelection";

export default function DataTable<TData, TValue>({ className, interactive, data, columns, state, setState, TableTop, FooterCell, ColumnCreate, ColumnFilters, ExtraCellContent, AggregatedCell, ExtraComponents }: {
    className?: string,
    interactive?: boolean,
    data: TData[],
    columns: ColumnDef<TData, TValue>[],
    state: StateProps,
    setState: SetStateProps,
    TableTop?: JSX.Element,
    FooterCell?: (column: TanstackColumn<any | unknown>, resizeMap: {[x: string]: (event: unknown) => void;}, table: TanstackTable<any | unknown>) => ReactNode,
    ColumnFilters?: (column: TanstackColumn<any | unknown>) => ReactNode;
    ColumnCreate?: ReactNode;
    AggregatedCell?: (cell: TanstackCell<any, unknown>, row: TanstackRow<any | unknown>) => ReactNode;
    ExtraCellContent?: (cell: TanstackCell<any, unknown>, isCellExpanded: (cell: TanstackCell<any, unknown>) => boolean, setExpandedCells: Dispatch<SetStateAction<{[k: string]: boolean}>>) => ReactNode;
    ExtraComponents?: (table: TanstackTable<any | unknown>) => ReactNode
}) {

    const setUpdatedState = (
        state: any, setterFunction: (x: any) => void, updater: Updater<any>
    ) => {
        if (typeof updater === "function") {
            const updated = updater(state);
            if (JSON.stringify(updated) != JSON.stringify(state))
                setterFunction(updated);
        }
    };

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
        onGroupingChange: (updater: Updater<GroupingState>) => setUpdatedState(state.grouping, setState.setGrouping, updater),
        onSortingChange: (updater: Updater<SortingState>) => setUpdatedState(state.sorting, setState.setSorting, updater),
        onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => setUpdatedState(
            state.columnFilters, setState.setColumnFilters, updater
        ),
        onColumnPinningChange: (updater: Updater<ColumnPinningState>) => setUpdatedState(state.columnPinning, setState.setColumnPinning, updater),
        onColumnSizingChange: setState.setColumnSizing,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getGroupedRowModel: getGroupedRowModel(),
        manualSorting: true,
        getRowId(originalRow, index, parent) {
            return (originalRow as LogProps).id.toString()
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

    return (<div className="flex flex-col gap-2">
        {TableTop && TableTop}
        <div className="h-fit w-full">
        <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragStart={(event) => handleDragStart(event, state.draggingColumns, setState.setDraggingColumns, table.getAllFlatColumns())}
            onDragMove={(event) => handleDragMove(event, state.draggingColumns, setState.setDraggingColumns, table.getAllFlatColumns())}
            onDragOver={(event) => handleDragOver(event, state.draggingColumns, setState.setDraggingColumns, table.getAllFlatColumns())}
            onDragEnd={(event) => handleDragEnd(event, state.columnOrder, setState.setColumnOrder, state.grouping, setState.setGrouping, setState.setDraggingColumns, table.getAllFlatColumns())}
            onDragCancel={(event) => handleDragCancel(setState.setDraggingColumns)}
            sensors={sensors}
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
                                        header={header}
                                        isCellSelected={isCellSelected}
                                        cellSelection={cellSelection}
                                        resizeMap={resizeMap}
                                        table={table}
                                        columnVisibility={state.columnVisibility}
                                        setColumnVisibility={setState.setColumnVisibility}
                                        grouping={state.grouping}
                                        setGrouping={setState.setGrouping}
                                        ColumnFilters={ColumnFilters}
                                        ColumnCreate={ColumnCreate}
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
                    {table.getRowModel().rows?.length ? (
                        <>
                            {table.getRowModel().rows.map((row, index) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map(cell => {
                                        return (
                                            <SortableContext key={cell.id} items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                                                <DataTableCell
                                                    cell={cell}
                                                    row={row}
                                                    selectedCells={state.selectedCells}
                                                    isCellSelected={isCellSelected}
                                                    cellSelection={cellSelection}
                                                    resizeMap={resizeMap}
                                                    ExtraCellContent={ExtraCellContent}
                                                    AggregatedCell={AggregatedCell}
                                                    isCellExpanded={isCellExpanded}
                                                    setExpandedCells={setExpandedCells}
                                                    draggingColumns={state.draggingColumns}
                                                />
                                            </SortableContext>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </>
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
                        {finalColumns.map((column, index) =>
                            <SortableContext key={index} items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                                {FooterCell && FooterCell(column, resizeMap, table)}
                            </SortableContext>
                        )}
                    </TableRow>
                </TableFooter>
            </Table>
        </DndContext>
        {ExtraComponents && ExtraComponents(table)}
        </div>
    </div>);
}
