'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { TableCell, TableRow } from '@/components/UI/table';
import { fetchLogs } from '@/lib/logs/fetch';
import { appendGroupValueFilter } from '@/lib/logs/grouping';
import { sanitizeId } from '@/lib/logs/columns';
import { makeCellId, type LogFieldsResponseProps, type LogGridRow } from '@/lib/logs';
import type { GroupedLogProps } from '@/types/interfaces/logs';
import { LogCellValue } from './LogCellValue';
import { cn } from '@/lib/utils';

interface LogGroupRowsProps {
  groups: GroupedLogProps[];
  columns: string[];
  fields: LogFieldsResponseProps;
  projectName: string;
  context: string;
  baseFilterExpr?: string | null;
  selectedCells: Set<string> | null;
  onSelectCell: (cellId: string, additive: boolean) => void;
  pageLimit: number;
  onChildrenChange?: (rows: LogGridRow[]) => void;
}

export function LogGroupRows({
  groups,
  columns,
  fields,
  projectName,
  context,
  baseFilterExpr,
  selectedCells,
  onSelectCell,
  pageLimit,
  onChildrenChange,
}: LogGroupRowsProps) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [children, setChildren] = React.useState<Record<string, LogGridRow[]>>({});
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [offsets, setOffsets] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    onChildrenChange?.(Object.values(children).flat());
  }, [children, onChildrenChange]);

  const loadChildren = async (group: GroupedLogProps, append: boolean) => {
    const colId = group.groupingColumnId;
    const value = group[colId];
    const meta = fields[colId] ?? fields[sanitizeId(colId)];
    const filterExpr = appendGroupValueFilter(baseFilterExpr, colId, value, meta?.dataType);
    const offset = append ? (offsets[group.id] ?? children[group.id]?.length ?? 0) : 0;
    setLoadingId(group.id);
    const page = await fetchLogs({
      projectName,
      context,
      filterExpr,
      sorting: null,
      groupBy: null,
      groupSorting: null,
      limit: pageLimit,
      offset,
    });
    setLoadingId(null);
    setChildren((prev) => ({
      ...prev,
      [group.id]: append ? [...(prev[group.id] ?? []), ...page.rows] : page.rows,
    }));
    setOffsets((prev) => ({
      ...prev,
      [group.id]: offset + page.rows.length,
    }));
  };

  const toggle = (group: GroupedLogProps) => {
    const next = !expanded[group.id];
    setExpanded((prev) => ({ ...prev, [group.id]: next }));
    if (next && !children[group.id]) void loadChildren(group, false);
  };

  return (
    <>
      {groups.map((group) => {
        const colId = group.groupingColumnId;
        const value = group[colId];
        const isOpen = !!expanded[group.id];
        const rows = children[group.id] ?? [];
        const total = group.groupCount ?? group.totalChildren ?? rows.length;
        const canLoadMore = rows.length < total;
        return (
          <React.Fragment key={group.id}>
            <TableRow
              className="bg-muted/30"
              data-testid={`log-grid-group-${sanitizeId(colId)}-${String(value)}`}
            >
              <TableCell colSpan={columns.length} className="px-2.5 py-1.5">
                <button
                  type="button"
                  className="flex items-center gap-2 text-left text-sm text-foreground"
                  onClick={() => toggle(group)}
                  data-testid={`log-grid-group-toggle-${sanitizeId(String(value))}`}
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  <span className="font-mono text-[11px] uppercase text-muted-foreground">
                    {sanitizeId(colId)}
                  </span>
                  <span className="font-medium">{String(value ?? '—')}</span>
                  <span className="text-caption text-muted-foreground">
                    {total.toLocaleString()} rows
                  </span>
                  {loadingId === group.id && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                </button>
              </TableCell>
            </TableRow>
            {isOpen &&
              rows.map((row) => (
                <TableRow key={row.logId} data-testid={`log-grid-row-${row.logId}`}>
                  {columns.map((key) => {
                    const fieldKey = sanitizeId(key);
                    const cellId = makeCellId(row.logId, key);
                    const cellSelected = selectedCells?.has(cellId);
                    const raw = row.entries[fieldKey] ?? row.entries[key];
                    return (
                      <TableCell
                        key={key}
                        data-testid={`log-grid-cell-${cellId}`}
                        className={cn(
                          'max-w-[220px] truncate px-2.5 py-1.5 font-mono text-[12px]',
                          cellSelected && 'bg-primary-tint-10 ring-1 ring-inset ring-primary'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCell(cellId, e.metaKey || e.ctrlKey);
                        }}
                      >
                        <LogCellValue value={raw} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            {isOpen && canLoadMore && (
              <TableRow>
                <TableCell colSpan={columns.length} className="px-2.5 py-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={loadingId === group.id}
                    onClick={() => void loadChildren(group, true)}
                    data-testid={`log-grid-group-load-more-${sanitizeId(String(value))}`}
                  >
                    Load more
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}
