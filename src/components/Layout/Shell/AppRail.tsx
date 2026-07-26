'use client';

import * as React from 'react';
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

interface AppRailProps {
  /** The unity switcher block (brand-area). Differs per surface. */
  switcher: React.ReactNode;
  /** The active Workspace/Brain section id, or `null` when none applies (e.g.
   *  the Settings surface, whose active nav lives in the rail foot). */
  activeSection: string | null;
  onSelectSection: (section: SectionDef) => void;
  onBrandClick?: () => void;
  sectionActivity?: Partial<Record<string, boolean>>;
  /**
   * The kind of entity currently selected in the switcher. Sections that do
   * not apply to it (e.g. Guidance/Functions for a human) are hidden.
   */
  entityKind?: SelectorEntityKind;
}

/**
 * The shared left rail: brand mark, unity switcher, Workspace/Brain section
 * nav, and account/settings foot. Always icon-only with hover tooltips.
 */
export function AppRail({
  switcher,
  activeSection,
  onSelectSection,
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
      badge={s.badge}
      active={activeSection === s.id}
      showActivityDot={activeSection !== s.id && sectionActivity?.[s.id] === true}
      onClick={() => onSelectSection(s)}
      testId={`rail-section-${s.id}`}
    />
  );

  return (
    <aside
      data-testid="assistant-rail"
      className="flex h-full w-[74px] flex-col border-r border-border bg-background"
    >
      <div className="flex items-center justify-center pb-3.5 pt-[18px]">
        <button
          type="button"
          onClick={onBrandClick}
          aria-label="Unify Console home"
          data-testid="platform-home-button"
          className="flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UnifyBlockMark />
        </button>
      </div>

      {switcher}

      <ScrollArea className="min-h-0 flex-1" viewportClassName="overflow-x-hidden [&>div]:!block">
        <div className="px-2.5 pb-2">
          {workspaceSections.map(renderSection)}
          {brainSections.length > 0 && <div className="mx-1.5 my-2 h-px bg-border" />}
          {brainSections.map(renderSection)}
        </div>
      </ScrollArea>

      <RailFoot />
    </aside>
  );
}
