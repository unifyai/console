'use client';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { cn } from '@/lib/utils';

export type DataTableMenuProps = {
  tableLabel: string;
  onRename: () => void;
  onDelete: () => void;
  /** Path under Data/ for this table. */
  pathKey?: string;
  className?: string;
};

export function DataTableMenu({
  tableLabel,
  onRename,
  onDelete,
  pathKey = '',
  className,
}: DataTableMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100',
            className
          )}
          aria-label={`Actions for ${tableLabel}`}
          data-testid="data-table-menu"
          data-table-path={pathKey}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onRename} data-testid="data-table-menu-rename" className="gap-2">
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          data-testid="data-table-menu-delete"
          className="gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
