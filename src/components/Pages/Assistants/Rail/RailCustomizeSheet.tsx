'use client';

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/UI/sheet';
import { Switch } from '@/components/UI/switch';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import {
  SECTION_GROUPS,
  sectionAppliesTo,
  type SectionDef,
  type SelectorEntityKind,
} from './sectionConfig';
import type { RailConfig, RailGroupId } from '@/types/shell/rail';

interface RailCustomizeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityKind: SelectorEntityKind;
  config: RailConfig;
  onSetPinned: (sectionId: string, pinned: boolean) => void;
  onReorder: (groupId: RailGroupId, orderedIds: string[]) => void;
  onReset: () => void;
}

interface SortableSectionRowProps {
  section: SectionDef;
  pinned: boolean;
  onSetPinned: (sectionId: string, pinned: boolean) => void;
}

/**
 * One editable section. The grip is the only drag origin so the list still
 * scrolls normally under a finger in the mobile drawer.
 */
function SortableSectionRow({ section, pinned, onSetPinned }: SortableSectionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-muted',
        isDragging && 'z-10 bg-muted shadow-pop'
      )}
      data-testid={`rail-customize-row-${section.id}`}
    >
      <button
        type="button"
        aria-label={`Reorder ${section.label}`}
        data-testid={`rail-customize-grip-${section.id}`}
        className="cursor-grab touch-none rounded-md p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <section.Icon
        className={cn('h-4 w-4 shrink-0', pinned ? 'text-foreground' : 'text-muted-foreground')}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[13px]',
          pinned ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {section.label}
      </span>
      <Switch
        checked={pinned}
        onCheckedChange={(next) => onSetPinned(section.id, next)}
        aria-label={`${pinned ? 'Unpin' : 'Pin'} ${section.label}`}
        data-testid={`rail-customize-toggle-${section.id}`}
      />
    </div>
  );
}

/**
 * The canonical pin control: every section, a pin toggle each, and drag or
 * keyboard reordering within a group. Reached from the More menu, the group
 * headings, and any section's context menu — so it is available identically in
 * the expanded rail, the folded dock, and the mobile drawer.
 */
export function RailCustomizeSheet({
  open,
  onOpenChange,
  entityKind,
  config,
  onSetPinned,
  onReorder,
  onReset,
}: RailCustomizeSheetProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const groups = SECTION_GROUPS.map((group) => {
    const applicable = group.sections.filter((s) => sectionAppliesTo(s, entityKind));
    const order = config.order[group.id];
    if (!order || order.length === 0) return { ...group, sections: applicable };
    const rank = new Map(order.map((id, index) => [id, index]));
    const known = applicable.filter((s) => rank.has(s.id));
    known.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    return { ...group, sections: [...known, ...applicable.filter((s) => !rank.has(s.id))] };
  }).filter((group) => group.sections.length > 0);

  const handleDragEnd = (groupId: RailGroupId, sections: SectionDef[]) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    const ids = sections.map((s) => s.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorder(groupId, next);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[min(100vw,360px)] flex-col gap-0 p-0">
        <SheetHeader className="space-y-1 border-b border-border p-5 text-left">
          <SheetTitle className="text-h2">Customize rail</SheetTitle>
          <SheetDescription className="text-caption">
            Pinned sections stay in the rail. The rest live under More.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-3" data-testid="rail-customize-list">
            {groups.map((group) => (
              <div key={group.id} className="pb-2">
                <div className="px-2 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {group.label}
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis]}
                  onDragEnd={handleDragEnd(group.id, [...group.sections])}
                >
                  <SortableContext
                    items={group.sections.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {group.sections.map((section) => (
                      <SortableSectionRow
                        key={section.id}
                        section={section}
                        pinned={!config.unpinned.includes(section.id)}
                        onSetPinned={onSetPinned}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center gap-3 border-t border-border p-4">
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            data-testid="rail-customize-reset"
          >
            Reset to default
          </Button>
          <span className="text-caption">Drag to reorder within a group.</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
