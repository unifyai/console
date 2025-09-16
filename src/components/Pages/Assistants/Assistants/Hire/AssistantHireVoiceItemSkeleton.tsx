import * as React from 'react';
import { Skeleton } from '@/components/UI/skeleton';
import { cn } from '@/lib/utils';

export function VoiceListItemSkeleton() {
    return (
        <div className={cn("flex items-center gap-2 p-2 rounded-md border border-transparent")}>
            <Skeleton className="h-5 w-5 rounded-sm flex-shrink-0 bg-muted" /> {/* Flag */}
            <Skeleton className="h-4 w-3/5 bg-muted" /> {/* Name */}
            <div className="flex items-center gap-1 sm:gap-2 ml-auto">
                <Skeleton className="h-6 w-6 rounded-sm bg-muted" />
                <Skeleton className="h-6 w-6 rounded-sm bg-muted" />
                <Skeleton className="h-6 w-6 rounded-sm bg-muted" />
            </div>
        </div>
    );
}