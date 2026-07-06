'use client';

import * as React from 'react';
import { TabFooter } from '../Common/TabFooter';

export interface DashboardsPaneFooterProps {
  dashboardCount: number;
  tileCount: number;
  dataUpdatedAt: number;
  isPolling: boolean;
  isMockData: boolean;
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
  isMockData,
}: DashboardsPaneFooterProps) {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const updatedText = dataUpdatedAt > 0 ? `Updated ${formatRelativeTime(dataUpdatedAt)}` : '';

  return (
    <TabFooter
      testId="dashboards-footer"
      status={
        <>
          {isPolling && (
            <>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--status-success)]" />
                <span className="text-muted-foreground/70">Live</span>
              </div>
              <span className="text-muted-foreground/50">·</span>
            </>
          )}
          <span data-testid="dashboards-table-footer">
            {isMockData && (
              <span className="font-medium text-[color:var(--status-warning)]">(mock) </span>
            )}
            {dashboardCount} {dashboardCount === 1 ? 'dashboard' : 'dashboards'}, {tileCount}{' '}
            {tileCount === 1 ? 'tile' : 'tiles'}
          </span>
        </>
      }
      right={updatedText ? <span>{updatedText}</span> : undefined}
    />
  );
}
