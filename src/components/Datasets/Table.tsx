"use client";

import React, { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/UI/table";
import { ScrollArea } from "@/components/UI/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/UI/sheet";
import { Separator } from "@/components/UI/separator";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";

const DatasetsTable = ({
  items,
  searchQuery,
}: {
  items: { [key: string]: string }[];
  searchQuery: string;
}) => {
  // State to manage the selected item and sheet visibility
  const [openSheet, setOpenSheet] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    [key: string]: string;
  } | null>(null);

  // Function to handle row click
  const handleRowClick = (item: { [key: string]: string }) => {
    setSelectedItem(item);
    setOpenSheet(true);
  };

  // Get columns dynamically from items
  const columns = useMemo<ColumnDef<{ [key: string]: string }>[]>(
    () =>
      (items.length ? Object.keys(items[0]) : []).map((key) => ({
        accessorKey: key,
        header: key,
      })),
    [items]
  );

  // Filter the items based on the search query (case-insensitive)
  const filteredItems = useMemo(() => {
    if (!searchQuery) {
      return items;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return items.filter((item) =>
      Object.values(item).some((value) =>
        value.toLowerCase().includes(lowerCaseQuery)
      )
    );
  }, [items, searchQuery]);

  // Initialize table
  const table = useReactTable({
    data: filteredItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // If you have sorting or other plugins, include them here
  });

  // Function to truncate text to a specified length
  const truncateText = (text: string, maxLength: number) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + "...";
    }
    return text;
  };

  return (
    <>
      <ScrollArea className="h-[75vh] w-full border rounded-md">
        <Table className="relative">
          <TableHeader className="sticky top-0 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="pt-2 pb-4">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => handleRowClick(row.original)}
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="truncate max-w-[150px]"
                    >
                      {truncateText(
                        flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        ) as string,
                        100
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Sheet Component for Detailed View */}
      {selectedItem && (
        <Sheet open={openSheet} onOpenChange={setOpenSheet}>
          <SheetContent
            side="right"
            className="flex flex-col sm:max-w-3xl w-full"
          >
            <SheetHeader>
              <SheetTitle>Entry Details</SheetTitle>
              <SheetDescription>
                Detailed information about the entry.
              </SheetDescription>
            </SheetHeader>
            <Separator />

            {/* Main content scrollable area */}
            <ScrollArea className="flex-1 px-6">
              <div className="py-4 space-y-4">
                <Accordion type="multiple">
                  {Object.entries(selectedItem).map(([key, value]) => (
                    <AccordionItem value={key} key={key}>
                      <div className="flex items-center justify-between">
                        <AccordionTrigger>
                          <strong>{key}</strong>
                        </AccordionTrigger>
                        {/* Copy Button */}
                        {value && (
                          <CopyButton
                            content={value}
                            copyMessage={`${key} copied to clipboard`}
                            tooltipContent={`Copy ${key}`}
                            className="h-5 w-5"
                          />
                        )}
                      </div>
                      <AccordionContent>
                        <p className="whitespace-pre-wrap">{value}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
};

export default DatasetsTable;