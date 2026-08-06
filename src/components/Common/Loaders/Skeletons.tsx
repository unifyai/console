import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/UI/skeleton';

/**
 * Shared skeleton building blocks. Every loading placeholder should compose
 * these so the loading experience is visually consistent across routes, panels,
 * tables and lists: one shimmer animation via the canonical `Skeleton` atom.
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
    <div
      className={cn('mx-auto w-full max-w-5xl space-y-6 p-6', className)}
      data-testid="section-body-skeleton"
    >
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

function ChatPaneSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="min-h-0 flex-1 space-y-5 overflow-hidden px-6 py-5">
        <div className="mr-auto max-w-[72%] rounded-2xl border border-border bg-card p-4">
          <Skeleton className="mb-3 h-4 w-40" />
          <SkeletonText lines={3} lastLineWidth="45%" />
        </div>
        <div className="ml-auto max-w-[66%] rounded-2xl border border-border bg-accent-soft p-4">
          <Skeleton className="mb-3 h-4 w-32" />
          <SkeletonText lines={2} lastLineWidth="55%" />
        </div>
        <div className="mr-auto max-w-[78%] rounded-2xl border border-border bg-card p-4">
          <Skeleton className="mb-3 h-4 w-52" />
          <SkeletonText lines={4} lastLineWidth="35%" />
        </div>
      </div>
      <div className="border-t border-border bg-card p-4">
        <div className="flex items-end gap-3 rounded-2xl border border-border bg-background p-3">
          <Skeleton className="h-9 flex-1 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function TasksPaneSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card p-3">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="ml-auto h-9 w-28 rounded-xl" />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactsPaneSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card p-3">
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3 overflow-hidden p-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <SkeletonCard key={index} lines={2} />
        ))}
      </div>
    </div>
  );
}

function FunctionsPaneSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card p-3">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="ml-auto h-9 w-64 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 overflow-hidden p-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <SkeletonCard key={index} lines={2} />
        ))}
      </div>
    </div>
  );
}

function DataPaneSkeleton() {
  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      <div className="w-72 shrink-0 border-r border-border bg-card p-3">
        <Skeleton className="mb-3 h-9 rounded-xl" />
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="mb-2 h-8 rounded-lg" />
        ))}
      </div>
      <div className="min-w-0 flex-1 p-4">
        <Skeleton className="mb-4 h-8 w-64" />
        <SkeletonTable rows={8} cols={5} />
      </div>
    </div>
  );
}

function TranscriptsPaneSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card p-3">
        <Skeleton className="h-9 w-56 rounded-xl" />
        <Skeleton className="ml-auto h-9 w-64 rounded-xl" />
      </div>
      <TabSplitSkeleton className="min-h-0 flex-1" listRows={8} />
    </div>
  );
}

export function AssistantSectionSkeleton({
  sectionId,
  className,
}: {
  sectionId: string;
  className?: string;
}) {
  const body = (() => {
    switch (sectionId) {
      case 'chat':
        return <ChatPaneSkeleton />;
      case 'actions':
        return (
          <div className="space-y-2 overflow-hidden p-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <ActionCardSkeleton key={index} />
            ))}
          </div>
        );
      case 'dashboards':
        return <DashboardGridSkeleton className="h-full overflow-hidden" />;
      case 'tasks':
        return <TasksPaneSkeleton />;
      case 'workflows':
        return <IntegrationGridSkeleton className="m-4" />;
      case 'integrations':
        return <IntegrationGridSkeleton className="m-4" />;
      case 'contacts':
        return <ContactsPaneSkeleton />;
      case 'transcripts':
        return <TranscriptsPaneSkeleton />;
      case 'knowledge':
      case 'guidance':
        return <TabSplitSkeleton className="h-full" listRows={7} />;
      case 'functions':
        return <FunctionsPaneSkeleton />;
      case 'data':
        return <DataPaneSkeleton />;
      default:
        return <SectionBodySkeleton className="h-full" />;
    }
  })();

  return (
    <div
      className={cn('h-full min-h-0 bg-background', className)}
      data-testid="assistant-section-skeleton"
    >
      {body}
    </div>
  );
}

/** Skeleton row matching a collapsed Actions tab card. */
export function ActionCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm',
        className
      )}
    >
      <Skeleton className="h-[26px] w-[26px] shrink-0 rounded-lg" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-5 w-12 rounded-full" />
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-5 w-10 rounded-md" />
    </div>
  );
}

/** List + reader split used by Guidance, Knowledge, Transcripts, etc. */
export function TabSplitSkeleton({
  className,
  listRows = 6,
}: {
  className?: string;
  listRows?: number;
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 overflow-hidden', className)}>
      <div className="flex w-72 shrink-0 flex-col gap-2 border-r border-border p-3">
        {Array.from({ length: listRows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-3 p-6">
        <Skeleton className="h-7 w-1/2" />
        <SkeletonText lines={5} />
      </div>
    </div>
  );
}

/** Integration gallery grid placeholder. */
export function IntegrationGridSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-muted/20 grid min-h-[260px] grid-cols-1 gap-3 rounded-xl border border-dashed p-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
        className
      )}
      data-testid="integration-gallery-skeleton"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <Skeleton className="mt-4 h-8 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Dashboard grid placeholder. */
export function DashboardGridSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 p-3 md:grid-cols-2', className)}>
      <Skeleton className="col-span-1 h-40 rounded-xl md:col-span-2" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-48 rounded-xl md:col-span-2" />
    </div>
  );
}
