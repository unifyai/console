import * as React from 'react';
import { Skeleton } from '../../../UI/skeleton';
import { cn } from '@/lib/utils';

export function TaskListItemSkeleton() {
    // Mimic the padding and border structure of AccordionItem + AccordionTrigger
    return (
        <div className="border-b px-2"> {/* Container matching AccordionItem structure */}
            <div className="flex items-center p-0"> {/* Mimics AccordionTrigger base */}
                {/* Mimic Grid layout within the trigger */}
                <div className={cn(
                     "grid w-full items-center gap-x-4 px-3 py-3",
                     "grid-cols-[minmax(0,_1fr)_auto_100px]"
                 )}>
                    {/* Column 1: Task Title Skeleton */}
                    <div className="min-w-0 overflow-hidden">
                        <Skeleton className="h-4 w-5/6 animate-pulse bg-muted" />
                    </div>

                    {/* Column 2: Status Badge Skeleton */}
                    <div className="text-center">
                        <Skeleton className="h-5 w-16 rounded-full animate-pulse bg-muted" />
                    </div>

                    {/* Column 3: Assigned Avatars Skeleton */}
                    <div className="flex items-center justify-center -space-x-2 overflow-hidden">
                        <Skeleton className="h-6 w-6 rounded-full border-2 border-background animate-pulse bg-muted" />
                        <Skeleton className="h-6 w-6 rounded-full border-2 border-background animate-pulse bg-muted" />
                    </div>
                </div>
            </div>
        </div>
    );
}