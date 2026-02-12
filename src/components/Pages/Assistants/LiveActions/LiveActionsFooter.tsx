/**
 * LiveActionsFooter - Status footer for the Live Actions Viewer.
 *
 * Displays non-interactive status information:
 * - Assistant working/idle status with indicator
 * - Running and completed event counts
 * - Last updated timestamp
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/assistants/assistant-actions';

export interface LiveActionsFooterProps {
  /** Assistant first name for status message */
  assistantName: string;
  /** Whether the assistant has running actions */
  isWorking: boolean;
  /** Count of running nodes */
  runningCount: number;
  /** Count of completed nodes */
  completedCount: number;
  /** Timestamp of last data update */
  lastUpdated: Date | null;
  /** Additional class names */
  className?: string;
}

export function LiveActionsFooter({
  assistantName,
  isWorking,
  runningCount,
  completedCount,
  lastUpdated,
  className,
}: LiveActionsFooterProps) {
  // Update relative time every second
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format counts with proper pluralization (we use simple format without 's')
  const runningText = `${runningCount} running`;
  const completedText = `${completedCount} completed`;

  // Format last updated
  const lastUpdatedText = lastUpdated
    ? `Updated ${formatRelativeTime(lastUpdated)}`
    : 'Not yet updated';

  return (
    <div
      className={cn(
        'flex items-center justify-between border-t bg-background px-4 py-2 text-sm text-muted-foreground',
        className
      )}
      data-testid="live-actions-footer"
    >
      {/* Left side: Status and counts */}
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5" data-testid="assistant-status">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isWorking ? 'animate-pulse bg-green-500' : 'bg-muted-foreground/50'
            )}
            aria-hidden="true"
          />
          <span>
            {assistantName} is {isWorking ? 'working' : 'idle'}
          </span>
        </div>

        {/* Separator */}
        <span className="text-muted-foreground/50">·</span>

        {/* Event counts */}
        <span data-testid="event-counts">
          {runningText}, {completedText}
        </span>
      </div>

      {/* Right side: Last updated */}
      <div data-testid="last-updated">{lastUpdatedText}</div>
    </div>
  );
}
