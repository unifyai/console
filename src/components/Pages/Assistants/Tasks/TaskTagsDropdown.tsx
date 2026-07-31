'use client';

import * as React from 'react';
import { Ban, Check, ChevronDown, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import type { TagFilterState } from '@/utils/assistants/tasks';

interface TaskTagsDropdownProps {
  /** Every tag present across the pane's tasks, with task counts. */
  tags: { tag: string; count: number }[];
  filters: ReadonlyMap<string, TagFilterState>;
  /** Cycle one tag neutral → include → exclude → neutral. */
  onCycle: (tag: string) => void;
  onClear: () => void;
  className?: string;
}

/**
 * GitHub-labels-style tag filter: each tag cycles through neutral (no effect),
 * include (task must carry it), and exclude (task must not). The menu stays
 * open across clicks so several tags can be set in one visit.
 */
export function TaskTagsDropdown({
  tags,
  filters,
  onCycle,
  onClear,
  className,
}: TaskTagsDropdownProps) {
  if (tags.length === 0) return null;
  const activeCount = filters.size;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-foreground transition-colors hover:bg-muted',
            className
          )}
          aria-label="Filter by tags"
          data-testid="tasks-tags-dropdown"
        >
          <Tag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-caption text-semibold">Tags</span>
          {activeCount > 0 ? (
            <span
              className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground"
              data-testid="tasks-tags-active-count"
            >
              {activeCount}
            </span>
          ) : null}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="text-caption px-2 py-1.5 text-muted-foreground">
          Click cycles: include → exclude → off
        </div>
        <DropdownMenuSeparator />
        {tags.map(({ tag, count }) => {
          const state = filters.get(tag);
          return (
            <DropdownMenuItem
              key={tag}
              data-testid={`tasks-tag-${tag}`}
              data-state-filter={state ?? 'neutral'}
              onSelect={(event) => {
                event.preventDefault();
                onCycle(tag);
              }}
              className="gap-2"
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center',
                  state === 'include' && 'text-primary',
                  state === 'exclude' && 'text-destructive'
                )}
                aria-hidden="true"
              >
                {state === 'include' ? (
                  <Check className="h-3.5 w-3.5" />
                ) : state === 'exclude' ? (
                  <Ban className="h-3.5 w-3.5" />
                ) : null}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate',
                  state === 'exclude' && 'line-through opacity-70'
                )}
              >
                {tag}
              </span>
              <span className="text-caption shrink-0 text-muted-foreground">{count}</span>
            </DropdownMenuItem>
          );
        })}
        {activeCount > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="tasks-tags-clear"
              onSelect={(event) => {
                event.preventDefault();
                onClear();
              }}
              className="justify-center text-muted-foreground"
            >
              Clear tag filters
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
