'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { UnifyBlockMark } from '@/components/Brand';
import { ScrollArea } from '@/components/UI/scroll-area';
import { RailNavButton } from '@/components/Pages/Assistants/Rail/RailNavButton';
import { RailFoot } from '@/components/Pages/Assistants/Rail/RailFoot';
import {
  WORKSPACE_SECTIONS,
  BRAIN_SECTIONS,
  sectionAppliesTo,
  type SectionDef,
  type SelectorEntityKind,
} from '@/components/Pages/Assistants/Rail/sectionConfig';

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
  sectionActivity?: Partial<Record<string, boolean>>;
  /**
   * The kind of entity currently selected in the switcher. Sections that do
   * not apply to it (e.g. Guidance/Functions for a human) are hidden.
   */
  entityKind?: SelectorEntityKind;
}

/**
 * The shared left rail: brand mark, a pluggable unity switcher, the
 * Workspace/Brain section nav, and the account/settings foot. Used by both the
 * assistants surface (with the full unity switcher + in-page section state) and
 * the global home shell (with a lightweight switcher + route-based nav).
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
  const workspaceSections = WORKSPACE_SECTIONS.filter((s) => sectionAppliesTo(s, entityKind));
  const brainSections = BRAIN_SECTIONS.filter((s) => sectionAppliesTo(s, entityKind));
  const renderSection = (s: SectionDef) => (
    <RailNavButton
      key={s.id}
      Icon={s.Icon}
      label={s.label}
      collapsed={collapsed}
      active={activeSection === s.id}
      showActivityDot={activeSection !== s.id && sectionActivity?.[s.id] === true}
      onClick={() => onSelectSection(s)}
      testId={`rail-section-${s.id}`}
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
          {!collapsed && (
            <div className="whitespace-nowrap px-3 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Workspace
            </div>
          )}
          {workspaceSections.map(renderSection)}
          {brainSections.length > 0 &&
            (collapsed ? (
              <div className="mx-1.5 my-2 h-px bg-border" />
            ) : (
              <div className="whitespace-nowrap px-3 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Storage
              </div>
            ))}
          {brainSections.map(renderSection)}
        </div>
      </ScrollArea>

      <RailFoot collapsed={collapsed} onToggleCollapse={() => onCollapsedChange(!collapsed)} />
    </aside>
  );
}
