/**
 * LiveActionsHeader - Header controls for the Live Actions Viewer.
 *
 * Contains:
 * - Time window picker (preset relative windows)
 * - Search input for filtering events by label
 * - Expand/Collapse All toggle button
 * - Auto-collapse completed checkbox
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/UI/input';
import { Button } from '@/components/UI/button';
import { Checkbox } from '@/components/UI/checkbox';
import { Label } from '@/components/UI/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { Search, X, ChevronsUpDown, ChevronsDownUp, Clock, Check, RefreshCw } from 'lucide-react';

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
  /** Whether auto-collapse completed is enabled */
  autoCollapse: boolean;
  /** Callback when auto-collapse setting changes */
  onAutoCollapseChange: (enabled: boolean) => void;
  /** Currently selected time window key */
  timeWindowKey: string;
  /** Callback when time window changes */
  onTimeWindowChange: (key: string) => void;
  /** Callback to manually refresh (poll Orchestra) */
  onRefresh?: () => void;
  /** Whether a refresh is in progress */
  isRefreshing?: boolean;
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
  autoCollapse,
  onAutoCollapseChange,
  timeWindowKey,
  onTimeWindowChange,
  onRefresh,
  isRefreshing = false,
  className,
}: LiveActionsHeaderProps) {
  const [timeWindowOpen, setTimeWindowOpen] = React.useState(false);

  const activePreset = TIME_WINDOW_PRESETS.find((p) => p.key === timeWindowKey);

  const handleClearSearch = () => {
    onSearchChange('');
  };

  const handleExpandCollapseClick = () => {
    if (allExpanded) {
      onCollapseAll();
    } else {
      onExpandAll();
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2.5',
        className
      )}
      data-testid="live-actions-header"
    >
      {/* Time Window Picker */}
      <Popover open={timeWindowOpen} onOpenChange={setTimeWindowOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 whitespace-nowrap"
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

      {/* Manual Refresh Button */}
      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-1.5 whitespace-nowrap"
          title="Poll recent events"
          data-testid="live-actions-refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
        </Button>
      )}

      {/* Search Input */}
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search events..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 pl-8 pr-8"
          data-testid="live-actions-search"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
            data-testid="live-actions-search-clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand/Collapse All Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleExpandCollapseClick}
        disabled={expandCollapseDisabled}
        className="gap-1.5 whitespace-nowrap"
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

      {/* Auto-Collapse Toggle */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="auto-collapse"
          checked={autoCollapse}
          onCheckedChange={(checked) => onAutoCollapseChange(checked === true)}
          data-testid="live-actions-auto-collapse"
        />
        <Label
          htmlFor="auto-collapse"
          className="text-body-muted hidden cursor-pointer whitespace-nowrap sm:inline"
        >
          Auto-collapse completed
        </Label>
        <Label
          htmlFor="auto-collapse"
          className="text-body-muted cursor-pointer whitespace-nowrap sm:hidden"
          title="Auto-collapse completed"
        >
          Auto-fold
        </Label>
      </div>
    </div>
  );
}
