import * as React from 'react';
import { Skeleton } from '../../../../UI/skeleton';
import { cn } from '@/lib/utils';

export function TaskListItemSkeleton() {
  return (
    <div className="border-b px-2">
      <div className="flex items-center p-0">
        <div
          className={cn(
            'grid w-full items-center gap-x-2 px-3 py-3', // Match gap-x with item
            'grid-cols-[minmax(0,_1fr)_90px_110px_100px]' // Match new layout
          )}
        >
          {/* Column 1: Task Name Skeleton */}
          <div className="min-w-0 overflow-hidden">
            <Skeleton className="h-4 w-5/6 animate-pulse bg-muted" />
          </div>

          {/* Column 2: Priority Skeleton */}
          <div className="text-center">
            <Skeleton className="h-4 w-16 animate-pulse bg-muted" />{' '}
            {/* Approx width for "Urgent" + icon */}
          </div>

          {/* Column 3: Deadline Skeleton */}
          <div className="text-center">
            <Skeleton className="h-4 w-20 animate-pulse bg-muted" />{' '}
            {/* Approx width for "Sep 30" + icon */}
          </div>

          {/* Column 4: Status Badge Skeleton */}
          <div className="text-center">
            <Skeleton className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
