'use client';

import * as React from 'react';
import { Filter, Plus, X } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { searchParamToFilters } from '@/lib/logs/filters';
import { sanitizeId } from '@/lib/logs/columns';
import type { FiltersByColumn } from '@/types/interfaces/columns';

interface LogColumnFilterProps {
  column: string;
  dataType?: string;
  filters: string;
  onChange: (filters: string) => void;
  /** Controlled open so the column ⋯ menu can open the popover. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * When false, no header trigger is shown (popover opens via controlled `open`).
   * Defaults to true when the column already has an active filter.
   */
  showTrigger?: boolean;
  /**
   * Stable positioning target when the header filter icon is hidden.
   * Prefer the column header element so RHS-edge columns still get a real
   * bounding box (a zero-size placeholder anchors off-screen in narrow layouts).
   */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

type Clause = { fn: string; value: string };

function defaultFnForType(dataType?: string): string {
  if (dataType === 'int' || dataType === 'float') return '==';
  if (dataType === 'bool') return 'is';
  if (
    dataType === 'timestamp' ||
    dataType === 'time' ||
    dataType === 'date' ||
    dataType === 'timedelta'
  )
    return '>';
  if (dataType === 'image') return 'exists';
  return 'in';
}

function opsForType(dataType?: string): { value: string; label: string }[] {
  if (dataType === 'int' || dataType === 'float') {
    return [
      { value: '==', label: 'equals' },
      { value: '!=', label: 'not equals' },
      { value: '>', label: 'greater than' },
      { value: '<', label: 'less than' },
      { value: '>=', label: '≥' },
      { value: '<=', label: '≤' },
      { value: 'exists', label: 'exists' },
      { value: 'isNone', label: 'is none' },
    ];
  }
  if (dataType === 'bool') {
    return [
      { value: 'is', label: 'is' },
      { value: 'exists', label: 'exists' },
      { value: 'isNone', label: 'is none' },
    ];
  }
  if (
    dataType === 'timestamp' ||
    dataType === 'time' ||
    dataType === 'date' ||
    dataType === 'timedelta'
  ) {
    return [
      { value: '>', label: 'after' },
      { value: '<', label: 'before' },
      { value: 'exists', label: 'exists' },
      { value: 'isNone', label: 'is none' },
    ];
  }
  if (dataType === 'image') {
    return [
      { value: 'exists', label: 'exists' },
      { value: 'isNone', label: 'is none' },
    ];
  }
  if (dataType === 'list') {
    return [
      { value: 'in', label: 'contains' },
      { value: 'not in', label: 'does not contain' },
      { value: 'exists', label: 'exists' },
      { value: 'isNone', label: 'is none' },
    ];
  }
  return [
    { value: 'in', label: 'contains' },
    { value: 'not in', label: 'does not contain' },
    { value: '==', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: 'exists', label: 'exists' },
    { value: 'isNone', label: 'is none' },
  ];
}

function needsValue(fn: string): boolean {
  return fn !== 'exists' && fn !== 'isNone';
}

function encodeFiltersBag(columnFilters: FiltersByColumn): string {
  const parts: string[] = [];
  for (const [col, ops] of Object.entries(columnFilters)) {
    for (const [fn, value] of Object.entries(ops)) {
      if (value === undefined || value === null || value === '') continue;
      parts.push(`${col}~${fn}~${value}`);
    }
  }
  return parts.join('§');
}

function stripColumn(filters: string, column: string): string {
  if (!filters) return '';
  return filters
    .split('§')
    .filter((part) => {
      const [col] = part.split('~');
      return col !== column;
    })
    .join('§');
}

function parseClauses(column: string, filters: string): Clause[] {
  const parsed = searchParamToFilters(filters || undefined, undefined);
  const columnFilters = parsed[column] ?? {};
  const clauses = Object.entries(columnFilters).map(([fn, value]) => {
    const raw = value ?? '';
    const cleaned =
      raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw === 'true' ? 'true' : raw;
    return { fn, value: cleaned };
  });
  return clauses.length ? clauses : [{ fn: defaultFnForType(), value: '' }];
}

function encodeValue(fn: string, value: string, dataType?: string): string {
  if (!needsValue(fn)) return 'true';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (dataType === 'int' || dataType === 'float' || dataType === 'bool' || fn === 'is') {
    return trimmed;
  }
  if (
    dataType === 'timestamp' ||
    dataType === 'time' ||
    dataType === 'date' ||
    dataType === 'timedelta'
  ) {
    return trimmed.startsWith('"') ? trimmed : `"${trimmed.replace(/"/g, '')}"`;
  }
  return `"${trimmed.replace(/"/g, '')}"`;
}

export function columnHasFilter(filters: string, column: string): boolean {
  return (
    Object.keys(searchParamToFilters(filters || undefined, undefined)[column] ?? {}).length > 0
  );
}

/**
 * Column filter popover with type-aware operators, exists/isNone, and multi-clause filters.
 * Encodes the same `col~fn~value§…` bag Interfaces table tiles use.
 * The header trigger only shows when a filter is active; otherwise open via controlled state.
 */
export function LogColumnFilter({
  column,
  dataType,
  filters,
  onChange,
  open: openControlled,
  onOpenChange,
  showTrigger,
  anchorRef,
}: LogColumnFilterProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = openControlled ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [clauses, setClauses] = React.useState<Clause[]>(() => parseClauses(column, filters));

  React.useEffect(() => {
    if (open) setClauses(parseClauses(column, filters));
  }, [open, column, filters]);

  const hasFilter = columnHasFilter(filters, column);
  const showIcon = showTrigger ?? hasFilter;
  const ops = opsForType(dataType);
  const isNumeric = dataType === 'int' || dataType === 'float';

  const apply = () => {
    const without = stripColumn(filters, column);
    const nextForCol: FiltersByColumn = { [column]: {} };
    for (const clause of clauses) {
      if (needsValue(clause.fn) && !clause.value.trim()) continue;
      nextForCol[column][clause.fn] = encodeValue(clause.fn, clause.value, dataType);
    }
    if (Object.keys(nextForCol[column]).length === 0) {
      onChange(without);
    } else {
      const encoded = encodeFiltersBag(nextForCol);
      onChange(without ? `${without}§${encoded}` : encoded);
    }
    setOpen(false);
  };

  const clear = () => {
    onChange(stripColumn(filters, column));
    setClauses([{ fn: defaultFnForType(dataType), value: '' }]);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {showIcon ? (
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-primary"
            aria-label={`Filter ${sanitizeId(column)}`}
            data-testid={`log-grid-filter-${sanitizeId(column)}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Filter className="h-3 w-3" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
      ) : anchorRef ? (
        // Position against the real column header — not a zero-size placeholder —
        // so collision detection can keep the panel on-screen for RHS columns.
        <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />
      ) : (
        <PopoverAnchor asChild>
          <span className="inline-block h-6 w-px shrink-0" aria-hidden="true" />
        </PopoverAnchor>
      )}
      <PopoverContent
        align="start"
        side="bottom"
        collisionPadding={16}
        className="z-[80] w-72 space-y-2 p-3"
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="text-caption font-medium text-foreground">Filter {sanitizeId(column)}</div>
        {clauses.map((clause, index) => (
          <div key={index} className="space-y-1.5 rounded-md border border-border p-2">
            <div className="flex items-center gap-1">
              <Select
                value={clause.fn}
                onValueChange={(fn) =>
                  setClauses((prev) => prev.map((c, i) => (i === index ? { ...c, fn } : c)))
                }
              >
                <SelectTrigger
                  className="h-8"
                  data-testid={index === 0 ? 'log-grid-filter-fn' : undefined}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ops.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clauses.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setClauses((prev) => prev.filter((_, i) => i !== index))}
                  aria-label="Remove clause"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            {needsValue(clause.fn) && (
              <Input
                value={clause.value}
                onChange={(e) =>
                  setClauses((prev) =>
                    prev.map((c, i) => (i === index ? { ...c, value: e.target.value } : c))
                  )
                }
                placeholder={
                  dataType === 'bool'
                    ? 'true / false'
                    : isNumeric
                      ? 'Number'
                      : dataType === 'timestamp' || dataType === 'date'
                        ? 'ISO date or relative'
                        : 'Value'
                }
                className="h-8"
                data-testid={index === 0 ? 'log-grid-filter-value' : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') apply();
                }}
              />
            )}
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full gap-1"
          onClick={() =>
            setClauses((prev) => [...prev, { fn: defaultFnForType(dataType), value: '' }])
          }
          data-testid="log-grid-filter-add-clause"
        >
          <Plus className="h-3 w-3" />
          Add clause
        </Button>
        <div className="flex justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1"
            onClick={clear}
            disabled={!hasFilter && !clauses.some((c) => c.value)}
            data-testid="log-grid-filter-clear"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Clear
          </Button>
          <Button size="sm" className="h-8" onClick={apply} data-testid="log-grid-filter-apply">
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
