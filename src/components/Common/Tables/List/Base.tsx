'use client';

import { SortingState, Updater, useReactTable, flexRender } from '@tanstack/react-table';
import {
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
} from '@tanstack/react-table';
import { ColumnDef } from '@tanstack/react-table';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/UI/table';
import { StateProps, SetStateProps } from '@/types/listTable';
import { ScrollArea } from '@/components/UI/scroll-area';
import { setUpdatedState } from '@/utils/misc/table';

export default function ListTable<TData, TValue>({
  data,
  columns,
  state,
  setState,
}: {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  state: StateProps;
  setState: SetStateProps;
}) {
  // Init table
  const table = useReactTable({
    data,
    columns,
    state,
    onSortingChange: (updater: Updater<SortingState>) =>
      setUpdatedState(state.sorting, setState.setSorting, updater),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <ScrollArea className="border-1 w-full rounded-md bg-background">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header, index) => (
                <TableHead key={index} className="p-2">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell, index) => (
                  <TableCell key={cell.id} className="text-body-sm p-2">
                    {cell.getIsPlaceholder()
                      ? null
                      : flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-body-sm h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
