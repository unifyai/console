"use client";

import { useMemo, ReactNode, MouseEvent } from "react";

import { ColumnFiltersState, GroupingState, SortingState, Updater, useReactTable } from "@tanstack/react-table";
import { getCoreRowModel, getFilteredRowModel, getExpandedRowModel, getGroupedRowModel, getSortedRowModel } from "@tanstack/react-table";
import { ColumnDef, Table as TanstackTable, Column as TanstackColumn, Cell as TanstackCell, Row as TanstackRow } from "@tanstack/react-table";

import { useSensors, useSensor, MouseSensor, TouchSensor, KeyboardSensor } from "@dnd-kit/core";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";

import { handleDragEnd } from "@/utils/projects/table";
import { Table, TableHeader, TableRow, TableBody, TableCell, TableFooter } from "@/components/UI/table";

import DataTableHeader from "./Content/Header";
import DataTableCell from "./Content/Cell";

import { StateProps } from "@/types/dataTable";
import { SetStateProps } from "@/types/dataTable";
import { LogProps } from "@/types/projects/logs";

import { mergeCells } from "@/utils/projects/table";

export default function DataTable<TData, TValue>({ data, columns, state, setState, tableHotkeys, onRowClick, FooterCell, ColumnFilters, ExtraCellContent, AggregatedCell, ExtraComponents }: {
    data: TData[],
    columns: ColumnDef<TData, TValue>[],
    state: StateProps,
    setState: SetStateProps,
    tableHotkeys?: (table: TanstackTable<any | unknown>, logs: LogProps[] | undefined, setState: SetStateProps) => void
    onRowClick?: (table: TanstackTable<any | unknown>, row: TanstackRow<any | unknown>, event: MouseEvent<HTMLTableRowElement, globalThis.MouseEvent>) => void,
    FooterCell?: (column: TanstackColumn<any | unknown>) => ReactNode,
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
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        getGroupedRowModel: getGroupedRowModel(),
        getSortedRowModel: getSortedRowModel()
    });

    // Set up drag-and-drop
    const sensors = useSensors(
        useSensor(MouseSensor, {}),
        useSensor(TouchSensor, {}),
        useSensor(KeyboardSensor, {})
    );

    // Handle column resizing
    const columnSizeVars = useMemo(() => {
        const headers = table.getFlatHeaders();
        const colSizes: { [key: string]: number } = {};
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i]!;
            colSizes[`--header-${header.id}-size`] = header.getSize();
            colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
        }
        return colSizes;
    }, [table.getState().columnSizingInfo, table.getState().columnSizing]);


    if (tableHotkeys) tableHotkeys(table, data as LogProps[], setState);

    const visibleColumns = table.getVisibleLeafColumns();
    const finalColumns = (
        visibleColumns.length > 1
            ? visibleColumns[0].id != "RowNumbering"
                ? [visibleColumns[1], visibleColumns[0], ...visibleColumns.slice(2)]
                : visibleColumns
            : visibleColumns
    );

    return (<>
        <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={(event) => handleDragEnd(event, state.columnOrder, setState.setColumnOrder, state.grouping, setState.setGrouping, table.getAllFlatColumns())}
            sensors={sensors}
        >
            <Table className="sticky top-0 z-10 max-h-[90vh] w-full border-1" style={{ ...columnSizeVars }}>
                <TableHeader className="sticky -top-[6px] z-10 bg-background">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            <SortableContext items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                                {headerGroup.headers.map((header) =>
                                    <DataTableHeader
                                        key={header.id}
                                        header={header}
                                        ColumnFilters={ColumnFilters}
                                    />
                                )}
                            </SortableContext>
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        <>
                            {table.getRowModel().rows.map((row, index) => (
                                <TableRow
                                    key={row.id}
                                    className="cursor-pointer"
                                    onClick={(event) => onRowClick && onRowClick(table, row, event)}
                                >
                                    {row.getVisibleCells().map(cell => {
                                        return (
                                            <SortableContext key={cell.id} items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                                                <DataTableCell
                                                    cell={cell}
                                                    row={row}
                                                    state={state}
                                                    setState={setState}
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
                <TableFooter className="sticky -bottom-[1px] z-10 bg-background">
                    <TableRow>
                        {finalColumns.map((column, index) =>
                            <SortableContext key={index} items={state.columnOrder} strategy={horizontalListSortingStrategy}>
                                {FooterCell && FooterCell(column)}
                            </SortableContext>
                        )}
                    </TableRow>
                </TableFooter>
            </Table>
        </DndContext>
        {ExtraComponents && ExtraComponents(table)}
    </>);
}

/* TODO: Add back Pagination*/
