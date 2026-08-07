'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Code2, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/UI/scroll-area';
import { cn } from '@/lib/utils';
import { docstringPreview } from '@/utils/assistants/functionDoc';
import {
  FUNCTIONS_GRID_CLASS,
  readAutoFillGridColumnCount,
} from '@/utils/assistants/functionsGrid';
import { shortSignature, type FunctionEntry } from '@/utils/assistants/functions';
import { KindBadge } from './FunctionDetail';

const CARD_ROW_GAP_PX = 16;
const GRID_EDGE_PADDING_PX = 16;
const ESTIMATED_CARD_HEIGHT_PX = 168;
const LOAD_MORE_ROW_THRESHOLD = 3;
const COLUMN_PROBE_SLOTS = 32;

function FunctionCard({
  fn,
  onSelect,
}: {
  fn: FunctionEntry;
  onSelect: (fn: FunctionEntry) => void;
}) {
  return (
    <button
      type="button"
      className="hover:bg-muted/40 flex min-h-[168px] w-full min-w-0 flex-col gap-2 rounded-[13px] border bg-card p-3.5 text-left transition-colors hover:border-primary-tint-40"
      onClick={() => onSelect(fn)}
      data-testid={`function-card-${fn.name}`}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground">
          <Code2 className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-semibold text-foreground">
          {fn.name}
        </div>
        <KindBadge isPrimitive={fn.isPrimitive} />
      </div>

      {fn.argspec ? (
        <div className="truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
          {shortSignature(fn)}
        </div>
      ) : null}

      <p className="text-foreground/80 line-clamp-2 flex-1 text-[12px] leading-relaxed">
        {docstringPreview(fn.docstring) || 'No description.'}
      </p>

      <div className="mt-auto flex items-center gap-2.5 pt-0.5">
        <span className="text-[10.5px] text-muted-foreground">{fn.language}</span>
        {fn.dependsOn.length > 0 ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-medium text-accent-soft-foreground">
            {fn.dependsOn.length} dep{fn.dependsOn.length !== 1 ? 's' : ''}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function FunctionsVirtualGrid({
  functions,
  hasMore,
  isLoadingMore,
  onEndReached,
  onSelect,
}: {
  functions: FunctionEntry[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onEndReached?: () => void;
  onSelect: (fn: FunctionEntry) => void;
}) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const columnProbeRef = React.useRef<HTMLDivElement>(null);
  const onEndReachedRef = React.useRef(onEndReached);
  onEndReachedRef.current = onEndReached;
  const [columns, setColumns] = React.useState(1);

  React.useEffect(() => {
    const viewport = parentRef.current;
    const probe = columnProbeRef.current;
    if (!viewport || !probe) return;

    const updateColumns = () => {
      probe.style.width = `${viewport.clientWidth}px`;
      setColumns(readAutoFillGridColumnCount(probe));
    };

    updateColumns();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateColumns);
      return () => window.removeEventListener('resize', updateColumns);
    }
    const observer = new ResizeObserver(updateColumns);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(functions.length / Math.max(columns, 1));
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT_PX + CARD_ROW_GAP_PX,
    measureElement:
      typeof window !== 'undefined' && !navigator.userAgent.includes('Firefox')
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: 5,
    paddingEnd: GRID_EDGE_PADDING_PX,
    paddingStart: GRID_EDGE_PADDING_PX,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const lastVirtualRow = virtualRows[virtualRows.length - 1];

  const requestLoadMore = React.useCallback(() => {
    if (!hasMore || isLoadingMore || !onEndReachedRef.current) return;
    void onEndReachedRef.current();
  }, [hasMore, isLoadingMore]);

  React.useEffect(() => {
    if (!hasMore || isLoadingMore || !lastVirtualRow || rowCount === 0) return;
    if (lastVirtualRow.index >= rowCount - LOAD_MORE_ROW_THRESHOLD) {
      requestLoadMore();
    }
  }, [hasMore, isLoadingMore, lastVirtualRow, requestLoadMore, rowCount]);

  React.useEffect(() => {
    const root = parentRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          requestLoadMore();
        }
      },
      { root, rootMargin: '240px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, requestLoadMore, functions.length]);

  return (
    <>
      <div
        ref={columnProbeRef}
        className={FUNCTIONS_GRID_CLASS}
        aria-hidden
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
          height: 0,
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: COLUMN_PROBE_SLOTS }).map((_, index) => (
          <div key={index} aria-hidden />
        ))}
      </div>
      <ScrollArea
        className="h-full w-full min-w-0"
        viewportClassName="min-w-0 max-w-full"
        viewportRef={parentRef}
        viewportTestId="functions-virtual-list"
      >
        <div
          className="relative w-full min-w-0"
          style={{
            height: rowVirtualizer.getTotalSize(),
          }}
        >
          {virtualRows.map((virtualRow) => {
            const startIndex = virtualRow.index * columns;
            const rowFunctions = functions.slice(startIndex, startIndex + columns);
            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                className="absolute left-0 right-0 grid gap-4 px-4"
                data-index={virtualRow.index}
                data-testid="functions-virtual-row"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  minHeight: ESTIMATED_CARD_HEIGHT_PX + CARD_ROW_GAP_PX,
                  paddingBottom: CARD_ROW_GAP_PX,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {rowFunctions.map((fn) => (
                  <FunctionCard
                    key={`${fn.isPrimitive ? 'p' : 'l'}-${fn.functionId ?? fn.name}`}
                    fn={fn}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            );
          })}
        </div>
        <div ref={sentinelRef} className="h-px w-full" aria-hidden />
        {isLoadingMore ? (
          <div
            className="text-body-muted flex items-center justify-center gap-2 py-4"
            data-testid="functions-virtual-list-loading"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more functions…
          </div>
        ) : null}
      </ScrollArea>
    </>
  );
}
