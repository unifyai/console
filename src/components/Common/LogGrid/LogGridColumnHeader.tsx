'use client';

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Check,
  EyeOff,
  Filter,
  GripVertical,
  Group,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Ungroup,
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
import { parseGrouping, toggleGroupingColumn } from '@/lib/logs/grouping';
import { columnHasFilter, LogColumnFilter } from './LogColumnFilter';

type LogGridColumnHeaderProps = {
  column: Column<any, unknown>;
  columnKey: string;
  fieldKey: string;
  dataType?: string;
  filters: string;
  onFiltersChange: (filters: string) => void;
  grouping: string;
  onGroupingChange: (grouping: string) => void;
  /**
   * Called when the column ⋯ menu closes so the parent can ignore the
   * click-through mouseDown on the header (`modal={false}` menus).
   */
  onMenuClose?: () => void;
  isDerived: boolean;
  /** System-owned / non-editable column — show a lock beside the label. */
  isLocked?: boolean;
  onEditDerived?: () => void;
  /** Rename a plain entry column (not derived). */
  onRenameColumn?: () => void;
  /** Delete a plain entry column (not derived). */
  onDeleteColumn?: () => void;
  reorderEnabled: boolean;
  onEnableReorder: () => void;
  onDisableReorder: () => void;
  onHideColumn: () => void;
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
  grouping,
  onGroupingChange,
  onMenuClose,
  isDerived,
  isLocked = false,
  onEditDerived,
  onRenameColumn,
  onDeleteColumn,
  reorderEnabled,
  onEnableReorder,
  onDisableReorder,
  onHideColumn,
}: LogGridColumnHeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const openFilterAfterMenuCloseRef = React.useRef(false);
  /** Parent Dialog/AlertDialog openers deferred until the menu has closed. */
  const pendingDialogActionRef = React.useRef<(() => void) | null>(null);
  const sorted = column.getIsSorted() as SortDirection | false;
  const hasFilter = columnHasFilter(filters, columnKey);
  const isGrouped = parseGrouping(grouping).includes(columnKey);

  const openFilter = () => {
    // Keep this set until the filter closes so the menu's delayed unmount
    // autofocus (exit animation) cannot land on the ⋯ trigger and dismiss the
    // newly opened popover via focus-outside.
    openFilterAfterMenuCloseRef.current = true;
    setMenuOpen(false);
    setFilterOpen(true);
  };

  const handleMenuOpenChange = (open: boolean) => {
    setMenuOpen(open);
    if (!open) {
      onMenuClose?.();
      const action = pendingDialogActionRef.current;
      if (action) {
        pendingDialogActionRef.current = null;
        // Wait past the pointer-up that selected the item — otherwise that same
        // event dismisses a Dialog opened on the next microtask.
        window.setTimeout(action, 50);
      }
    }
  };

  const queueParentDialog = (open: () => void) => {
    pendingDialogActionRef.current = open;
    handleMenuOpenChange(false);
  };

  React.useEffect(() => {
    if (!filterOpen) openFilterAfterMenuCloseRef.current = false;
  }, [filterOpen]);

  return (
    <div
      ref={headerRef}
      className="group/header relative flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden"
      data-testid={`log-grid-header-${fieldKey}`}
    >
      <div
        className="text-data-header -ml-1 flex h-7 min-w-0 flex-1 items-center gap-1 px-2"
        data-testid={`log-grid-label-${fieldKey}`}
      >
        <span className="truncate">{fieldKey}</span>
        {isLocked && (
          <span className="inline-flex shrink-0" data-testid={`log-grid-column-lock-${fieldKey}`}>
            <Lock className="h-2.5 w-2.5 text-muted-foreground" aria-label="Read-only column" />
          </span>
        )}
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
          anchorRef={headerRef}
        />
      </div>

      <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange} modal={false}>
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
        <DropdownMenuContent
          align="end"
          className="min-w-[11rem]"
          collisionPadding={16}
          onFocusOutside={(e) => {
            // modal={false} dismisses on any focusin outside the content. Prevent that so
            // only pointer-down outside (and Escape) close the menu.
            e.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            // Keep focus from jumping back into the header while the filter popover opens,
            // and avoid a focus restore that can re-target the header under modal={false}.
            e.preventDefault();
          }}
        >
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
                data-active={sorted === 'asc' ? 'true' : 'false'}
                onClick={() => {
                  column.toggleSorting(false);
                  setMenuOpen(false);
                }}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                Ascending
                {sorted === 'asc' ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-body-sm gap-2"
                data-testid={`log-grid-sort-desc-${fieldKey}`}
                data-active={sorted === 'desc' ? 'true' : 'false'}
                onClick={() => {
                  column.toggleSorting(true);
                  setMenuOpen(false);
                }}
              >
                <ArrowDown className="h-3.5 w-3.5" />
                Descending
                {sorted === 'desc' ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
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
                <Ban className="h-3.5 w-3.5" />
                Clear
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            className="text-body-sm gap-2"
            data-testid={`log-grid-filter-open-${fieldKey}`}
            onSelect={(event) => {
              // Prevent the menu from restoring focus into the header on close;
              // that focus move dismisses the filter popover as an outside click.
              event.preventDefault();
              openFilter();
            }}
          >
            <Filter className="h-3.5 w-3.5" />
            {hasFilter ? 'Edit filter' : 'Filter…'}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-body-sm gap-2"
            data-testid={`log-grid-group-by-${fieldKey}`}
            onSelect={(event) => {
              // preventDefault keeps Radix from restoring focus into the header; with
              // modal={false} that restore (or the following pointerup) hits the
              // header mouseDown and selects the whole column instead of ungrouping.
              event.preventDefault();
              onGroupingChange(toggleGroupingColumn(grouping, columnKey));
              setMenuOpen(false);
              onMenuClose?.();
            }}
          >
            {isGrouped ? <Ungroup className="h-3.5 w-3.5" /> : <Group className="h-3.5 w-3.5" />}
            {isGrouped ? 'Ungroup' : 'Group by'}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-body-sm gap-2"
            data-testid={`log-grid-hide-column-${fieldKey}`}
            onClick={() => {
              onHideColumn();
              setMenuOpen(false);
            }}
          >
            <EyeOff className="h-3.5 w-3.5" />
            Hide column
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
          {!isDerived && (onRenameColumn || onDeleteColumn) && (
            <>
              <DropdownMenuSeparator />
              {onRenameColumn && (
                <DropdownMenuItem
                  className="text-body-sm gap-2"
                  data-testid={`log-grid-rename-column-${fieldKey}`}
                  onSelect={(event) => {
                    event.preventDefault();
                    queueParentDialog(onRenameColumn);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename column
                </DropdownMenuItem>
              )}
              {onDeleteColumn && (
                <DropdownMenuItem
                  className="text-body-sm gap-2 text-destructive focus:text-destructive"
                  data-testid={`log-grid-delete-column-${fieldKey}`}
                  onSelect={(event) => {
                    event.preventDefault();
                    queueParentDialog(onDeleteColumn);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete column
                </DropdownMenuItem>
              )}
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
  /** Whole-column selection highlight (mirrors row-index `bg-primary`). */
  columnSelected?: boolean;
  onMouseDown?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
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
  columnSelected = false,
  onMouseDown,
  onDoubleClick,
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
        // Overflow stays on the inner label row so full-height column resizers
        // can extend past the header into the body without being clipped.
        'group relative h-8 whitespace-nowrap px-1 text-[11px]',
        columnSelected
          ? // Beat TableHead's default `bg-card` / muted text the same way
            // whole-row selection paints the index cell (`bg-primary`).
            'text-primary-foreground [&_*]:text-primary-foreground'
          : 'text-muted-foreground',
        className,
        isDragging && 'z-20 opacity-80'
      )}
      style={{
        ...style,
        // Inline primary fill so TableHead's default `bg-card` cannot win.
        backgroundColor: columnSelected ? 'var(--primary)' : style?.backgroundColor,
        color: columnSelected ? 'var(--primary-foreground)' : style?.color,
        transform: transformStyle,
        transition: isDragging ? 'width transform 0.2s ease-in-out' : undefined,
      }}
      data-reorder={reorderEnabled ? 'true' : undefined}
      data-column-selected={columnSelected ? 'true' : undefined}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
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
            onMouseDown={(e) => e.stopPropagation()}
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
