'use client';

import * as React from 'react';
import { Check, ListFilter } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';

export interface TabFilterGroup {
  /** Stable group id used to namespace each value key (`${id}:${value}`). */
  id: string;
  label: string;
  values: string[];
}

export interface TabFilterDropdownProps {
  groups: TabFilterGroup[];
  /** Selected keys in `${groupId}:${value}` form. */
  selected: Set<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
  triggerTestId?: string;
  clearTestId?: string;
}

/**
 * Collapses per-tab filtering (tags, scopes, kinds, …) behind a single Filter
 * button with an active-count badge, matching the design's `FilterControl`.
 * Values are namespaced as `${groupId}:${value}` so a flat `Set` can carry
 * selections across multiple groups.
 */
export function TabFilterDropdown({
  groups,
  selected,
  onToggle,
  onClear,
  triggerTestId,
  clearTestId,
}: TabFilterDropdownProps) {
  const renderable = groups.filter((g) => g.values.length > 0);
  if (renderable.length === 0) return null;

  const count = selected.size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1.5"
          data-testid={triggerTestId}
        >
          <ListFilter className="h-3.5 w-3.5" />
          Filter
          {count > 0 && (
            <span className="ml-0.5 rounded-full bg-primary-tint-15 px-1.5 text-[10px] font-semibold text-primary">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        {renderable.map((group, index) => (
          <div key={group.id} className={index < renderable.length - 1 ? 'mb-2' : undefined}>
            <div className="text-overline px-1 pb-1">{group.label}</div>
            {group.values.map((value) => {
              const key = `${group.id}:${value}`;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggle(key)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs capitalize transition-colors hover:bg-muted"
                >
                  <span className="truncate">{value}</span>
                  {selected.has(key) && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        ))}
        {count > 0 && (
          <button
            type="button"
            className="text-caption mt-2 w-full rounded-md border px-2 py-1 hover:text-foreground"
            onClick={onClear}
            data-testid={clearTestId}
          >
            Clear filters
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
