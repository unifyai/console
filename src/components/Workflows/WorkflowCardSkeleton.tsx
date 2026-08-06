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
    <div
      className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      data-testid="workflow-gallery-skeleton"
    >
      {Array.from({ length: count }).map((_, index) => (
        <WorkflowCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Installed rows are a list, not a grid — skeleton the shape the user gets. */
export function WorkflowInstalledSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5" data-testid="workflow-installed-skeleton">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="grid w-full grid-cols-[auto_1fr] items-center gap-3 rounded-xl border bg-card-2 p-3.5 lg:grid-cols-[auto_1fr_auto]"
        >
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-2.5 w-72 max-w-full" />
          </div>
          <div className="col-span-2 flex gap-2 lg:col-span-1">
            <Skeleton className="h-7 w-24 rounded-md" />
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Detail-sheet body placeholder: requirement checklist, settings form and the
 * "what it sets up" manifest, in the order the sheet renders them.
 */
export function WorkflowDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5" data-testid="workflow-detail-skeleton">
      {[0, 1, 2].map((section) => (
        <div key={section} className="space-y-2.5">
          <Skeleton className="h-2.5 w-28" />
          <div className="divide-y overflow-hidden rounded-xl border bg-card-2">
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center gap-3 p-3">
                <Skeleton className="h-[34px] w-[34px] rounded-[10px]" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-2.5 w-56 max-w-full" />
                </div>
                <Skeleton className="h-7 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
