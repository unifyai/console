'use client';

import * as React from 'react';
import { MoreHorizontal, RotateCcw, SlidersHorizontal, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnifyBlockMark } from '@/components/Brand';
import { ScrollArea } from '@/components/UI/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { RailNavButton } from '@/components/Pages/Assistants/Rail/RailNavButton';
import { RailFoot } from '@/components/Pages/Assistants/Rail/RailFoot';
import { RailMoreMenu } from '@/components/Pages/Assistants/Rail/RailMoreMenu';
import { RailCustomizeSheet } from '@/components/Pages/Assistants/Rail/RailCustomizeSheet';
import {
  SECTION_GROUPS,
  type SectionDef,
  type SelectorEntityKind,
} from '@/components/Pages/Assistants/Rail/sectionConfig';
import { useRailConfig } from '@/hooks/Shell/useRailConfig';
import { useSurfacedSections } from '@/hooks/Shell/useSurfacedSections';
import { computeRailLayout, type RailLayoutGroup } from '@/utils/shell/railLayout';
import type { RailGroupId, SectionActivityMap } from '@/types/shell/rail';

export const RAIL_COLLAPSED_STORAGE_KEY = 'console:assistants:railCollapsed';

interface AppRailProps {
  /** The unity switcher block (brand-area). Differs per surface. */
  switcher: React.ReactNode;
  /** The active Workspace/Brain section id, or `null` when none applies (e.g.
   *  the Settings surface, whose active nav lives in the rail foot). */
  activeSection: string | null;
  onSelectSection: (section: SectionDef) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onBrandClick?: () => void;
  sectionActivity?: SectionActivityMap;
  /**
   * The kind of entity currently selected in the switcher. Sections that do
   * not apply to it (e.g. Guidance/Functions for a human) are hidden.
   */
  entityKind?: SelectorEntityKind;
}

interface RailGroupHeadingProps {
  group: RailLayoutGroup;
  onCustomize: () => void;
  onResetGroup: () => void;
  onUnpinGroup: () => void;
}

/**
 * A group heading and its shortcut menu. The menu is a convenience, never the
 * mechanism — headings are the first thing the folded dock drops, so every
 * action here is also reachable from the More menu and each section's own
 * context menu.
 */
function RailGroupHeading({
  group,
  onCustomize,
  onResetGroup,
  onUnpinGroup,
}: RailGroupHeadingProps) {
  return (
    <div className="group/heading flex items-center gap-1 whitespace-nowrap px-3 pb-1.5 pt-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {group.label}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Customize ${group.label}`}
            data-testid={`rail-group-menu-${group.id}`}
            className="ml-auto grid h-[18px] w-[18px] place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/heading:opacity-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onSelect={onCustomize} className="gap-2">
            <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
            Customize rail…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onUnpinGroup} className="gap-2">
            <PinOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            {`Unpin all in ${group.label}`}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onResetGroup} className="gap-2">
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
            {`Reset ${group.label}`}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * The shared left rail: brand mark, a pluggable unity switcher, the
 * Workspace/Brain section nav, and the account/settings foot. Used by both the
 * assistants surface (with the full unity switcher + in-page section state) and
 * the global home shell (with a lightweight switcher + route-based nav).
 *
 * The nav is three zones. Pinned sections render under their group headings;
 * unpinned sections the user should still see — ones with live activity, and
 * whichever section is open — are surfaced below a hairline; everything else
 * lives behind More.
 */
