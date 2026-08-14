'use client';

import * as React from 'react';
import { Filter, Parentheses, Plus, X } from 'lucide-react';
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
import { searchParamToFilters, type FilterClause } from '@/lib/logs/filters';
import { sanitizeId } from '@/lib/logs/columns';
import type { FiltersByColumn } from '@/types/interfaces/columns';
import { cn } from '@/lib/utils';
import { isImeComposing } from '@/utils/keyboard';

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

type Clause = FilterClause;

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

function displayValue(raw: string): string {
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  return raw;
}

function parseClauses(column: string, filters: string, dataType?: string): Clause[] {
  const parsed = searchParamToFilters(filters || undefined, undefined);
  const columnFilters = parsed[column] ?? {};

  if (columnFilters.clauses) {
    const stored = JSON.parse(columnFilters.clauses) as FilterClause[];
    if (Array.isArray(stored) && stored.length > 0) {
      return stored.map((clause, index) => ({
        fn: clause.fn,
        value: displayValue(clause.value ?? ''),
        ...(index > 0
          ? { join: clause.join === 'or' ? 'or' : 'and', grouped: !!clause.grouped }
          : {}),
      }));
    }
  }

  const clauses = Object.entries(columnFilters)
    .filter(([fn]) => fn !== 'clauses' && fn !== 'expression')
    .map(([fn, value], index) => {
      const raw = value ?? '';
      return {
        fn,
        value: displayValue(raw),
        ...(index > 0 ? { join: 'and' as const, grouped: false } : {}),
      };
    });
  return clauses.length ? clauses : [{ fn: defaultFnForType(dataType), value: '' }];
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

/** Maximal spans where consecutive `grouped` joins share one parenthesized group. */
function clauseSpans(clauses: Clause[]): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  let i = 0;
  while (i < clauses.length) {
    let j = i;
    while (j + 1 < clauses.length && clauses[j + 1].grouped) j++;
    spans.push({ start: i, end: j });
    i = j + 1;
  }
  return spans;
}

export function columnHasFilter(filters: string, column: string): boolean {
  const columnFilters = searchParamToFilters(filters || undefined, undefined)[column] ?? {};
  if (columnFilters.clauses) {
    const stored = JSON.parse(columnFilters.clauses) as FilterClause[];
    return Array.isArray(stored) && stored.length > 0;
  }
  return Object.keys(columnFilters).length > 0;
}

