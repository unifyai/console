import * as React from 'react';
import { Skeleton } from '../UI/skeleton';
import { cn } from '@/lib/utils';

export function AssistantListItemSkeleton() {
    return (
        <div className={cn("flex items-center justify-between p-2 rounded-md")}>
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Avatar Skeleton */}
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0 bg-muted" />
                {/* Name Skeleton */}
                <Skeleton className="h-4 w-3/5 bg-muted" />
            </div>
            {/* Placeholder for action buttons area */}
            <div className="flex items-center gap-1 flex-shrink-0">
                 <Skeleton className="h-6 w-6 bg-muted" />
                 <Skeleton className="h-6 w-6 bg-muted" />
            </div>
        </div>
    );
}