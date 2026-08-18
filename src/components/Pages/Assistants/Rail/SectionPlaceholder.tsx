import * as React from 'react';
import { Sparkles } from 'lucide-react';
import type { SectionDef } from './sectionConfig';

/**
 * Brand "coming soon" panel for any Brain section whose real view is not built
 * yet. Every shipped section renders its own dedicated component; this remains as
 * the fallback for `placeholder`-kind sections added to the rail ahead of their
 * view.
 */
export function SectionPlaceholder({ section }: { section: SectionDef }) {
  const { Icon } = section;
  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-8">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card text-foreground">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="text-h1 flex items-center justify-center gap-2 text-foreground">
          {section.label}
          <span className="text-caption-sm inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-soft-foreground">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Coming soon
          </span>
        </div>
        <p className="mx-auto mt-3 text-sm leading-relaxed text-muted-foreground">{section.desc}</p>
      </div>
    </div>
  );
}
