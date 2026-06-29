'use client';

import * as React from 'react';
import { Search, Sun, Moon, Info } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import SupportTicketDialog from '@/components/Layout/TopBar/SupportTicketDialog';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import type { SectionDef } from './sectionConfig';

/** Workspace-level quick actions shared across section headers. */
function GlobalActions() {
  const { support: supportEnabled } = useFeatures();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = theme === 'dark';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-0.5">
        {supportEnabled && <SupportTicketDialog />}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label="Search this workspace"
            >
              <Search className="h-[18px] w-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Search this workspace</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {mounted && isDark ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{isDark ? 'Switch to light' : 'Switch to dark'}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

interface TabHeaderProps {
  section: SectionDef;
  /** Optional per-section controls rendered before the global actions. */
  right?: React.ReactNode;
}

/**
 * The section host header: an icon chip, the section title (display font) and a
 * one-line description, with an info button that reveals the section's guided
 * "things to try" steps in a popover. Mirrors the prototype `TabHeader`.
 */
export function TabHeader({ section, right }: TabHeaderProps) {
  const [info, setInfo] = React.useState(false);
  const { Icon } = section;

  return (
    <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-soft-foreground">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-h2 truncate text-foreground">{section.label}</span>
            <button
              type="button"
              onClick={() => setInfo((v) => !v)}
              aria-label="How to use this tab"
              aria-expanded={info}
              className={cn(
                'grid h-5 w-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                info && 'bg-accent-soft text-accent-soft-foreground'
              )}
            >
              <Info className="h-[15px] w-[15px]" />
            </button>
          </div>
          <div className="text-caption truncate">{section.desc}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <GlobalActions />
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
            <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Things to try
            </div>
            <ol className="mt-2 space-y-2.5">
              {section.steps.map(([title, how], i) => (
                <li key={title} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-soft-foreground">
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
