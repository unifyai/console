'use client';

import type { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}

/**
 * Sortable column header for shadcn-style data tables. Uses design tokens
 * (mono uppercase labels) so tables match the rest of the Console brand.
 */
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={cn('text-data-header', className)}>{title}</span>;
  }

  return (
    <div className={cn('flex items-center', className)}>
      <Button
        variant="ghost"
        size="sm"
        className="text-data-header -ml-2 h-7 px-2 hover:bg-muted hover:text-foreground data-[state=open]:bg-muted"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        <span>{title}</span>
        {column.getIsSorted() === 'desc' ? (
          <ArrowDown className="ml-1 h-3 w-3" />
        ) : column.getIsSorted() === 'asc' ? (
          <ArrowUp className="ml-1 h-3 w-3" />
        ) : (
          <ChevronsUpDown className="ml-1 h-3 w-3 opacity-60" />
        )}
      </Button>
    </div>
  );
}
