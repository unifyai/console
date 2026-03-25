import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/UI/input';
import { Button } from '@/components/UI/button';
import { Skeleton } from '@/components/UI/skeleton';
import { cn } from '@/lib/utils';
import Fuse from 'fuse.js';
import { Icon, IconName } from '@/components/UI/icon-picker';
import { iconsData } from '@/components/UI/icons-data';
import { useDebounceValue } from 'usehooks-ts';
import { useVirtualizer } from '@tanstack/react-virtual';

interface IconSelectorProps {
  value?: IconName;
  onValueChange?: (val: IconName) => void;
  searchable?: boolean;
}

const IconsSkeleton = () => (
  <div className="grid w-full grid-cols-6 gap-2">
    {Array.from({ length: 48 }).map((_, i) => (
      <Skeleton key={i} className="h-10 w-10 rounded-md" />
    ))}
  </div>
);

export const IconSelector: React.FC<IconSelectorProps> = ({
  value,
  onValueChange,
  searchable = true,
}) => {
  const [rawSearch, setRawSearch] = useState('');
  const [search] = useDebounceValue(rawSearch, 150);
  const [isLoading, setIsLoading] = useState(false);

  // In real use we could lazy-load, but iconsData is already static import
  const iconsToUse = useMemo(() => iconsData, []);

  const fuseInstance = useMemo(() => {
    return new Fuse(iconsToUse, {
      keys: ['name', 'tags', 'categories'],
      threshold: 0.3,
      ignoreLocation: true,
      includeScore: true,
    });
  }, [iconsToUse]);

  const filteredIcons = useMemo(() => {
    if (search.trim() === '') return iconsToUse;
    return fuseInstance.search(search.trim().toLowerCase()).map((r) => r.item);
  }, [search, fuseInstance, iconsToUse]);

  const parentRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState<number>(6);

  // Measure columns responsively based on container width
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const width = el.clientWidth || 360;
      // Target 48px cells with ~8px gap
      const nextCols = Math.max(4, Math.min(10, Math.floor(width / 56)));
      setCols(nextCols);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Virtualization (row-based grid)
  const rowCount = useMemo(
    () => Math.ceil(filteredIcons.length / cols),
    [filteredIcons.length, cols]
  );
  const EST_ROW_HEIGHT = 48 + 8; // icon button size + gap
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => EST_ROW_HEIGHT,
    overscan: 6,
  });

  // Render helpers
  const renderIconButton = useCallback(
    (iconName: IconName) => (
      <button
        key={iconName}
        className={cn(
          'flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border p-2 transition',
          value === iconName ? 'border-primary bg-accent' : 'hover:bg-foreground/10'
        )}
        data-icon={iconName}
        title={iconName}
        onClick={() => onValueChange?.(iconName)}
      >
        <Suspense fallback={<Skeleton className="h-5 w-5 rounded" />}>
          <Icon name={iconName} />
        </Suspense>
      </button>
    ),
    [onValueChange, value]
  );

  useEffect(() => {
    // Small artificial delay so the skeleton flashes only briefly
    setIsLoading(true);
    const t = setTimeout(() => setIsLoading(false), 150);
    return () => clearTimeout(t);
  }, []);

  // Scroll to selected icon on mount / value change
  useEffect(() => {
    if (!parentRef.current || !value) return;
    const idx = filteredIcons.findIndex((i) => i.name === value);
    if (idx >= 0) {
      const row = Math.floor(idx / cols);
      rowVirtualizer.scrollToIndex(row, { align: 'center' });
    }
  }, [value, isLoading, filteredIcons, cols, rowVirtualizer]);

  return (
    <div className="w-full space-y-2">
      {searchable && (
        <Input
          placeholder="Search for an icon…"
          value={rawSearch}
          onChange={(e) => setRawSearch(e.target.value)}
        />
      )}
      <div ref={parentRef} className="command-scrollbar max-h-60 overflow-auto pr-1">
        {isLoading ? (
          <IconsSkeleton />
        ) : filteredIcons.length === 0 ? (
          <div className="text-caption py-6 text-center text-muted-foreground">No icons found</div>
        ) : (
          <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const startIndex = vi.index * cols;
              const endIndex = Math.min(startIndex + cols, filteredIcons.length);
              return (
                <div
                  key={vi.key}
                  className="absolute left-0 right-0 grid gap-2"
                  style={{
                    top: vi.start,
                    height: vi.size,
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  }}
                >
                  {filteredIcons
                    .slice(startIndex, endIndex)
                    .map((ic) => renderIconButton(ic.name as IconName))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
