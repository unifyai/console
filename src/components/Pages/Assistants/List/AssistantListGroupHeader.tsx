import type * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { RAIL_TRAILING_GLYPH, RAIL_TRAILING_SLOT } from '@/components/Layout/Shell/railGeometry';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

interface AssistantListGroupHeaderProps {
  label: string;
  isFolded: boolean;
  onToggleFold: () => void;
  description?: string | null;
  /**
   * `section` names a region; `workspace` is a row that happens to fold, so it
   * takes a row's shell rather than a heading's.
   */
  variant?: 'section' | 'workspace';
  subtitle?: string | null;
  icon?: React.ReactNode;
  /** Optional trailing control (e.g. create-group +) rendered beside the fold chevron. */
  trailingAction?: React.ReactNode;
}

/**
 * A foldable heading inside the teammate list.
 *
 * The list renders the same objects the rail does, so it speaks the rail's
 * vocabulary rather than a second one of its own: a region is named by an
 * overline and separated by whitespace, and anything that reads as a row takes
 * a row's shell. Full-bleed rules drawn across a column of rounded rows
 * belonged to neither, and were what made the two read as different systems.
 */
export function AssistantListGroupHeader({
  label,
  isFolded,
  onToggleFold,
  description,
  variant = 'section',
  subtitle,
  icon,
  trailingAction,
}: AssistantListGroupHeaderProps) {
  const Icon = isFolded ? ChevronRight : ChevronDown;
  const isWorkspace = variant === 'workspace';
  const header = (
    <div className="flex w-full min-w-0 max-w-full items-center gap-1 overflow-hidden">
      <button
        type="button"
        className={cn(
          'flex min-w-0 flex-1 items-center overflow-hidden rounded-lg transition-colors',
          isWorkspace
            ? 'gap-2.5 border border-transparent px-2 py-1 hover:bg-[var(--surface-hover)]'
            : 'text-overline gap-1.5 px-2 py-1.5 hover:bg-muted'
        )}
        aria-expanded={!isFolded}
        onClick={onToggleFold}
      >
        {icon ? (
          <span
            className={cn(
              'flex shrink-0 items-center justify-center text-muted-foreground',
              // A row's leading glyph stands in the avatar column the rows
              // around it use, so the spine holds without painting a tile.
              isWorkspace && 'h-7 w-7'
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 text-left">
          <span className={cn('flex min-w-0 items-center gap-1', isWorkspace && 'text-foreground')}>
            <span className={cn('truncate', isWorkspace && 'text-body text-strong')}>{label}</span>
            {isWorkspace ? <Icon className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
          </span>
          {subtitle ? (
            <span className="text-caption-sm mt-0.5 block truncate leading-tight">{subtitle}</span>
          ) : null}
        </span>
        {isWorkspace ? null : (
          <span className={RAIL_TRAILING_SLOT} aria-hidden="true">
            <Icon className={RAIL_TRAILING_GLYPH} />
          </span>
        )}
      </button>
      {trailingAction ? <span className="flex shrink-0 items-center">{trailingAction}</span> : null}
    </div>
  );

  if (!description) {
    return header;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{header}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="w-[var(--radix-tooltip-trigger-width)] max-w-80 text-left leading-snug"
        >
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
