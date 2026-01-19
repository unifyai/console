'use client';

import { useEffect, useState } from 'react';
import { Column } from '@tanstack/react-table';
import { SortDesc, SortAsc, ArrowUpDown, LoaderCircle, X } from 'lucide-react';
import ActionButton from '@/components/Common/Buttons/Action';
import { DropdownMenuItem } from '@radix-ui/react-dropdown-menu';

type ColumnSortProps = {
  interactive?: boolean;
  column: Column<any | unknown>;
  data: any[];
  sortLoading: boolean;
  setSortLoading: (sortLoading: boolean) => void;
  setSortingDirection: (sortingDirection: 'asc' | 'desc' | false) => void;
  direction?: 'asc' | 'desc';
  renderMode: 'button' | 'menuItem';
};

const ColumnSort = ({
  interactive,
  column,
  data,
  sortLoading,
  setSortLoading,
  setSortingDirection,
  direction,
  renderMode,
}: ColumnSortProps) => {
  /* Display loader when data updates */
  const sorting = column.getIsSorted();
  const spinnerColor = sorting ? 'primary-foreground' : 'primary';
  useEffect(() => {
    setSortingDirection(sorting);
  }, [sorting, setSortingDirection]);

  /* Sorting menu item */
  const onMenuItemClick = () => {
    column.toggleSorting(direction === 'desc');
    setSortLoading(true);
  };
  const menuItem = (
    <DropdownMenuItem
      onClick={onMenuItemClick}
      className="text-body-sm flex cursor-pointer items-center gap-2"
    >
      {direction === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
      {direction === 'asc' ? <span>Sort ascending</span> : <span>Sort descending</span>}
    </DropdownMenuItem>
  );

  /* Toggle & clear sorting buttons */
  const tooltip = sorting
    ? sorting === 'asc'
      ? 'Switch to descending'
      : 'Switch to ascending'
    : 'Sort ascending';
  const icon = sortLoading ? (
    <LoaderCircle className={`animate-spin text-${spinnerColor}`} />
  ) : sorting === 'desc' ? (
    <SortDesc />
  ) : (
    <SortAsc />
  );

  const variant = sorting ? 'primary' : undefined;

  const handleToggle = () => {
    if (!sorting) {
      column.toggleSorting(false); // start with asc
    } else if (sorting === 'asc') {
      column.toggleSorting(true); // switch to desc
    } else if (sorting === 'desc') {
      column.toggleSorting(false); // switch back to asc
    }
    setSortLoading(true);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    column.clearSorting();
    setSortLoading(true);
  };

  const sortButton = (
    <div className="group relative inline-flex">
      <ActionButton
        tooltip={tooltip}
        icon={icon}
        variant={variant}
        onClick={handleToggle}
        disabled={!interactive || sortLoading}
      />
      {sorting && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-muted text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
        >
          <X className="h-2 w-2" />
        </button>
      )}
    </div>
  );

  return renderMode === 'menuItem' ? menuItem : sortButton;
};

export default ColumnSort;
