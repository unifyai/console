'use client';

import * as React from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import { isImeComposing } from '@/utils/keyboard';

/** Ghost icon buttons shared by section toolbars and the platform actions cluster. */
export const tabToolbarIconButtonClass = 'h-7 w-7 shrink-0';

/**
 * Standardized second-row toolbar shared by every assistant tab.
 *
 * Layout mirrors the platform design: optional `leading` controls (segmented
 * filters), a full-width search field that stretches between its neighbours,
 * optional `trailing` controls, then the collapsed Filter dropdown, a Refresh
 * affordance, and a primary Add action. Tabs only pass the slots they need so
 * the common controls always sit in the same place with the same styling.
 */
export interface TabToolbarProps {
  /** Controlled search value. Omit `search` entirely to hide the field. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Use `tabSearchPlaceholder()` from `@/constants/assistants/tabSearchPlaceholders`. */
  searchPlaceholder?: string;
  /** Fired on Enter when the tab filters server-side rather than live. */
  onSearchSubmit?: () => void;
  /** Custom clear handler; defaults to clearing the controlled value. */
  onSearchClear?: () => void;
  /** Right-aligned in-field result hint (e.g. "3 results"). */
  searchResultHint?: string | null;
  searchInputRef?: React.Ref<HTMLInputElement>;
  searchTestId?: string;
  searchClearTestId?: string;
  /** Controls before the search field (segmented filters). */
  leading?: React.ReactNode;
  /** Controls after the search field but before Filter/Refresh/Add. */
  trailing?: React.ReactNode;
  /** Collapsed Filter dropdown — render a `TabFilterDropdown`. */
  filter?: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  refreshTitle?: string;
  refreshTestId?: string;
  /** Primary add action — render a `Button` (keeps per-tab labels/icons). */
  addAction?: React.ReactNode;
  testId?: string;
  className?: string;
}

export function TabToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  onSearchSubmit,
  onSearchClear,
  searchResultHint,
  searchInputRef,
  searchTestId,
  searchClearTestId,
  leading,
  trailing,
  filter,
  onRefresh,
  isRefreshing = false,
  refreshTitle = 'Refresh',
  refreshTestId,
  addAction,
  testId,
  className,
}: TabToolbarProps) {
  const showSearch = searchValue !== undefined && onSearchChange !== undefined;
  const internalSearchRef = React.useRef<HTMLInputElement>(null);
  const searchRef = (searchInputRef ?? internalSearchRef) as React.RefObject<HTMLInputElement>;

  const handleClear = () => {
    if (onSearchClear) onSearchClear();
    else onSearchChange?.('');
  };

  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-3 py-2',
        className
      )}
      data-testid={testId}
    >
      {leading ? (
        <div className="flex max-w-full shrink-0 items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {leading}
        </div>
      ) : null}

      {showSearch && (
        <div className="relative min-w-0 flex-1 sm:min-w-[180px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            className={cn(
              'h-7 w-full rounded-md border bg-transparent pl-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
              searchResultHint || searchValue ? 'pr-20' : 'pr-7'
            )}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (isImeComposing(e)) return;
              if (e.key === 'Escape') {
                handleClear();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Enter' && onSearchSubmit) {
                e.preventDefault();
                onSearchSubmit();
              }
            }}
            data-testid={searchTestId}
          />
          {(searchValue || searchResultHint) && (
            <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              {searchResultHint && (
                <span className="text-muted-foreground/50 mr-0.5 text-[10px] tabular-nums">
                  {searchResultHint}
                </span>
              )}
              {searchValue && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-muted-foreground/50 rounded-sm p-0.5 hover:text-foreground"
                  aria-label="Clear search"
                  data-testid={searchClearTestId}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          )}
        </div>
      )}

      {trailing}

      {filter}

      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          className={tabToolbarIconButtonClass}
          onClick={onRefresh}
          disabled={isRefreshing}
          title={refreshTitle}
          aria-label={refreshTitle}
          data-testid={refreshTestId}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
        </Button>
      )}

      {addAction}
    </div>
  );
}
