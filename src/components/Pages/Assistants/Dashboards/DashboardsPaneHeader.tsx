'use client';

import React, { useState, useMemo } from 'react';
import {
  Check,
  ChevronsUpDown,
  ChevronsDownUp,
  LayoutDashboard,
  Code2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/UI/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import type { DashboardRecord, TileRecord } from '@/types/assistants/dashboard';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';

interface DashboardsPaneHeaderProps {
  dashboards: DashboardRecord[];
  /** All assistant tiles (searchable); not limited to tiles outside dashboards */
  tiles: TileRecord[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  allCollapsed: boolean;
  onToggleCollapseAll: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function DashboardsPaneHeader({
  dashboards,
  tiles,
  selectedKey,
  onSelect,
  allCollapsed,
  onToggleCollapseAll,
  onRefresh,
  isRefreshing = false,
}: DashboardsPaneHeaderProps) {
  const [open, setOpen] = useState(false);
  const hasItems = dashboards.length > 0 || tiles.length > 0;

  const selectedLabel = useMemo(() => {
    if (!selectedKey) return null;
    if (selectedKey.startsWith('dash:')) {
      const token = selectedKey.slice(5);
      return dashboards.find((d) => d.token === token)?.title ?? null;
    }
    if (selectedKey.startsWith('tile:')) {
      const token = selectedKey.slice(5);
      return tiles.find((t) => t.token === token)?.title ?? null;
    }
    return null;
  }, [selectedKey, dashboards, tiles]);

  if (!hasItems) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b bg-background px-3 py-2">
      {/* Global refresh */}
      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-7 gap-1.5 whitespace-nowrap"
          title="Refresh all dashboards & tiles"
          data-testid="dashboard-header-refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
        </Button>
      )}

      {/* Searchable combobox selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-7 min-w-0 flex-1 justify-between text-xs"
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
          <Command className="min-h-0 flex-1">
            <CommandInput
              className="h-8 shrink-0 text-xs"
              placeholder={tabSearchPlaceholder('dashboards')}
              onKeyDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
            />
            <CommandList className="min-h-0 flex-1">
              <CommandEmpty className="py-3 text-xs">No results found.</CommandEmpty>
              {dashboards.length > 0 && (
                <CommandGroup
                  heading="Dashboards"
                  className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {dashboards.map((d) => {
                    const key = `dash:${d.token}`;
                    return (
                      <CommandItem
                        key={key}
                        value={`${d.title} ${d.description ?? ''}`}
                        className="gap-1.5 py-1 text-xs"
                        onSelect={() => {
                          onSelect(key);
                          setOpen(false);
                        }}
                      >
                        <LayoutDashboard className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{d.title}</span>
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
              {tiles.length > 0 && (
                <CommandGroup
                  heading="Tiles"
                  className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {tiles.map((t) => {
                    const key = `tile:${t.token}`;
                    return (
                      <CommandItem
                        key={key}
                        value={`${t.title} ${t.description ?? ''}`}
                        className="gap-1.5 py-1 text-xs"
                        onSelect={() => {
                          onSelect(key);
                          setOpen(false);
                        }}
                      >
                        <Code2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{t.title}</span>
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

      {/* Expand / Collapse All */}
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
    </div>
  );
}
