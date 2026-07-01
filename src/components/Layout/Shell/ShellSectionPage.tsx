'use client';

import * as React from 'react';
import { TabHeader } from '@/components/Pages/Assistants/Rail/TabHeader';
import { SHELL_SECTIONS, type ShellSectionId } from './shellSections';

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
 * A home-route page hosted in the rail shell: the brand section header (icon,
 * title, guided steps, global actions) above the route body. Lets each migrated
 * route render its existing content beneath a consistent header.
 *
 * Settings-family routes (`/account`, `/organizations`, `/usage`, `/billing`)
 * mount the shared shell in `app/(home)/(settings)/layout.tsx` instead.
 */
export function ShellSectionPage({
  sectionId,
  children,
  headerRight,
  fill = false,
}: ShellSectionPageProps) {
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
