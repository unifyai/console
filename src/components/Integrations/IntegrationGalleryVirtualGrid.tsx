'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/UI/scroll-area';
import { ProviderIntegrationCard } from './ProviderIntegrationCard';
import type { IntegrationGalleryItem } from '@/types/integrations';

const CARD_ROW_GAP_PX = 16;
const GRID_EDGE_PADDING_PX = 8;
const ESTIMATED_CARD_HEIGHT_PX = 214;
const LOAD_MORE_ROW_THRESHOLD = 3;

function columnsForWidth(width: number): number {
  if (width >= 1536) return 4;
  if (width >= 1280) return 3;
  if (width >= 768) return 2;
  return 1;
}

function IntegrationCardRow({
  items,
  columns,
  busySlug,
  onOpen,
  onPrimaryAction,
}: {
  items: IntegrationGalleryItem[];
  columns: number;
  busySlug?: string | null;
  onOpen: (item: IntegrationGalleryItem) => void;
  onPrimaryAction: (item: IntegrationGalleryItem) => void;
}) {
  return (
    <div
      className="grid gap-3"
      data-testid="integration-card-row"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <ProviderIntegrationCard
          key={`${item.source}:${item.id}`}
          item={item}
          busy={busySlug === item.canonicalSlug}
          onOpen={onOpen}
          onPrimaryAction={onPrimaryAction}
        />
      ))}
    </div>
  );
}

/** Static card grid — same column math as the virtual catalog list. */
export function IntegrationGalleryCardGrid({
  items,
  busySlug,
  onOpen,
  onPrimaryAction,
  className,
}: {
  items: IntegrationGalleryItem[];
  busySlug?: string | null;
  onOpen: (item: IntegrationGalleryItem) => void;
  onPrimaryAction: (item: IntegrationGalleryItem) => void;
  className?: string;
}) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [columns, setColumns] = React.useState(1);

  React.useEffect(() => {
    const element = parentRef.current;
    if (!element) return;
    const updateColumns = () => setColumns(columnsForWidth(element.clientWidth || 0));
    updateColumns();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateColumns);
      return () => window.removeEventListener('resize', updateColumns);
    }
    const observer = new ResizeObserver(updateColumns);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(items.length / columns);

  return (
    <div ref={parentRef} className={className ?? 'mx-2 flex flex-col gap-3'}>
      {Array.from({ length: rowCount }).map((_, rowIndex) => {
        const startIndex = rowIndex * columns;
        const rowItems = items.slice(startIndex, startIndex + columns);
        return (
          <IntegrationCardRow
            key={rowIndex}
            items={rowItems}
            columns={columns}
            busySlug={busySlug}
            onOpen={onOpen}
            onPrimaryAction={onPrimaryAction}
          />
        );
      })}
    </div>
  );
}

export function IntegrationGalleryVirtualGrid({
  items,
  busySlug,
  hasMore,
  isLoadingMore,
  onEndReached,
  onOpen,
  onPrimaryAction,
}: {
  items: IntegrationGalleryItem[];
  busySlug?: string | null;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onEndReached?: () => void;
  onOpen: (item: IntegrationGalleryItem) => void;
  onPrimaryAction: (item: IntegrationGalleryItem) => void;
}) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [columns, setColumns] = React.useState(1);

  React.useEffect(() => {
    const element = parentRef.current;
    if (!element) return;
    const updateColumns = () => setColumns(columnsForWidth(element.clientWidth || 0));
    updateColumns();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateColumns);
      return () => window.removeEventListener('resize', updateColumns);
    }
    const observer = new ResizeObserver(updateColumns);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(items.length / columns);
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

  React.useEffect(() => {
    if (!hasMore || isLoadingMore || !onEndReached || !lastVirtualRow) return;
    if (lastVirtualRow.index >= rowCount - LOAD_MORE_ROW_THRESHOLD) {
      onEndReached();
    }
  }, [hasMore, isLoadingMore, lastVirtualRow, onEndReached, rowCount]);

  return (
    <ScrollArea
      className="max-h-[min(72vh,900px)]"
      viewportClassName="max-h-[min(72vh,900px)]"
      viewportRef={parentRef}
      viewportTestId="integration-virtual-list"
    >
      <div
        className="relative mx-2"
        style={{
          height: rowVirtualizer.getTotalSize(),
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = items.slice(startIndex, startIndex + columns);
          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              className="absolute left-0 right-0"
              data-index={virtualRow.index}
              data-testid="integration-virtual-row"
              style={{
                minHeight: ESTIMATED_CARD_HEIGHT_PX + CARD_ROW_GAP_PX,
                paddingBottom: CARD_ROW_GAP_PX,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <IntegrationCardRow
                items={rowItems}
                columns={columns}
                busySlug={busySlug}
                onOpen={onOpen}
                onPrimaryAction={onPrimaryAction}
              />
            </div>
          );
        })}
      </div>
      {isLoadingMore && (
        <div
          className="text-body-muted flex items-center justify-center gap-2 py-4"
          data-testid="integration-virtual-list-loading"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading more integrations...
        </div>
      )}
    </ScrollArea>
  );
}
