'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';

export interface DashboardsPaneFooterProps {
  dashboardCount: number;
  tileCount: number;
  dataUpdatedAt: number;
  isPolling: boolean;
  isRefreshing: boolean;
  isMockData: boolean;
  onRefresh: () => void;
}

function formatRelativeTime(ms: number): string {
  if (!ms) return '';
  const seconds = Math.round((Date.now() - ms) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function DashboardsPaneFooter({
  dashboardCount,
  tileCount,
  dataUpdatedAt,
  isPolling,
  isRefreshing,
  isMockData,
  onRefresh,
}: DashboardsPaneFooterProps) {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const updatedText = dataUpdatedAt > 0 ? `Updated ${formatRelativeTime(dataUpdatedAt)}` : '';

  return (
    <div
      // h-10 aligns this bar with the chat input, brain/tasks footers, and
      // the assistant-list toggle — see AssistantList's footer for details.
      className="text-caption flex h-10 items-center justify-between border-t bg-background px-3"
      data-testid="dashboards-footer"
    >
      {/* Left: counts + status */}
      <div className="flex items-center gap-2">
        {isPolling && (
          <>
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--status-success)]" />
              <span className="text-muted-foreground/70">Live</span>
            </div>
            <span className="text-muted-foreground/50">·</span>
          </>
        )}
        <span>
          {isMockData && (
            <span className="font-medium text-[color:var(--status-warning)]">(mock) </span>
          )}
          {dashboardCount} {dashboardCount === 1 ? 'dashboard' : 'dashboards'}, {tileCount}{' '}
          {tileCount === 1 ? 'tile' : 'tiles'}
        </span>
      </div>

      {/* Right: updated time + refresh */}
      <div className="flex items-center gap-2">{updatedText && <span>{updatedText}</span>}</div>
    </div>
  );
}
