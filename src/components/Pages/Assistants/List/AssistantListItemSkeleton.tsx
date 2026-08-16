import * as React from 'react';
import { Skeleton } from '../../../UI/skeleton';
import { cn } from '@/lib/utils';

export function AssistantListItemSkeleton({ isFolded }: { isFolded?: boolean }) {
  if (isFolded) {
    return (
      <Skeleton role="list-item-skeleton" className="h-8 w-8 flex-shrink-0 rounded-full bg-muted" />
    );
  }

  return (
    <div
      role="list-item-skeleton"
      className={cn('flex items-center justify-between rounded-md px-2 py-1')}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {/* Avatar Skeleton */}
        <Skeleton className="h-7 w-7 flex-shrink-0 rounded-full bg-muted" />
        {/* Name Skeleton */}
        <Skeleton className="h-4 w-3/5 bg-muted" />
      </div>
      {/* Placeholder for action buttons area */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <Skeleton className="h-6 w-6 bg-muted" />
        <Skeleton className="h-6 w-6 bg-muted" />
      </div>
    </div>
  );
}
