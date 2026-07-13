'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/UI/data-table';
import { DataTableColumnHeader } from '@/components/UI/data-table-column-header';
import { Button } from '@/components/UI/button';
import type { DataRow } from './dataTypes';

function displayCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function buildDataColumns(keys: string[]): ColumnDef<DataRow>[] {
  return keys.map((key) => ({
    id: key,
    accessorFn: (row) => row.entries[key],
    header: ({ column }) => <DataTableColumnHeader column={column} title={key} />,
    cell: ({ row }) => {
      const raw = row.getValue(key);
      const text = displayCellValue(raw);
      return (
        <span className="block truncate" title={text}>
          {text}
        </span>
      );
    },
  }));
}

interface DataLeafTableProps {
  rows: DataRow[];
  columns: string[];
  totalCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onRowSelect: (row: DataRow) => void;
}

export function DataLeafTable({
  rows,
  columns,
  totalCount,
  isLoading,
  isLoadingMore,
  onLoadMore,
  onRowSelect,
}: DataLeafTableProps) {
  const columnDefs = React.useMemo(() => buildDataColumns(columns), [columns]);
  const hasMore = rows.length < totalCount;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
      <DataTable
        columns={columnDefs}
        data={rows}
        isLoading={isLoading}
        emptyMessage="This table has no rows."
        testId="data-leaf-table"
        className="min-h-0 flex-1"
        compact
        onRowClick={onRowSelect}
      />
      {hasMore && !isLoading && (
        <div className="flex shrink-0 justify-center pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            data-testid="data-load-more"
          >
            {isLoadingMore ? 'Loading…' : `Load more (${totalCount - rows.length} remaining)`}
          </Button>
        </div>
      )}
    </div>
  );
}
