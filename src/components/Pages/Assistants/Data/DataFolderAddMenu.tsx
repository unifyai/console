'use client';

import { FolderPlus, Plus, Upload } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { cn } from '@/lib/utils';

export type DataFolderAddMenuProps = {
  folderLabel: string;
  onNewTable: () => void;
  onUpload: () => void;
  /** Path under Data/ for this nest (empty = Data root). */
  pathKey?: string;
  className?: string;
};

export function DataFolderAddMenu({
  folderLabel,
  onNewTable,
  onUpload,
  pathKey = '',
  className,
}: DataFolderAddMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            className
          )}
          aria-label={`Add in ${folderLabel}`}
          data-testid="data-folder-add"
          data-folder-path={pathKey}
          onClick={(e) => e.stopPropagation()}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onClick={onNewTable}
          data-testid="data-folder-add-new-table"
          className="gap-2"
        >
          <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
          New table
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onUpload} data-testid="data-folder-add-upload" className="gap-2">
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          Upload
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
