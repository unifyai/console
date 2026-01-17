/**
 * PlotFooter - Compact footer showing plot summary and controls
 *
 * Displays:
 * - Group count (if grouped plot)
 * - Pinned datapoint count
 *
 * Clicking toggles the PlotDetailsDrawer open/closed.
 */

'use client';

import { ChevronUp, ChevronDown } from 'lucide-react';
import { PlotFooterProps } from '@/types/interfaces/plot-details';

/**
 * PlotFooter Component
 *
 * A compact, clickable footer that toggles a drawer for details.
 */
export function PlotFooter({ groupCount, pinnedCount, isOpen, onToggle }: PlotFooterProps) {
  const hasDetails = groupCount > 0 || pinnedCount > 0;

  return (
    <footer className="flex flex-shrink-0 items-center border-t border-border bg-background px-4 py-2 text-xs text-muted-foreground">
      {/* Counts - clickable to toggle drawer */}
      <button
        onClick={onToggle}
        disabled={!hasDetails}
        className={`flex items-center gap-3 transition-colors ${
          hasDetails ? 'cursor-pointer hover:text-foreground' : 'cursor-default opacity-50'
        }`}
        aria-label={isOpen ? 'Close plot details' : 'Open plot details'}
        aria-expanded={isOpen}
      >
        {hasDetails &&
          (isOpen ? (
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronUp className="h-3 w-3" aria-hidden="true" />
          ))}

        {groupCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-primary" />
            {groupCount} {groupCount === 1 ? 'group' : 'groups'}
          </span>
        )}

        {pinnedCount > 0 && (
          <span className="flex items-center gap-1">
            <span aria-hidden="true">📌</span>
            {pinnedCount} pinned
          </span>
        )}

        {!hasDetails && <span className="italic">No groups or pinned data</span>}
      </button>
    </footer>
  );
}

export default PlotFooter;
