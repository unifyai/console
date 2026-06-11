'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';
import { ProviderIntegrationCard } from './ProviderIntegrationCard';
import type { IntegrationGalleryItem } from '@/types/integrations';

const CARD_GAP_PX = 12;
const ESTIMATED_CARD_HEIGHT_PX = 214;
const LOAD_MORE_ROW_THRESHOLD = 3;

function columnsForWidth(width: number): number {
  if (width >= 1536) return 4;
  if (width >= 1280) return 3;
  if (width >= 768) return 2;
  return 1;
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
    estimateSize: () => ESTIMATED_CARD_HEIGHT_PX + CARD_GAP_PX,
    overscan: 5,
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
    <div
      ref={parentRef}
      className="max-h-[min(72vh,900px)] overflow-auto pr-1"
      data-testid="integration-virtual-list"
    >
      <div
        className="relative w-full"
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
              className="absolute left-0 right-0 grid gap-3"
              data-testid="integration-virtual-row"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                minHeight: ESTIMATED_CARD_HEIGHT_PX,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {rowItems.map((item) => (
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
    </div>
  );
}