/**
 * Column filter popover with type-aware operators, and/or joins, and adjacent clause grouping.
 * Persists as `col~clauses~JSON`; legacy `col~fn~value` bags still open as a flat and-joined list.
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
  const [clauses, setClauses] = React.useState<Clause[]>(() =>
    parseClauses(column, filters, dataType)
  );

  React.useEffect(() => {
    if (open) setClauses(parseClauses(column, filters, dataType));
  }, [open, column, filters, dataType]);

  const hasFilter = columnHasFilter(filters, column);
  const showIcon = showTrigger ?? hasFilter;
  const ops = opsForType(dataType);
  const isNumeric = dataType === 'int' || dataType === 'float';
  const spans = clauseSpans(clauses);

  const apply = () => {
    const without = stripColumn(filters, column);
    const valid = clauses.filter((clause) => !needsValue(clause.fn) || clause.value.trim());
    if (valid.length === 0) {
      onChange(without);
      setOpen(false);
      return;
    }
    const stored: FilterClause[] = valid.map((clause, index) => ({
      fn: clause.fn,
      value: encodeValue(clause.fn, clause.value, dataType),
      ...(index > 0
        ? { join: clause.join === 'or' ? 'or' : 'and', grouped: !!clause.grouped }
        : {}),
    }));
    const nextForCol: FiltersByColumn = {
      [column]: { clauses: JSON.stringify(stored) },
    };
    const encoded = encodeFiltersBag(nextForCol);
    onChange(without ? `${without}§${encoded}` : encoded);
    setOpen(false);
  };

  const clear = () => {
    onChange(stripColumn(filters, column));
    setClauses([{ fn: defaultFnForType(dataType), value: '' }]);
    setOpen(false);
  };

  const removeClause = (index: number) => {
    setClauses((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) return [{ fn: defaultFnForType(dataType), value: '' }];
      if (index === 0) {
        const first = next[0];
        next[0] = { fn: first.fn, value: first.value };
      }
      return next;
    });
  };

  const renderClauseCard = (clause: Clause, index: number) => (
    <div key={index} className="space-y-1.5 rounded-md border border-border bg-background p-2">
      <div className="flex items-center gap-1">
        <Select
          value={clause.fn}
          onValueChange={(fn) =>
            setClauses((prev) => prev.map((c, i) => (i === index ? { ...c, fn } : c)))
          }
        >
          <SelectTrigger
            className="h-8"
            data-testid={index === 0 ? 'log-grid-filter-fn' : `log-grid-filter-fn-${index}`}
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
            onClick={() => removeClause(index)}
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
          data-testid={index === 0 ? 'log-grid-filter-value' : `log-grid-filter-value-${index}`}
          onKeyDown={(e) => {
            if (isImeComposing(e)) return;
            if (e.key === 'Enter') apply();
          }}
        />
      )}
    </div>
  );

  const renderJoinControls = (index: number) => {
    const clause = clauses[index];
    const join = clause.join === 'or' ? 'or' : 'and';
    const grouped = !!clause.grouped;
    return (
      <div className="flex items-center justify-center gap-1 py-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-caption h-6 px-2 text-muted-foreground"
          data-testid={`log-grid-filter-join-${index}`}
          onClick={() =>
            setClauses((prev) =>
              prev.map((c, i) => (i === index ? { ...c, join: c.join === 'or' ? 'and' : 'or' } : c))
            )
          }
        >
          {join}
        </Button>
        <Button
          type="button"
          variant={grouped ? 'secondary' : 'ghost'}
          size="sm"
          className={cn('text-caption h-6 gap-1 px-2', grouped && 'text-foreground')}
          data-testid={`log-grid-filter-group-${index}`}
          aria-pressed={grouped}
          aria-label={grouped ? 'Ungroup from previous clause' : 'Group with previous clause'}
          onClick={() =>
            setClauses((prev) =>
              prev.map((c, i) => (i === index ? { ...c, grouped: !c.grouped } : c))
            )
          }
        >
          <Parentheses className="h-3 w-3" aria-hidden="true" />
          {grouped ? 'Ungroup' : 'Group'}
        </Button>
      </div>
    );
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
        className="z-[80] w-80 space-y-2 p-3"
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onFocusOutside={(e) => {
          // Non-modal popovers dismiss on any focusin outside. Closing the column
          // ⋯ menu restores focus to its trigger after the exit animation, which
          // would immediately dismiss a filter opened from that menu.
          e.preventDefault();
        }}
      >
        <div className="text-caption font-medium text-foreground">Filter {sanitizeId(column)}</div>
        {spans.map((span, spanIndex) => {
          const isGroupedSpan = span.end > span.start;
          const body = (
            <div className={cn('space-y-1', isGroupedSpan && 'pl-1')}>
              {Array.from({ length: span.end - span.start + 1 }, (_, offset) => {
                const index = span.start + offset;
                return (
                  <React.Fragment key={index}>
                    {offset > 0 && renderJoinControls(index)}
                    {renderClauseCard(clauses[index], index)}
                  </React.Fragment>
                );
              })}
            </div>
          );

          return (
            <React.Fragment key={`${span.start}-${span.end}`}>
              {span.start > 0 && renderJoinControls(span.start)}
              {isGroupedSpan ? (
                <div
                  className="bg-muted/30 space-y-1 rounded-md border border-border p-2"
                  data-testid={`log-grid-filter-span-${spanIndex}`}
                >
                  {body}
                </div>
              ) : (
                body
              )}
            </React.Fragment>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full gap-1"
          onClick={() =>
            setClauses((prev) => [
              ...prev,
              { fn: defaultFnForType(dataType), value: '', join: 'and', grouped: false },
            ])
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
