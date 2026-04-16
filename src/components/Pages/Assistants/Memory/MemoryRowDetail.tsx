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
import {
  buildTaskDetailSections,
  formatDetailValue,
  MEMORY_CONTEXT_LABELS,
} from '@/utils/assistants/memory';
import type { MemoryContext, TaskMemoryView } from '@/types/assistants/memory';

const TASK_DETAIL_DESCRIPTIONS: Record<TaskMemoryView, string> = {
  Definitions: 'Configured task details first, with technical metadata kept secondary.',
  Activations: 'Queued task state, trigger conditions, and projection metadata.',
  Runs: 'Execution details, source context, and supporting run metadata.',
};

interface MemoryRowDetailProps {
  row: Record<string, unknown> | null;
  context: MemoryContext;
  taskView?: TaskMemoryView;
  title?: string;
  onClose: () => void;
}

export function MemoryRowDetail({ row, context, taskView, title, onClose }: MemoryRowDetailProps) {
  const [snapshot, setSnapshot] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    if (row) setSnapshot(row);
  }, [row]);

  const displayRow = row ?? snapshot;
  const sections = React.useMemo(() => {
    if (!displayRow) return [];
    if (context === 'Tasks') return buildTaskDetailSections(displayRow);
    return [
      {
        title: 'Fields',
        items: Object.entries(displayRow)
          .filter(([key]) => !key.startsWith('_'))
          .map(([key, value]) => ({
            key,
            label: key,
            value,
          })),
      },
    ];
  }, [context, displayRow]);
  const totalFields = sections.reduce((sum, section) => sum + section.items.length, 0);
  const description =
    context === 'Tasks' && taskView
      ? TASK_DETAIL_DESCRIPTIONS[taskView]
      : `${totalFields} ${totalFields === 1 ? 'field' : 'fields'}`;

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
          <SheetTitle>{title ?? `${MEMORY_CONTEXT_LABELS[context]} Detail`}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-4 min-h-0 flex-1">
          <div className="space-y-5 pr-4" data-testid="memory-row-detail-fields">
            {sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-300">
                  {section.title}
                </h3>
                <dl className="space-y-3">
                  {section.items.map((item) => (
                    <div key={item.key} className="group">
                      <dt className="text-label-muted dark:text-slate-300">{item.label}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm dark:text-slate-100">
                        {formatDetailValue(item.key, item.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
