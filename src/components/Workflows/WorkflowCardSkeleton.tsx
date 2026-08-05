'use client';

import { Card, CardContent } from '@/components/UI/card';
import { Skeleton } from '@/components/UI/skeleton';

/** Matches WorkflowCard's 208px min-height so the grid doesn't jump on load. */
export function WorkflowCardSkeleton() {
  return (
    <Card className="min-h-[208px] overflow-hidden shadow-sm">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-[26px] w-[84px] rounded-lg" />
        </div>
        <Skeleton className="h-2.5 w-14" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-2.5 w-[88%]" />
        <div className="mt-auto flex items-center justify-between border-t pt-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkflowGallerySkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <WorkflowCardSkeleton key={index} />
      ))}
    </div>
  );
}
