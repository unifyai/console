'use client';

import * as React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { encodeColumnFilter } from '@/lib/logs/querySpec';
import { searchParamToFilters } from '@/lib/logs/filters';
import { sanitizeId } from '@/lib/logs/columns';

interface LogColumnFilterProps {
  column: string;
  dataType?: string;
  filters: string;
  onChange: (filters: string) => void;
}

function defaultFnForType(dataType?: string): string {
  if (dataType === 'int' || dataType === 'float') return '==';
  if (dataType === 'bool') return '==';
  return 'in';
}

export function LogColumnFilter({ column, dataType, filters, onChange }: LogColumnFilterProps) {
  const parsed = searchParamToFilters(filters || undefined, undefined);
  const columnFilters = parsed[column] ?? {};
  const activeFn = Object.keys(columnFilters)[0] ?? defaultFnForType(dataType);
  const rawValue = columnFilters[activeFn] ?? '';
  const activeValue =
    rawValue.startsWith('"') && rawValue.endsWith('"') ? rawValue.slice(1, -1) : rawValue;

  const [open, setOpen] = React.useState(false);
  const [fn, setFn] = React.useState(activeFn);
  const [value, setValue] = React.useState(activeValue);

  React.useEffect(() => {
    if (open) {
      setFn(activeFn);
      setValue(activeValue);
    }
  }, [open, activeFn, activeValue]);

  const hasFilter = Boolean(activeValue);
  const isNumeric = dataType === 'int' || dataType === 'float';

  const apply = () => {
    const trimmed = value.trim();
    const encoded =
      !trimmed || isNumeric || fn === 'isNone' || fn === 'exists'
        ? trimmed
        : `"${trimmed.replace(/"/g, '')}"`;
    onChange(encodeColumnFilter(filters, column, fn, encoded));
    setOpen(false);
  };

  const clear = () => {
    onChange(encodeColumnFilter(filters, column, fn, ''));
    setValue('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${hasFilter ? 'text-primary' : 'text-muted-foreground'}`}
          aria-label={`Filter ${sanitizeId(column)}`}
          data-testid={`log-grid-filter-${sanitizeId(column)}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Filter className="h-3 w-3" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 space-y-2 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-caption font-medium text-foreground">Filter {sanitizeId(column)}</div>
        <Select value={fn} onValueChange={setFn}>
          <SelectTrigger className="h-8" data-testid="log-grid-filter-fn">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {isNumeric ? (
              <>
                <SelectItem value="==">equals</SelectItem>
                <SelectItem value="!=">not equals</SelectItem>
                <SelectItem value=">">greater than</SelectItem>
                <SelectItem value="<">less than</SelectItem>
                <SelectItem value=">=">≥</SelectItem>
                <SelectItem value="<=">≤</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="in">contains</SelectItem>
                <SelectItem value="not in">does not contain</SelectItem>
                <SelectItem value="==">equals</SelectItem>
                <SelectItem value="!=">not equals</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
          className="h-8"
          data-testid="log-grid-filter-value"
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
          }}
        />
        <div className="flex justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1"
            onClick={clear}
            disabled={!hasFilter && !value}
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
