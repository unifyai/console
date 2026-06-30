'use client';

import * as React from 'react';
import { TabHeader } from '@/components/Pages/Assistants/Rail/TabHeader';
import { SHELL_SECTIONS, type ShellSectionId } from './shellSections';
import { SettingsShell } from './SettingsShell';

interface ShellSectionPageProps {
  /** Section identifier; the descriptor (incl. its icon) is resolved client-side. */
  sectionId: ShellSectionId;
  children: React.ReactNode;
  /** Optional per-section controls rendered before the global actions. */
  headerRight?: React.ReactNode;
  /** When true, the body fills the remaining height and owns its own scroll
   *  (for height-filling surfaces); otherwise the wrapper scrolls. */
  fill?: boolean;
}

/**
 * Settings-family sections render inside the shared SettingsShell so the
 * Account + Workspace sub-rail persists across these routes. Other sections
 * (e.g. favourites) keep the plain header-over-body layout.
 */
const SETTINGS_FAMILY_SECTIONS: ReadonlySet<ShellSectionId> = new Set([
  'settings',
  'organizations',
  'usage',
  'billing',
]);

/**
 * A home-route page hosted in the rail shell: the brand section header (icon,
 * title, guided steps, global actions) above the route body. Lets each migrated
 * route render its existing content beneath a consistent header.
 *
 * Server pages pass a serializable `sectionId`; the section descriptor (which
 * carries a non-serializable icon component) is resolved here on the client so
 * the icon never crosses the RSC boundary.
 */
export function ShellSectionPage({
  sectionId,
  children,
  headerRight,
  fill = false,
}: ShellSectionPageProps) {
  if (SETTINGS_FAMILY_SECTIONS.has(sectionId)) {
    return (
      <SettingsShell sectionId={sectionId} headerRight={headerRight} fill={fill}>
        {children}
      </SettingsShell>
    );
  }

  const section = SHELL_SECTIONS[sectionId];
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <TabHeader section={section} right={headerRight} />
      <div
        className={
          fill ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'min-h-0 flex-1 overflow-y-auto'
        }
      >
        {children}
      </div>
    </div>
  );
}