export function AppRail({
  switcher,
  activeSection,
  onSelectSection,
  collapsed,
  onCollapsedChange,
  onBrandClick,
  sectionActivity,
  entityKind = 'assistant',
}: AppRailProps) {
  const { config, setPinned, reorder, resetGroup, unpinAll, reset } = useRailConfig();
  const [customizeOpen, setCustomizeOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);

  const surfacedIds = useSurfacedSections({
    activity: sectionActivity,
    unpinned: config.unpinned,
    activeSectionId: activeSection,
    frozen: moreOpen || customizeOpen,
  });

  const layout = React.useMemo(
    () =>
      computeRailLayout({
        groups: SECTION_GROUPS,
        entityKind,
        config,
        activity: sectionActivity,
        activeSectionId: activeSection,
        surfacedIds,
      }),
    [entityKind, config, sectionActivity, activeSection, surfacedIds]
  );

  const openCustomize = React.useCallback(() => setCustomizeOpen(true), []);

  const groupSectionIds = React.useCallback(
    (groupId: RailGroupId) =>
      (SECTION_GROUPS.find((g) => g.id === groupId)?.sections ?? []).map((s) => s.id),
    []
  );

  const renderSection = (s: SectionDef, options?: { guest?: boolean }) => (
    <RailNavButton
      key={s.id}
      Icon={s.Icon}
      label={s.label}
      collapsed={collapsed}
      active={activeSection === s.id}
      activity={activeSection === s.id ? undefined : sectionActivity?.[s.id]}
      guest={options?.guest}
      onClick={() => onSelectSection(s)}
      testId={`rail-section-${s.id}`}
      pinControl={{
        pinned: !config.unpinned.includes(s.id),
        onTogglePin: () => setPinned(s.id, config.unpinned.includes(s.id)),
        onCustomize: openCustomize,
      }}
    />
  );

  return (
    <aside
      data-testid="assistant-rail"
      className={cn(
        'flex h-full flex-col border-r border-border bg-background transition-[width] duration-150',
        collapsed ? 'w-[74px]' : 'w-[258px]'
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex items-center gap-2 pb-3.5 pt-[18px]',
          collapsed ? 'justify-center px-0' : 'px-[18px]'
        )}
      >
        <button
          type="button"
          onClick={onBrandClick}
          aria-label="Unify Console home"
          data-testid="platform-home-button"
          className={cn(
            'flex items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'justify-center' : 'min-w-0'
          )}
        >
          <UnifyBlockMark />
          {!collapsed && (
            <span className="whitespace-nowrap font-display text-[18px] font-semibold tracking-tight">
              Unify
            </span>
          )}
        </button>
      </div>

      {switcher}

      {/* Collapsed, the switcher loses its card border and its label column, so
          the face and chevron would read as the first two nav glyphs. A rule
          mirroring the foot's restates the region boundary the card carried. */}
      {collapsed && <div className="mb-2 h-px bg-border" />}

      {/* Section nav */}
      <ScrollArea className="min-h-0 flex-1" viewportClassName="overflow-x-hidden [&>div]:!block">
        <div className="px-2.5 pb-2">
          {layout.groups.map((group, index) => (
            <React.Fragment key={group.id}>
              {collapsed
                ? index > 0 && <div className="mx-1.5 my-2 h-px bg-border" />
                : !collapsed && (
                    <RailGroupHeading
                      group={group}
                      onCustomize={openCustomize}
                      onResetGroup={() => resetGroup(group.id, groupSectionIds(group.id))}
                      onUnpinGroup={() => unpinAll(group.sections.map((s) => s.id))}
                    />
                  )}
              {group.sections.map((s) => renderSection(s))}
            </React.Fragment>
          ))}

          {layout.surfaced.length > 0 && (
            <div
              className="mx-1.5 my-2 border-t border-dashed border-border"
              data-testid="rail-surfaced-divider"
            />
          )}
          {layout.surfaced.map((s) => renderSection(s, { guest: true }))}

          {layout.hidden.length > 0 && (
            <>
              <div className="mx-1.5 my-2 h-px bg-border" />
              <RailMoreMenu
                hidden={layout.hidden}
                activity={sectionActivity}
                collapsed={collapsed}
                moreActivity={layout.moreActivity}
                hiddenActivityCount={layout.hiddenActivityCount}
                open={moreOpen}
                onOpenChange={setMoreOpen}
                onSelectSection={onSelectSection}
                onPin={(sectionId) => setPinned(sectionId, true)}
                onCustomize={openCustomize}
              />
            </>
          )}
        </div>
      </ScrollArea>

      <RailFoot collapsed={collapsed} onToggleCollapse={() => onCollapsedChange(!collapsed)} />

      <RailCustomizeSheet
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        entityKind={entityKind}
        config={config}
        onSetPinned={setPinned}
        onReorder={reorder}
        onReset={reset}
      />
    </aside>
  );
}
