"use client";

import { useMemo, ReactNode, MouseEvent, JSX, Ref } from "react";

import { ColumnFiltersState, GroupingState, Header, SortingState, Updater, useReactTable } from "@tanstack/react-table";
import { getCoreRowModel, getFilteredRowModel, getExpandedRowModel, getGroupedRowModel, getSortedRowModel } from "@tanstack/react-table";
import { ColumnDef, Table as TanstackTable, Column as TanstackColumn, Cell as TanstackCell, Row as TanstackRow } from "@tanstack/react-table";

import { useSensors, useSensor, MouseSensor, TouchSensor, KeyboardSensor } from "@dnd-kit/core";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";

import { handleDragEnd } from "@/utils/evals/table";
import { Table, TableHeader, TableRow, TableBody, TableCell, TableFooter } from "@/components/UI/table";

import DataTableHeader from "./Content/Header";
import DataTableCell from "./Content/Cell";

import { StateProps } from "@/types/dataTable";
import { SetStateProps } from "@/types/dataTable";
import { LogProps } from "@/types/evals/logs";

import { useCellSelection } from "@/hooks/Logs/useCellSelection";

export default function DataTable<TData, TValue>({ data, columns, state, setState, TableTop, FooterCell, ColumnFilters, ExtraCellContent, AggregatedCell, ExtraComponents }: {
    data: TData[],
    columns: ColumnDef<TData, TValue>[],
    state: StateProps,
    setState: SetStateProps,
    TableTop?: JSX.Element,
    FooterCell?: (column: TanstackColumn<any | unknown>, resizeMap: {[x: string]: (event: unknown) => void;}) => ReactNode,
    ColumnFilters?: (column: TanstackColumn<any | unknown>) => ReactNode;
    AggregatedCell?: (cell: TanstackCell<any, unknown>, row: TanstackRow<any | unknown>) => ReactNode;
    ExtraCellContent?: (cell: TanstackCell<any, unknown>) => ReactNode;
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
        onColumnSizingChange: setState.setColumnSizing,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getGroupedRowModel: getGroupedRowModel(),
        getSortedRowModel: getSortedRowModel(),
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

    const resizeMap = table.getLeafHeaders().map(
        (header: Header<TData, unknown>) => ({[header.id]: header.getResizeHandler()})
    ).reduce((acc, curr) => ({...acc, ...curr}), {});

    const { isCellSelected, isRowSelected, ...cellSelection } = useCellSelection({table});

    return (<div className="flex flex-col gap-2 max-w-fit">
        {TableTop && TableTop}
        <div className="h-fit overflow-x-auto w-full">
        <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={(event) => handleDragEnd(event, state.columnOrder, setState.setColumnOrder, state.grouping, setState.setGrouping, table.getAllFlatColumns())}
            sensors={sensors}
        >
            <Table className="sticky top-0 z-10 max-h-[90vh] w-full" style={{ width: table.getTotalSize() }}>
                <TableHeader className="sticky -top-[6px] z-10 bg-background">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            <SortableContext items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                                {headerGroup.headers.map((header) => (
                                    <DataTableHeader
                                        key={header.id}
                                        header={header}
                                        cellSelection={cellSelection}
                                        table={table}
                                        columnVisibility={state.columnVisibility}
                                        setColumnVisibility={setState.setColumnVisibility}
                                        ColumnFilters={ColumnFilters}
                                    />
                                ))}
                            </SortableContext>
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
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
                                                    isCellSelected={isCellSelected}
                                                    cellSelection={cellSelection}
                                                    resizeMap={resizeMap}
                                                    ExtraCellContent={ExtraCellContent}
                                                    AggregatedCell={AggregatedCell}
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
                <TableFooter className="sticky -bottom-[1px] z-10 bg-background border-t-2 border-foreground">
                    <TableRow>
                        {finalColumns.map((column, index) =>
                            <SortableContext key={index} items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                                {FooterCell && FooterCell(column, resizeMap)}
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
