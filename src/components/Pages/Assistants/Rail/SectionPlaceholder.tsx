import * as React from 'react';
import { Sparkles } from 'lucide-react';
import type { SectionDef } from './sectionConfig';

/**
 * Brand "coming soon" panel for net-new Brain sections whose real views are not
 * built yet (Transcripts, Knowledge, Functions, Guidance, Data). Keeps the rail
 * IA complete while signalling the work is on the way.
 */
export function SectionPlaceholder({ section }: { section: SectionDef }) {
  const { Icon } = section;
  return (
    <div className="brand-chat-stencil-bg flex h-full w-full items-center justify-center bg-background p-8">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card text-foreground">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="text-h1 flex items-center justify-center gap-2 text-foreground">
          {section.label}
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-soft-foreground">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Coming soon
          </span>
        </div>
        <p className="mx-auto mt-3 text-sm leading-relaxed text-muted-foreground">{section.desc}</p>
      </div>
    </div>
  );
}
