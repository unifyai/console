import * as React from 'react';
import { TabHeader } from '@/components/Pages/Assistants/Rail/TabHeader';
import type { SectionDef } from '@/components/Pages/Assistants/Rail/sectionConfig';

interface ShellSectionPageProps {
  section: SectionDef;
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
 */
export function ShellSectionPage({
  section,
  children,
  headerRight,
  fill = false,
}: ShellSectionPageProps) {
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
