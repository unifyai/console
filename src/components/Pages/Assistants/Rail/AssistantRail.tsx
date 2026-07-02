'use client';

import * as React from 'react';
import { AppRail, RAIL_COLLAPSED_STORAGE_KEY } from '@/components/Layout/Shell/AppRail';
import { AssistantSwitcher } from '@/components/Layout/Shell/AssistantSwitcher';
import type { Assistant } from '@/types/assistants/assistant';
import { AssistantList } from '@/components/Pages/Assistants/List/AssistantList';
import type { SectionDef } from './sectionConfig';

interface AssistantRailProps {
  /** Currently-open unity; drives the switcher card face. */
  activeUnity: Assistant | null;
  /** Full prop bag forwarded to the embedded `AssistantList` (the switcher). */
  listProps: React.ComponentProps<typeof AssistantList>;
  /** The active rail section id (a `SectionDef.id`). */
  activeSection: string;
  onSelectSection: (section: SectionDef) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onBrandClick?: () => void;
}

/**
 * The assistants-surface rail: the shared `AppRail` driven by the full unity
 * switcher (popover + `AssistantList`) and the page's in-page section state.
 */
export function AssistantRail({
  activeUnity,
  listProps,
  activeSection,
  onSelectSection,
  collapsed,
  onCollapsedChange,
  onBrandClick,
}: AssistantRailProps) {
  return (
    <AppRail
      activeSection={activeSection}
      onSelectSection={onSelectSection}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      onBrandClick={onBrandClick}
      switcher={
        <AssistantSwitcher activeUnity={activeUnity} listProps={listProps} collapsed={collapsed} />
      }
    />
  );
}

export { RAIL_COLLAPSED_STORAGE_KEY };
