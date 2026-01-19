'use client';

import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Trash2, FileDown } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';
import { Skeleton } from '@/components/UI/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { ExtendedInterfaceData } from '@/utils/interfaces/interfaceSelector';

// Skeleton row component for loading state
export const SkeletonTableRow = () => (
  <tr className="border-b">
    <td className="p-4">
      <Skeleton className="h-4 w-16" />
    </td>
    <td className="p-4">
      <Skeleton className="h-4 w-24" />
    </td>
    {/* Tags column temporarily commented out */}
    {/* <td className="p-4">
      <div className="flex gap-1">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </td> */}
    <td className="p-4">
      <Skeleton className="h-3 w-16" />
    </td>
    <td className="p-4">
      <Skeleton className="h-3 w-16" />
    </td>
    <td className="p-4">
      <Skeleton className="h-6 w-6" />
    </td>
  </tr>
);

// Skeleton table component
export const SkeletonTable = () => (
  <div className="rounded-lg border bg-background">
    <div className="max-h-[500px] overflow-auto">
      <table className="w-full">
        <thead className="border-b">
          <tr>
            <th className="p-4 text-left">
              <Skeleton className="h-4 w-12" />
            </th>
            <th className="p-4 text-left">
              <Skeleton className="h-4 w-12" />
            </th>
            {/* Tags column temporarily commented out */}
            {/* <th className="p-4 text-left">
              <Skeleton className="h-4 w-12" />
            </th> */}
            <th className="p-4 text-left">
              <Skeleton className="h-4 w-14" />
            </th>
            <th className="p-4 text-left">
              <Skeleton className="h-4 w-14" />
            </th>
            <th className="p-4 text-left">
              <Skeleton className="h-4 w-8" />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonTableRow key={index} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

interface TableColumnProps {
  onInterfaceSelect: (interfaceName: string) => void;
  onDeleteInterface: (interfaceId: string, interfaceName: string) => void;
  onExportTemplate: (interfaceId: string, interfaceName: string) => void;
}

/**
 * Create table column definitions for the interface selector
 */
export function createInterfaceSelectorColumns({
  onInterfaceSelect,
  onDeleteInterface,
  onExportTemplate,
}: TableColumnProps): ColumnDef<ExtendedInterfaceData>[] {
  return [
    {
      accessorKey: 'id',
      header: 'ID',
      size: 100,
      cell: ({ row }) => {
        const fullId = row.getValue('id') as string;
        const truncatedId = fullId ? fullId.substring(0, 8) : '';
        return (
          <div
            className="text-caption cursor-pointer truncate rounded p-2 font-mono transition-colors"
            title={`Full ID: ${fullId}`}
            onClick={() => onInterfaceSelect(row.original.name)}
          >
            {truncatedId}
          </div>
        );
      },
    },
    {
      accessorKey: 'name',
      header: 'Name',
      size: 200,
      cell: ({ row }) => (
        <div
          className="text-strong cursor-pointer truncate rounded p-2 transition-colors"
          title={row.getValue('name')}
          onClick={() => onInterfaceSelect(row.original.name)}
        >
          {row.getValue('name')}
        </div>
      ),
    },
    // Tags column temporarily commented out
    // {
    //   accessorKey: "tags",
    //   header: "Tags",
    //   size: 200,
    //   cell: ({ row }) => {
    //     const tags = row.getValue("tags") as string[];
    //     return (
    //       <div
    //         className="flex gap-1 flex-wrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded transition-colors"
    //         onClick={() => onInterfaceSelect(row.original.name)}
    //       >
    //         {tags.slice(0, 2).map((tag, index) => (
    //           <Badge key={index} variant="secondary" className="text-xs">
    //             {tag}
    //           </Badge>
    //         ))}
    //         {tags.length > 2 && (
    //           <Badge variant="outline" className="text-xs">
    //             +{tags.length - 2}
    //           </Badge>
    //         )}
    //       </div>
    //     );
    //   },
    // },
    {
      accessorKey: 'createdAt',
      header: 'Created At',
      size: 120,
      cell: ({ row }) => {
        const date = row.getValue('createdAt') as string;
        return date ? (
          <div
            className="text-caption cursor-pointer rounded p-2 text-muted-foreground transition-colors"
            onClick={() => onInterfaceSelect(row.original.name)}
          >
            {new Date(date).toLocaleDateString()}
          </div>
        ) : null;
      },
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated At',
      size: 120,
      cell: ({ row }) => {
        const date = row.getValue('updatedAt') as string;
        return date ? (
          <div
            className="text-caption cursor-pointer rounded p-2 text-muted-foreground transition-colors"
            onClick={() => onInterfaceSelect(row.original.name)}
          >
            {new Date(date).toLocaleDateString()}
          </div>
        ) : null;
      },
    },
    {
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }) => {
        const iface = row.original;

        return (
          <div className="flex items-center gap-[0.15rem]">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportTemplate(iface.id || '', iface.name);
                    }}
                    className="h-8 px-2"
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export as template</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteInterface(iface.id || '', iface.name);
                    }}
                    className="h-8 px-2 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      },
    },
  ];
}
