'use client';

import * as React from 'react';
import { AppRail, RAIL_COLLAPSED_STORAGE_KEY } from '@/components/Layout/Shell/AppRail';
import { AssistantSwitcher } from '@/components/Layout/Shell/AssistantSwitcher';
import type { Assistant } from '@/types/assistants/assistant';
import { AssistantList } from '@/components/Pages/Assistants/List/AssistantList';
import { CHAT_SECTION, type SectionDef, type SelectorEntityKind } from './sectionConfig';
import type { ActiveEntityFace } from '@/components/Layout/Shell/AssistantSwitcher';
import type { SectionActivityMap } from '@/types/shell/rail';

interface AssistantRailProps {
  /** Currently-open unity; drives the switcher card face. */
  activeUnity: Assistant | null;
  /** Non-assistant selection (human/team); overrides the switcher face. */
  activeEntityFace?: ActiveEntityFace | null;
  isInitialAssistantIdentityLoading?: boolean;
  /** Full prop bag forwarded to the embedded `AssistantList` (the switcher). */
  listProps: React.ComponentProps<typeof AssistantList>;
  /** The active rail section id (a `SectionDef.id`). */
  activeSection: string;
  sectionActivity?: SectionActivityMap;
  onSelectSection: (section: SectionDef) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onBrandClick?: () => void;
  /** Selected entity kind — filters which rail sections are shown. */
  entityKind?: SelectorEntityKind;
  /** Keep the switcher open while hire / create-group overlays are up. */
  nestedOverlayOpen?: boolean;
  /** Assistant currently on a live call; escalates that face's presence badge. */
  activeCallAssistantId?: string | null;
}

/**
 * The assistants-surface rail: the shared `AppRail` driven by the full unity
 * switcher (popover + `AssistantList`) and the page's in-page section state.
 */
export function AssistantRail({
  activeUnity,
  activeEntityFace = null,
  isInitialAssistantIdentityLoading = false,
  listProps,
  activeSection,
  sectionActivity,
  onSelectSection,
  collapsed,
  onCollapsedChange,
  onBrandClick,
  entityKind = 'assistant',
  nestedOverlayOpen = false,
  activeCallAssistantId = null,
}: AssistantRailProps) {
  const handleOpenChat = React.useCallback(() => {
    onSelectSection(CHAT_SECTION);
  }, [onSelectSection]);

  return (
    <AppRail
      activeSection={activeSection}
      sectionActivity={sectionActivity}
      onSelectSection={onSelectSection}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      onBrandClick={onBrandClick}
      entityKind={entityKind}
      switcher={
        <AssistantSwitcher
          activeUnity={activeUnity}
          activeEntityFace={activeEntityFace}
          isInitialAssistantIdentityLoading={isInitialAssistantIdentityLoading}
          listProps={listProps}
          nestedOverlayOpen={nestedOverlayOpen}
          collapsed={collapsed}
          onOpenChat={handleOpenChat}
          chatActive={activeSection === CHAT_SECTION.id}
          showChatActivity={
            activeSection !== CHAT_SECTION.id && sectionActivity?.[CHAT_SECTION.id]?.active === true
          }
          activeCallAssistantId={activeCallAssistantId}
        />
      }
    />
  );
}

export { RAIL_COLLAPSED_STORAGE_KEY };
