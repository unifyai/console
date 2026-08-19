'use client';

import * as React from 'react';
import { MoreHorizontal, Pin, SlidersHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { cn } from '@/lib/utils';
import { RailNavButton } from './RailNavButton';
import { SECTION_GROUPS, type SectionDef } from './sectionConfig';
import type { SectionActivityMap } from '@/types/shell/rail';

interface RailMoreMenuProps {
  hidden: SectionDef[];
  activity?: SectionActivityMap;
  collapsed: boolean;
  moreActivity: boolean;
  hiddenActivityCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSection: (section: SectionDef) => void;
  onPin: (sectionId: string) => void;
  onCustomize: () => void;
}

/**
 * The rail's overflow. Present in every rail state — expanded, folded to a
 * dock, and inside the mobile drawer — which is what lets the customize editor
 * hang off it rather than off the group headings the dock throws away.
 *
 * Its dot reports only hidden sections that activity did not already pull back
 * into the rail, so seeing it always means there is something you cannot see.
 */
export function RailMoreMenu({
  hidden,
  activity,
  collapsed,
  moreActivity,
  hiddenActivityCount,
  open,
  onOpenChange,
  onSelectSection,
  onPin,
  onCustomize,
}: RailMoreMenuProps) {
  const grouped = SECTION_GROUPS.map((group) => ({
    label: group.label,
    sections: hidden.filter((s) => group.sections.some((g) => g.id === s.id)),
  })).filter((group) => group.sections.length > 0);

  const activityNote = moreActivity ? `, ${hiddenActivityCount} with new activity` : '';

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <div>
          <RailNavButton
            Icon={MoreHorizontal}
            label="More"
            collapsed={collapsed}
            activity={moreActivity ? { active: true } : undefined}
            testId="rail-section-more"
          />
          <span className="sr-only">{`More sections${activityNote}`}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? 'right' : 'top'}
        align="start"
        className="w-56"
        data-testid="rail-more-menu"
      >
        {grouped.map((group) => (
          <React.Fragment key={group.label}>
            <DropdownMenuLabel className="text-overline">{group.label}</DropdownMenuLabel>
            {group.sections.map((section) => {
              const sectionActivity = activity?.[section.id];
              return (
                <DropdownMenuItem
                  key={section.id}
                  onSelect={() => onSelectSection(section)}
                  data-testid={`rail-more-item-${section.id}`}
                  className="group/more gap-2"
                >
                  <section.Icon
                    className="h-4 w-4 shrink-0"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="truncate">{section.label}</span>
                  {sectionActivity?.active === true && (
                    <span
                      className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary ring-1 ring-primary-tint-30"
                      aria-hidden="true"
                      data-testid={`rail-more-item-${section.id}-activity-dot`}
                    />
                  )}
                  <button
                    type="button"
                    aria-label={`Pin ${section.label}`}
                    data-testid={`rail-more-pin-${section.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onPin(section.id);
                    }}
                    className={cn(
                      'grid h-5 w-5 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/more:opacity-100',
                      sectionActivity?.active === true ? 'ml-1.5' : 'ml-auto'
                    )}
                  >
                    <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </DropdownMenuItem>
              );
            })}
          </React.Fragment>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onCustomize}
          data-testid="rail-more-customize"
          className="gap-2"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
          Customize rail…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
