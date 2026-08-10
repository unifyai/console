'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, ChevronsDownUp, LayoutDashboard, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/UI/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import type { DashboardRecord, TileRecord } from '@/types/assistants/dashboard';
import { StrayRootBadge, isStrayRootRecord } from './StrayRootBadge';

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

export function DashboardViewSelector({
  dashboards,
  tiles,
  selectedKey,
  onSelect,
  filterQuery = '',
  flagPersonalAsStray = false,
}: {
  dashboards: DashboardRecord[];
  tiles: TileRecord[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  filterQuery?: string;
  /** True for team-owned assistants, whose personal root should be empty. */
  flagPersonalAsStray?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const normalizedQuery = filterQuery.trim().toLowerCase();

  const filteredDashboards = useMemo(() => {
    if (!normalizedQuery) return dashboards;
    return dashboards.filter(
      (dashboard) =>
        matchesQuery(dashboard.title, normalizedQuery) ||
        matchesQuery(dashboard.description ?? '', normalizedQuery)
    );
  }, [dashboards, normalizedQuery]);

  const filteredTiles = useMemo(() => {
    if (!normalizedQuery) return tiles;
    return tiles.filter(
      (tile) =>
        matchesQuery(tile.title, normalizedQuery) ||
        matchesQuery(tile.description ?? '', normalizedQuery)
    );
  }, [tiles, normalizedQuery]);

  const selectedLabel = useMemo(() => {
    if (!selectedKey) return null;
    if (selectedKey.startsWith('dash:')) {
      const token = selectedKey.slice(5);
      return dashboards.find((dashboard) => dashboard.token === token)?.title ?? null;
    }
    if (selectedKey.startsWith('tile:')) {
      const token = selectedKey.slice(5);
      return tiles.find((tile) => tile.token === token)?.title ?? null;
    }
    return null;
  }, [selectedKey, dashboards, tiles]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-7 min-w-[10rem] max-w-[min(100vw,18rem)] flex-1 justify-between text-xs sm:max-w-xs"
          data-testid="dashboard-selector"
        >
          <span className="truncate">{selectedLabel ?? 'Select a view...'}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-dashboard-combobox-popover
        className="flex max-h-[min(70vh,28rem)] w-[var(--radix-popover-trigger-width)] flex-col overflow-hidden p-0"
        align="start"
      >
        <Command className="min-h-0 flex-1" shouldFilter={false}>
          <CommandList className="min-h-0 flex-1">
            <CommandEmpty className="py-3 text-xs">No results found.</CommandEmpty>
            {filteredDashboards.length > 0 && (
              <CommandGroup
                heading="Dashboards"
                className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                {filteredDashboards.map((dashboard) => {
                  const key = `dash:${dashboard.token}`;
                  return (
                    <CommandItem
                      key={key}
                      value={`${dashboard.title} ${dashboard.description ?? ''}`}
                      className="gap-1.5 py-1 text-xs"
                      onSelect={() => {
                        onSelect(key);
                        setOpen(false);
                      }}
                    >
                      <LayoutDashboard className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{dashboard.title}</span>
                      {isStrayRootRecord(dashboard, flagPersonalAsStray) && <StrayRootBadge />}
                      <Check
                        className={cn(
                          'ml-auto h-3 w-3 shrink-0',
                          selectedKey === key ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {filteredTiles.length > 0 && (
              <CommandGroup
                heading="Tiles"
                className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                {filteredTiles.map((tile) => {
                  const key = `tile:${tile.token}`;
                  return (
                    <CommandItem
                      key={key}
                      value={`${tile.title} ${tile.description ?? ''}`}
                      className="gap-1.5 py-1 text-xs"
                      onSelect={() => {
                        onSelect(key);
                        setOpen(false);
                      }}
                    >
                      <Code2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{tile.title}</span>
                      {isStrayRootRecord(tile, flagPersonalAsStray) && <StrayRootBadge />}
                      <Check
                        className={cn(
                          'ml-auto h-3 w-3 shrink-0',
                          selectedKey === key ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function DashboardCollapseAllButton({
  allCollapsed,
  onToggleCollapseAll,
}: {
  allCollapsed: boolean;
  onToggleCollapseAll: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggleCollapseAll}
      className="h-7 gap-1.5 whitespace-nowrap"
      title={allCollapsed ? 'Expand all tiles' : 'Collapse all tiles'}
      data-testid="dashboard-collapse-all"
    >
      {allCollapsed ? (
        <>
          <ChevronsUpDown className="h-4 w-4" />
          <span className="hidden sm:inline">Expand All</span>
        </>
      ) : (
        <>
          <ChevronsDownUp className="h-4 w-4" />
          <span className="hidden sm:inline">Collapse All</span>
        </>
      )}
    </Button>
  );
}
