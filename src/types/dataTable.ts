import { Header as TanstackHeader, Table as TanstackTable, Cell as TanstackCell, Column as TanstackColumn, Row as TanstackRow, ColumnSort, ColumnPinningState } from "@tanstack/react-table";
import { SortingState, ColumnFiltersState, GroupingState } from "@tanstack/react-table";
import { Dispatch, SetStateAction, MouseEventHandler, ReactNode } from "react";

export interface StateProps {
    sorting: SortingState,
    pagination: {pageIndex: number, pageSize: number},
    columnVisibility: {[key:string]: boolean},
    columnOrder: string[],
    columnFilters: ColumnFiltersState,
    grouping: GroupingState ,
    [key: string]: any
}

export interface SetStateProps {
    setSorting: (sorting: ColumnSort[]) => void,
    setPagination: (pagination: { [key: string]: number; }) => void,
    setColumnVisibility: (columnVisibility: { [k: string]: boolean; }) => void,
    setColumnOrder: (columnOrder: string[]) => void,
    setColumnFilters: Dispatch<SetStateAction<ColumnFiltersState>>,
    setGrouping: (grouping: string[]) => void,
    setColumnPinning: (columnPinning: ColumnPinningState) => void
    [key:string]: Dispatch<SetStateAction<any>>
}

export interface DataTableCellProps {
    cell: TanstackCell<any, unknown>
    row: TanstackRow<any>
    state: StateProps
}

export interface DataTableRowProps {
    className?: string,
    onClick?: MouseEventHandler<HTMLTableRowElement> | undefined,
    children: ReactNode
}

export interface DataTableHeaderProps {
    header: TanstackHeader<any, unknown>,
    table: TanstackTable<any>,
    state: StateProps,
    setState: SetStateProps,
    [key: string]: any
}
