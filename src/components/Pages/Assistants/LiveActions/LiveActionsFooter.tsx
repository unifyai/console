/**
 * LiveActionsFooter - Status footer for the Live Actions Viewer.
 *
 * Displays non-interactive status information:
 * - Assistant working/idle status with indicator
 * - Running and completed event counts
 * - Last updated timestamp
 * - Connection status (streaming / polling / error)
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/assistants/assistant-actions';
import type { ActionConnectionStatus } from '@/hooks/Assistants/useAssistantActions';

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
  /** Current connection strategy */
  connectionStatus?: ActionConnectionStatus;
  /** Whether the displayed data is mock/simulated */
  isMockData?: boolean;
  /** Additional class names */
  className?: string;
}

/** Connection status indicator dot color and label */
function getConnectionIndicator(status: ActionConnectionStatus): {
  color: string;
  label: string;
} {
  switch (status) {
    case 'streaming':
      return { color: 'bg-[color:var(--status-success)]', label: 'Live' };
    case 'error':
      return { color: 'bg-[color:var(--status-danger)]', label: 'Disconnected' };
    case 'idle':
    default:
      return { color: 'bg-muted-foreground/50', label: '' };
  }
}

export function LiveActionsFooter({
  assistantName,
  isWorking,
  runningCount,
  completedCount,
  lastUpdated,
  connectionStatus = 'idle',
  isMockData = false,
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

  const runningText = `${runningCount} running`;
  const completedText = `${completedCount} completed`;

  const lastUpdatedText = lastUpdated
    ? `Updated ${formatRelativeTime(lastUpdated)}`
    : 'Not yet updated';

  const connectionIndicator = getConnectionIndicator(connectionStatus);

  return (
    <div
      className={cn(
        // h-10 aligns this bar with the chat input, brain/tasks footers, and
        // the assistant-list toggle — see AssistantList's footer for details.
        'flex h-10 items-center justify-between border-t bg-background px-3 text-xs text-muted-foreground',
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
              isWorking
                ? 'animate-pulse bg-[color:var(--status-success)]'
                : 'bg-muted-foreground/50'
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
          {isMockData && (
            <span className="font-medium text-[color:var(--status-warning)]">(mock) </span>
          )}
          {runningText}, {completedText}
        </span>
      </div>

      {/* Right side: Connection status + Last updated */}
      <div className="flex items-center gap-2">
        {connectionIndicator.label && (
          <div
            className="flex items-center gap-1"
            data-testid="connection-status"
            title={`Connection: ${connectionIndicator.label}`}
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full', connectionIndicator.color)}
              aria-hidden="true"
            />
            <span className="text-muted-foreground/70">{connectionIndicator.label}</span>
          </div>
        )}
        <span data-testid="last-updated">{lastUpdatedText}</span>
      </div>
    </div>
  );
}
