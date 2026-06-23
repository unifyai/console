import * as React from 'react';
import { TabHeader } from './TabHeader';
import { SectionPlaceholder } from './SectionPlaceholder';
import type { SectionDef } from './sectionConfig';

interface SectionHostProps {
  section: SectionDef;
  /** Renders the existing right-pane view for a `view` section. Skipped for
   *  `placeholder` sections so the heavy view never mounts behind the panel. */
  renderView: () => React.ReactNode;
}

/**
 * Hosts the active rail section: a brand header (icon/title/description + guided
 * steps) above either an existing right-pane view or a "coming soon" placeholder
 * for net-new Brain sections. The right-pane strip is suppressed by the caller
 * because the rail owns primary navigation.
 */
export function SectionHost({ section, renderView }: SectionHostProps) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <TabHeader section={section} />
      <div className="min-h-0 flex-1 overflow-hidden">
        {section.kind === 'placeholder' ? <SectionPlaceholder section={section} /> : renderView()}
      </div>
    </div>
  );
}
