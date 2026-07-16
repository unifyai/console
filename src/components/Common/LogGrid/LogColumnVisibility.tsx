'use client';

import * as React from 'react';
import { Columns3 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Checkbox } from '@/components/UI/checkbox';
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

  const toggle = (id: string, visible: boolean) => {
    const next = new Set(hidden);
    if (visible) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" data-testid="log-grid-columns">
          <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((id) => {
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
        {columns.length === 0 && (
          <div className="text-caption px-2 py-1.5 text-muted-foreground">No columns</div>
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
