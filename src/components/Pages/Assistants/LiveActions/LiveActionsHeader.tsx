/**
 * LiveActionsHeader - Header controls for the Live Actions Viewer.
 *
 * Contains:
 * - Time window picker (preset relative windows)
 * - Search input for filtering events by label
 * - Expand/Collapse All toggle button
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { ChevronsUpDown, ChevronsDownUp, Clock, Check, ArrowDown } from 'lucide-react';
import { TabToolbar } from '../Common/TabToolbar';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';

// ─── Time Window Presets ─────────────────────────────────────────────────────

export interface TimeWindowPreset {
  key: string;
  label: string;
  shortLabel: string;
  getMs: () => number;
}

const MS = { m: 60_000, h: 3_600_000, d: 86_400_000 };

function msSinceMidnight(daysAgo = 0): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Date.now() - d.getTime() + daysAgo * MS.d;
}

export const TIME_WINDOW_PRESETS: TimeWindowPreset[] = [
  { key: 'today', label: 'Today', shortLabel: 'Today', getMs: () => msSinceMidnight() },
  { key: 'yesterday', label: 'Yesterday', shortLabel: 'Yest.', getMs: () => msSinceMidnight(1) },
  { key: '30m', label: 'Last 30 minutes', shortLabel: '30m', getMs: () => 30 * MS.m },
  { key: '1h', label: 'Last 1 hour', shortLabel: '1h', getMs: () => MS.h },
  { key: '2h', label: 'Last 2 hours', shortLabel: '2h', getMs: () => 2 * MS.h },
  { key: '3h', label: 'Last 3 hours', shortLabel: '3h', getMs: () => 3 * MS.h },
  { key: '6h', label: 'Last 6 hours', shortLabel: '6h', getMs: () => 6 * MS.h },
  { key: '12h', label: 'Last 12 hours', shortLabel: '12h', getMs: () => 12 * MS.h },
  { key: '24h', label: 'Last 24 hours', shortLabel: '24h', getMs: () => 24 * MS.h },
  { key: '3d', label: 'Last 3 days', shortLabel: '3d', getMs: () => 3 * MS.d },
  { key: '7d', label: 'Last 7 days', shortLabel: '7d', getMs: () => 7 * MS.d },
];

export const DEFAULT_TIME_WINDOW_KEY = '3h';

// ─── Header Component ────────────────────────────────────────────────────────

export interface LiveActionsHeaderProps {
  /** Current search term */
  searchTerm: string;
  /** Callback when search term changes */
  onSearchChange: (term: string) => void;
  /** Whether all nodes are currently expanded */
  allExpanded: boolean;
  /** Callback to expand all nodes */
  onExpandAll: () => void;
  /** Callback to collapse all nodes */
  onCollapseAll: () => void;
  /** Whether expand/collapse button is disabled (no nodes) */
  expandCollapseDisabled?: boolean;
  /** Currently selected time window key */
  timeWindowKey: string;
  /** Callback when time window changes */
  onTimeWindowChange: (key: string) => void;
  /** Callback to manually refresh (poll Orchestra) */
  onRefresh?: () => void;
  /** Whether a refresh is in progress */
  isRefreshing?: boolean;
  /** Total number of matched nodes when search is active (undefined when no search) */
  searchMatchCount?: number;
  /** Whether actions are currently loading */
  isLoading?: boolean;
  /** Additional class names */
  className?: string;
}

export function LiveActionsHeader({
  searchTerm,
  onSearchChange,
  allExpanded,
  onExpandAll,
  onCollapseAll,
  expandCollapseDisabled = false,
  timeWindowKey,
  onTimeWindowChange,
  searchMatchCount,
  onRefresh,
  isRefreshing = false,
  isLoading = false,
  className,
}: LiveActionsHeaderProps) {
  const [timeWindowOpen, setTimeWindowOpen] = React.useState(false);
  const [localSearch, setLocalSearch] = React.useState(searchTerm);

  React.useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  const activePreset = TIME_WINDOW_PRESETS.find((p) => p.key === timeWindowKey);

  const commitSearch = () => {
    onSearchChange(localSearch);
  };

  const handleClearSearch = () => {
    setLocalSearch('');
    onSearchChange('');
  };

  const handleExpandCollapseClick = () => {
    if (allExpanded) {
      onCollapseAll();
    } else {
      onExpandAll();
    }
  };

  const searchResultHint =
    searchTerm && searchMatchCount !== undefined
      ? searchMatchCount > 0
        ? `${searchMatchCount} result${searchMatchCount !== 1 ? 's' : ''}`
        : '0 results'
      : null;

  return (
    <TabToolbar
      testId="live-actions-header"
      className={className}
      leading={
        <Popover open={timeWindowOpen} onOpenChange={setTimeWindowOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              className={cn('h-7 gap-1.5 whitespace-nowrap', isLoading && 'opacity-50')}
              title="History time window"
              data-testid="live-actions-time-window"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{activePreset?.shortLabel ?? timeWindowKey}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48 p-1">
            <div className="flex flex-col">
              {TIME_WINDOW_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    onTimeWindowChange(preset.key);
                    setTimeWindowOpen(false);
                  }}
                  className={cn(
                    'flex items-center justify-between rounded-sm px-2 py-1.5 text-xs transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    preset.key === timeWindowKey
                      ? 'bg-accent/50 font-medium text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  <span>{preset.label}</span>
                  {preset.key === timeWindowKey && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      }
      searchValue={localSearch}
      onSearchChange={setLocalSearch}
      searchPlaceholder={tabSearchPlaceholder('actions')}
      onSearchSubmit={() => {
        if (localSearch !== searchTerm) commitSearch();
      }}
      onSearchClear={handleClearSearch}
      searchResultHint={searchResultHint}
      searchTestId="live-actions-search"
      searchClearTestId="live-actions-search-clear"
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      refreshTitle="Poll recent events"
      refreshTestId="live-actions-refresh"
      trailing={
        <span
          className="hidden h-7 items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-2.5 text-[11.5px] font-medium text-muted-foreground lg:inline-flex"
          title="Actions are ordered oldest at the top, newest at the bottom"
          data-testid="live-actions-order-hint"
        >
          <ArrowDown className="h-3 w-3 text-accent-soft-foreground" />
          Oldest → Newest
        </span>
      }
      addAction={
        <Button
          variant="outline"
          size="sm"
          onClick={handleExpandCollapseClick}
          disabled={expandCollapseDisabled}
          className="h-7 gap-1.5 whitespace-nowrap"
          data-testid="live-actions-expand-collapse"
        >
          {allExpanded ? (
            <>
              <ChevronsDownUp className="h-4 w-4" />
              <span className="hidden sm:inline">Collapse All</span>
            </>
          ) : (
            <>
              <ChevronsUpDown className="h-4 w-4" />
              <span className="hidden sm:inline">Expand All</span>
            </>
          )}
        </Button>
      }
    />
  );
}
