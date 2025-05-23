import * as React from 'react';
import { Skeleton } from '@/components/UI/skeleton';
import { cn } from '@/lib/utils';

export function ActivityLogItemSkeleton() {
    return (
        <div className="flex items-start gap-3 py-3">
            {/* Icon Skeleton */}
            <Skeleton className="h-5 w-5 rounded-full mt-0.5 flex-shrink-0 bg-muted" />
            <div className="flex-1 space-y-1.5">
                {/* Header (Sender -> Receiver & Timestamp) Skeleton */}
                <div className="flex justify-between items-center">
                    <Skeleton className="h-3.5 w-2/5 bg-muted" /> {/* Sender -> Receiver */}
                    <Skeleton className="h-3 w-1/4 bg-muted" /> {/* Timestamp */}
                </div>
                {/* Content Skeleton */}
                <Skeleton className="h-3 w-full bg-muted" />
                <Skeleton className="h-3 w-3/4 bg-muted" />
            </div>
        </div>
    );
}