import * as React from 'react';
import { Skeleton } from '@/components/UI/skeleton';
import { cn } from '@/lib/utils';

export function VoiceListItemSkeleton() {
  return (
    <div className={cn('flex items-center gap-2 rounded-md border border-transparent p-2')}>
      <Skeleton className="h-5 w-5 flex-shrink-0 rounded-sm bg-muted" /> {/* Flag */}
      <Skeleton className="h-4 w-3/5 bg-muted" /> {/* Name */}
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Skeleton className="h-6 w-6 rounded-sm bg-muted" />
        <Skeleton className="h-6 w-6 rounded-sm bg-muted" />
        <Skeleton className="h-6 w-6 rounded-sm bg-muted" />
      </div>
    </div>
  );
}
