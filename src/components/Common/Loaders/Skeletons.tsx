import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/UI/skeleton';

/**
 * Shared skeleton building blocks. Every loading placeholder should compose
 * these so the loading experience is visually consistent across routes, panels,
 * tables and lists: one pulse animation, one radius scale and one surface tint
 * (the canonical `Skeleton` atom). These are pure presentational components with
 * no hooks, so they are safe to render from server components (e.g. route-level
 * `loading.tsx`) as well as client components.
 */

/** A block of stacked text lines; the last line is shortened to read as prose. */
export function SkeletonText({
  lines = 3,
  className,
  lastLineWidth = '60%',
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 w-full"
          style={i === lines - 1 && lines > 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

/** A card surface with an avatar/title header and a paragraph of lines. */
export function SkeletonCard({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 shadow-sm', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={lines} className="mt-4" />
    </div>
  );
}

/** A vertical list of rows, each with a leading avatar and trailing action. */
export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** A header row plus body rows approximating a data table. */
export function SkeletonTable({
  rows = 6,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border', className)}>
      <div className="bg-muted/40 flex gap-4 border-b border-border p-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 p-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A compact metric/stat card placeholder. */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 shadow-sm', className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  );
}

/**
 * A generic section-body placeholder: a row of stats above a couple of cards.
 * Used as the default streamed fallback for shell route bodies so navigation
 * paints an on-brand skeleton instantly while the real data loads.
 */
export function SectionBodySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-5xl space-y-6 p-6', className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>
      <SkeletonCard lines={4} />
      <SkeletonCard lines={2} />
    </div>
  );
}
