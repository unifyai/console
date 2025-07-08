"use client";

import { Updater, ColumnDef, SortingState, ColumnSort, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/UI/table";
import { Endpoint } from "@/types/chat/endpoints";
import EndpointsTableHeader from "./Header";
import EndpointsTableCell from "./Cell";
import { ScrollArea } from "@/components/UI/scroll-area";

const EndpointsTableContent = ({ data, columns, sorting, setSorting, selectedEndpoints, setSelectedEndpoints }: {
    data: Endpoint[], 
    columns: ColumnDef<Endpoint>[],
    sorting: ColumnSort[], 
    setSorting: (sorting: ColumnSort[]) => void,
    selectedEndpoints: Endpoint[],
    setSelectedEndpoints: React.Dispatch<React.SetStateAction<Endpoint[]>>
}) => {
    const table = useReactTable({
        data,
        columns,
        onSortingChange: (updater: Updater<SortingState>) => {
            setSorting(typeof updater === "function" ? updater(sorting) : updater);
        },
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
    });

    return (
        <ScrollArea className="border-1 rounded-md bg-background">
            <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                    {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header, index) => (
                            <EndpointsTableHeader 
                                key={index} 
                                header={header} 
                                selectedEndpoints={selectedEndpoints}
                                setSelectedEndpoints={setSelectedEndpoints}
                                data={data}
                            />
                        ))}
                    </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id}>
                                {row.getVisibleCells().map((cell, index) => (
                                    <EndpointsTableCell 
                                        key={index} 
                                        cell={cell} 
                                        row={row} 
                                        selectedEndpoints={selectedEndpoints}
                                        setSelectedEndpoints={setSelectedEndpoints}
                                    />
                                ))}
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
    );
};

export default EndpointsTableContent;