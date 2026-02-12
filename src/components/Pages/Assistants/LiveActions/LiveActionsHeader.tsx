/**
 * LiveActionsHeader - Header controls for the Live Actions Viewer.
 *
 * Contains:
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
import { Search, X, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';

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
  className,
}: LiveActionsHeaderProps) {
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
      className={cn('flex items-center gap-3 border-b bg-background px-4 py-3', className)}
      data-testid="live-actions-header"
    >
      {/* Search Input */}
      <div className="relative flex-1">
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
