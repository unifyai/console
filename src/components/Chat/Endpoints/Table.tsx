"use client"


import { Updater, ColumnDef, SortingState, ColumnSort as SortProps, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/UI/table"
import { Endpoint } from "@/types/chat/endpoints"
import { Options } from "nuqs";
import EndpointsTableHeader from "./Header";
import EndpointsTableCell from "./Cell";
import { setUpdatedState } from "@/utils/misc/table";
import { ScrollArea } from "@/components/UI/scroll-area";

const EndpointsTableContent = ({data, columns, sorting, setSorting, excludedProviders, setProviderFilterParam, selectedEndpoints, setSelectedEndpointsParam}:{
    data: Endpoint[], 
    columns: ColumnDef<Endpoint>[]
    sorting: SortProps[], 
    setSorting: (sorting: SortProps[]) => void,
    excludedProviders: string[],
    setProviderFilterParam: (value: string | ((old: string | null) => string | null) | null, options?: Options) => Promise<URLSearchParams>,
    selectedEndpoints: string[], 
    setSelectedEndpointsParam: (value: string | ((old: string | null) => string | null) | null, options?: Options) => Promise<URLSearchParams>
}) => {
    
    const table = useReactTable({
        data,
        columns,
        onSortingChange: (updater: Updater<SortingState>) => setUpdatedState(sorting, setSorting, updater),
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            pagination: {
                pageIndex: 0,
                pageSize: data.length,
            },
        },
    })

    return (
    <ScrollArea className="border-1 rounded-md bg-background">
        <Table>
            <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, index) => {
                        return <EndpointsTableHeader key={index} data={data} excludedProviders={excludedProviders} header={header} selectedEndpoints={selectedEndpoints} setProviderFilterParam={setProviderFilterParam} setSelectedEndpointsParam={setSelectedEndpointsParam}/>
                    })}
                </TableRow>
                ))}
            </TableHeader>
            <TableBody>
                {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.filter(row => !excludedProviders.includes(row.original.provider)).map((row) => (
                        <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell, index) => {
                                return <EndpointsTableCell key={index} cell={cell} row={row} selectedEndpoints={selectedEndpoints} setSelectedEndpointsParam={setSelectedEndpointsParam}/>
                            })}
                        </TableRow>
                    ))
                ) : (
                <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                        No results.
                    </TableCell>
                </TableRow>
                )}
            </TableBody>
        </Table>
    </ScrollArea>
    )
}

export default EndpointsTableContent;
