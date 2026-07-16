'use client';

import * as React from 'react';
import { Columns3 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Checkbox } from '@/components/UI/checkbox';
import { Input } from '@/components/UI/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { sanitizeId } from '@/lib/logs/columns';

interface LogColumnVisibilityProps {
  columns: string[];
  hiddenColumns: string[];
  onChange: (hiddenColumns: string[]) => void;
}

export function LogColumnVisibility({
  columns,
  hiddenColumns,
  onChange,
}: LogColumnVisibilityProps) {
  const hidden = new Set(hiddenColumns);
  const [search, setSearch] = React.useState('');

  const toggle = (id: string, visible: boolean) => {
    const next = new Set(hidden);
    if (visible) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return columns;
    return columns.filter((id) => sanitizeId(id).toLowerCase().includes(q));
  }, [columns, search]);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setSearch('');
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" data-testid="log-grid-columns">
          <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns…"
            className="h-8"
            data-testid="log-grid-columns-search"
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <DropdownMenuSeparator />
        {filtered.map((id) => {
          const label = sanitizeId(id);
          const isVisible = !hidden.has(id);
          return (
            <DropdownMenuCheckboxItem
              key={id}
              checked={isVisible}
              onCheckedChange={(checked) => toggle(id, checked === true)}
              onSelect={(e) => e.preventDefault()}
              data-testid={`log-grid-column-toggle-${label}`}
            >
              <span className="truncate font-mono text-[11px]">{label}</span>
            </DropdownMenuCheckboxItem>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-caption px-2 py-1.5 text-muted-foreground">No matching columns</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Compact checkbox list for denser toolbars (unused alternate). */
export function LogColumnVisibilityList({
  columns,
  hiddenColumns,
  onChange,
}: LogColumnVisibilityProps) {
  const hidden = new Set(hiddenColumns);
  return (
    <div className="flex flex-col gap-1.5" data-testid="log-grid-columns-list">
      {columns.map((id) => {
        const label = sanitizeId(id);
        const checked = !hidden.has(id);
        return (
          <label key={id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => {
                const next = new Set(hidden);
                if (value) next.delete(id);
                else next.add(id);
                onChange(Array.from(next));
              }}
            />
            <span className="font-mono text-[11px]">{label}</span>
          </label>
        );
      })}
    </div>
  );
}
