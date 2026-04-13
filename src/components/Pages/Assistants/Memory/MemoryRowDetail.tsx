'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/UI/sheet';
import { ScrollArea } from '@/components/UI/scroll-area';
import { formatDetailValue, MEMORY_CONTEXT_LABELS } from '@/utils/assistants/memory';
import type { MemoryContext } from '@/types/assistants/memory';

interface MemoryRowDetailProps {
  row: Record<string, unknown> | null;
  context: MemoryContext;
  onClose: () => void;
}

export function MemoryRowDetail({ row, context, onClose }: MemoryRowDetailProps) {
  const [snapshot, setSnapshot] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    if (row) setSnapshot(row);
  }, [row]);

  const displayRow = row ?? snapshot;

  const entries = React.useMemo(
    () =>
      displayRow
        ? Object.entries(displayRow).filter(
            ([k, v]) => v !== null && v !== undefined && v !== '' && !k.startsWith('_')
          )
        : [],
    [displayRow]
  );

  return (
    <Sheet
      open={!!row}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-md"
        data-testid="memory-row-detail"
        onAnimationEnd={() => {
          if (!row) setSnapshot(null);
        }}
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>{MEMORY_CONTEXT_LABELS[context]} Detail</SheetTitle>
          <SheetDescription>
            {entries.length} {entries.length === 1 ? 'field' : 'fields'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-4 min-h-0 flex-1">
          <dl className="space-y-3 pr-4" data-testid="memory-row-detail-fields">
            {entries.map(([key, value]) => (
              <div key={key} className="group">
                <dt className="text-label-muted">{key}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                  {formatDetailValue(key, value)}
                </dd>
              </div>
            ))}
          </dl>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
