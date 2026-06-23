import * as React from 'react';
import { TabHeader } from '@/components/Pages/Assistants/Rail/TabHeader';
import type { SectionDef } from '@/components/Pages/Assistants/Rail/sectionConfig';

interface ShellSectionPageProps {
  section: SectionDef;
  children: React.ReactNode;
  /** Optional per-section controls rendered before the global actions. */
  headerRight?: React.ReactNode;
}

/**
 * A home-route page hosted in the rail shell: the brand section header (icon,
 * title, guided steps, global actions) above a scrollable body. Lets each
 * migrated route render its existing content beneath a consistent header.
 */
export function ShellSectionPage({ section, children, headerRight }: ShellSectionPageProps) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <TabHeader section={section} right={headerRight} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
