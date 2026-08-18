'use client';

import * as React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlobalPlatformActions } from '@/components/Layout/GlobalPlatformActions';
import type { SectionDef } from './sectionConfig';

interface TabHeaderProps {
  section: SectionDef;
  /** Optional controls rendered before the section title (e.g. mobile nav toggle). */
  leading?: React.ReactNode;
  /** Optional per-section controls rendered before the global actions. */
  right?: React.ReactNode;
}

/**
 * The section host header: an icon chip and section title (display font), with an
 * info button that reveals the section description and guided "things to try"
 * steps in a popover.
 */
export function TabHeader({ section, leading, right }: TabHeaderProps) {
  const [info, setInfo] = React.useState(false);
  const { Icon } = section;

  return (
    <div className="relative flex shrink-0 flex-nowrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-3 sm:gap-3">
      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden sm:gap-3">
        {leading}
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2.5 overflow-hidden sm:gap-3">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground">
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-h2 min-w-0 truncate text-foreground">{section.label}</span>
            <button
              type="button"
              onClick={() => setInfo((v) => !v)}
              aria-label="How to use this tab"
              aria-expanded={info}
              className={cn(
                'grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                info && 'bg-accent-soft text-accent-soft-foreground'
              )}
            >
              <Info className="h-[15px] w-[15px]" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <GlobalPlatformActions />
      </div>

      {info && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setInfo(false)}
          />
          <div
            role="dialog"
            aria-label={`${section.label} guidance`}
            className="absolute left-4 top-[calc(100%-4px)] z-50 w-[320px] rounded-xl border border-border bg-popover p-4 shadow-pop-lg"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-foreground">
                <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
              </span>
              <span className="text-title text-foreground">{section.label}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{section.desc}</p>
            <div className="text-overline mt-3">Things to try</div>
            <ol className="mt-2 space-y-2.5">
              {section.steps.map(([title, how], i) => (
                <li key={title} className="flex gap-2.5">
                  <span className="text-caption-sm grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent-soft-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-label text-foreground">{title}</div>
                    <div className="text-caption">{how}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
