'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/** True when two ISO timestamps fall on the same calendar day (local time). */
export function isSameCalendarDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function formatCalendarDayLabel(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Local calendar-day bucket key for grouping (YYYY-MM-DD). */
export function calendarDaySortKey(timestamp: string): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Date divider rule shown between calendar-day groups (Actions, Guidance, etc.). */
export function TimelineDateSeparator({
  timestamp,
  className,
}: {
  timestamp: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-1 mt-2.5 flex min-w-0 items-center gap-2.5 first:mt-0', className)}>
      <span className="text-overline shrink-0">{formatCalendarDayLabel(timestamp)}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * Groups items by calendar day using `sortTimestamp`. Items without a
 * timestamp are placed last under an "Undated" heading.
 */
export function groupByCalendarDay<T extends { sortTimestamp: string | null }>(
  items: T[]
): Array<{ label: string; sortKey: string; items: T[] }> {
  const sorted = [...items].sort((a, b) => {
    if (!a.sortTimestamp && !b.sortTimestamp) return 0;
    if (!a.sortTimestamp) return 1;
    if (!b.sortTimestamp) return -1;
    return new Date(b.sortTimestamp).getTime() - new Date(a.sortTimestamp).getTime();
  });

  const groups: Array<{ label: string; sortKey: string; items: T[] }> = [];
  for (const item of sorted) {
    const sortKey = item.sortTimestamp ? calendarDaySortKey(item.sortTimestamp) : '__undated';
    const label = item.sortTimestamp ? formatCalendarDayLabel(item.sortTimestamp) : 'Undated';
    const last = groups[groups.length - 1];
    if (last && last.sortKey === sortKey) {
      last.items.push(item);
    } else {
      groups.push({ label, sortKey, items: [item] });
    }
  }
  return groups;
}
