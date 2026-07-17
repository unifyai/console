'use client';

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter,
  GripVertical,
  MoreHorizontal,
  Pencil,
} from 'lucide-react';
import type { Column, Header, SortDirection } from '@tanstack/react-table';
import { Button } from '@/components/UI/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { TableHead } from '@/components/UI/table';
import { cn } from '@/lib/utils';
import { sanitizeId } from '@/lib/logs/columns';
import { columnHasFilter, LogColumnFilter } from './LogColumnFilter';

type LogGridColumnHeaderProps = {
  column: Column<any, unknown>;
  columnKey: string;
  fieldKey: string;
  dataType?: string;
  filters: string;
  onFiltersChange: (filters: string) => void;
  isDerived: boolean;
  onEditDerived?: () => void;
  reorderEnabled: boolean;
  onEnableReorder: () => void;
  onDisableReorder: () => void;
};

/**
 * Clean column header: label with active sort/filter indicators; hover ⋯ opens
 * sort/filter/reorder/derived actions. Drag listeners are attached by the
 * parent SortableHeader when reorder is enabled.
 */
export function LogGridColumnHeader({
  column,
  columnKey,
  fieldKey,
  dataType,
  filters,
  onFiltersChange,
  isDerived,
  onEditDerived,
  reorderEnabled,
  onEnableReorder,
  onDisableReorder,
}: LogGridColumnHeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const sorted = column.getIsSorted() as SortDirection | false;
  const hasFilter = columnHasFilter(filters, columnKey);

  const openFilter = () => {
    setMenuOpen(false);
    window.setTimeout(() => setFilterOpen(true), 0);
  };

  return (
    <div
      className="group/header relative flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden"
      data-testid={`log-grid-header-${fieldKey}`}
    >
      <div
        className="-ml-1 flex h-7 min-w-0 flex-1 items-center gap-1 px-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        data-testid={`log-grid-label-${fieldKey}`}
      >
        <span className="truncate">{fieldKey}</span>
        {sorted === 'asc' && (
          <ArrowUp className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
        )}
        {sorted === 'desc' && (
          <ArrowDown className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
        )}
      </div>

      <div className="relative flex shrink-0 items-center">
        <LogColumnFilter
          column={columnKey}
          dataType={dataType}
          filters={filters}
          onChange={onFiltersChange}
          open={filterOpen}
          onOpenChange={setFilterOpen}
          showTrigger={hasFilter}
        />
      </div>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 w-6 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover/header:opacity-100 data-[state=open]:opacity-100',
              menuOpen && 'opacity-100'
            )}
            aria-label={`Column options for ${fieldKey}`}
            data-testid={`log-grid-column-menu-${fieldKey}`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[11rem]">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className="text-body-sm gap-2"
              data-testid={`log-grid-sort-menu-${fieldKey}`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[9rem]">
              <DropdownMenuItem
                className="text-body-sm gap-2"
                data-testid={`log-grid-sort-asc-${fieldKey}`}
                onClick={() => {
                  column.toggleSorting(false);
                  setMenuOpen(false);
                }}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                Ascending
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-body-sm gap-2"
                data-testid={`log-grid-sort-desc-${fieldKey}`}
                onClick={() => {
                  column.toggleSorting(true);
                  setMenuOpen(false);
                }}
              >
                <ArrowDown className="h-3.5 w-3.5" />
                Descending
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-body-sm gap-2"
                data-testid={`log-grid-sort-clear-${fieldKey}`}
                disabled={!sorted}
                onClick={() => {
                  column.clearSorting();
                  setMenuOpen(false);
                }}
              >
                Clear
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            className="text-body-sm gap-2"
            data-testid={`log-grid-filter-open-${fieldKey}`}
            onClick={openFilter}
          >
            <Filter className="h-3.5 w-3.5" />
            {hasFilter ? 'Edit filter' : 'Filter…'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {reorderEnabled ? (
            <DropdownMenuItem
              className="text-body-sm gap-2"
              data-testid={`log-grid-drag-done-${fieldKey}`}
              onClick={() => {
                onDisableReorder();
                setMenuOpen(false);
              }}
            >
              <GripVertical className="h-3.5 w-3.5" />
              Done reordering
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-body-sm gap-2"
              data-testid={`log-grid-drag-enable-${fieldKey}`}
              onClick={() => {
                onEnableReorder();
                setMenuOpen(false);
              }}
            >
              <GripVertical className="h-3.5 w-3.5" />
              Enable column reorder
            </DropdownMenuItem>
          )}
          {isDerived && onEditDerived && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-body-sm gap-2"
                data-testid={`log-grid-derived-edit-${fieldKey}`}
                onClick={() => {
                  onEditDerived();
                  setMenuOpen(false);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit derived column
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type SortableHeaderProps = {
  header: Header<any, unknown>;
  children: React.ReactNode;
  resizer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  reorderEnabled: boolean;
  dragAttributes?: React.HTMLAttributes<HTMLElement>;
  dragListeners?: React.HTMLAttributes<HTMLElement>;
  setNodeRef?: (node: HTMLElement | null) => void;
  isDragging?: boolean;
  transformStyle?: string;
};

/** Table head shell: left-side grip when column reorder mode is on. */
export function LogGridSortableHead({
  header,
  children,
  resizer,
  className,
  style,
  reorderEnabled,
  dragAttributes,
  dragListeners,
  setNodeRef,
  isDragging,
  transformStyle,
}: SortableHeaderProps) {
  return (
    <TableHead
      ref={setNodeRef}
      className={cn(
        'group relative h-8 overflow-hidden whitespace-nowrap px-1 text-[11px] text-muted-foreground',
        className,
        isDragging && 'z-20 opacity-80'
      )}
      style={{
        ...style,
        transform: transformStyle,
        transition: isDragging ? 'width transform 0.2s ease-in-out' : undefined,
      }}
      data-reorder={reorderEnabled ? 'true' : undefined}
    >
      <div className="flex min-w-0 items-center gap-0.5 overflow-hidden">
        {reorderEnabled && (
          <button
            type="button"
            className="relative z-[1] flex h-6 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
            aria-label={`Drag to reorder ${sanitizeId(header.column.id)}`}
            data-testid={`log-grid-drag-${sanitizeId(header.column.id)}`}
            {...dragAttributes}
            {...dragListeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="pointer-events-none h-3 w-3 shrink-0" aria-hidden="true" />
          </button>
        )}
        <div className="relative z-[2] flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
          {children}
        </div>
      </div>
      {resizer}
    </TableHead>
  );
}
