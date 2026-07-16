import type * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

interface AssistantListGroupHeaderProps {
  label: string;
  isFolded: boolean;
  onToggleFold: () => void;
  description?: string | null;
  variant?: 'section' | 'group' | 'workspace';
  subtitle?: string | null;
  icon?: React.ReactNode;
  badgeLabel?: string;
  /** Optional trailing control (e.g. create-group +) rendered beside the fold chevron. */
  trailingAction?: React.ReactNode;
}

export function AssistantListGroupHeader({
  label,
  isFolded,
  onToggleFold,
  description,
  variant = 'group',
  subtitle,
  icon,
  badgeLabel,
  trailingAction,
}: AssistantListGroupHeaderProps) {
  const Icon = isFolded ? ChevronRight : ChevronDown;
  const header = (
    <div
      className={cn(
        'flex w-full min-w-0 max-w-full items-stretch gap-1 overflow-hidden',
        variant === 'section' &&
          'border-b font-semibold uppercase tracking-wide text-muted-foreground',
        variant === 'group' &&
          'border-b font-semibold uppercase tracking-wide text-muted-foreground',
        variant === 'workspace' && 'rounded-xl'
      )}
    >
      <button
        type="button"
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-xs transition-colors hover:bg-muted hover:text-foreground',
          // Padding lives on the button so the full header height is the hit
          // target (not a thin text-height strip inside a padded wrapper).
          variant === 'section' && 'px-2 py-2',
          variant === 'group' && 'px-2 py-1.5',
          variant === 'workspace' &&
            'bg-muted/15 rounded-xl border border-border px-3 py-2.5 text-muted-foreground hover:border-primary-tint-30 hover:bg-primary-tint-5'
        )}
        aria-expanded={!isFolded}
        onClick={onToggleFold}
      >
        {icon ? (
          <span
            className={cn(
              'flex shrink-0 items-center justify-center text-muted-foreground',
              variant === 'workspace' && 'bg-background/70 h-8 w-8 rounded-lg border border-border'
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 text-left">
          <span
            className={cn(
              'flex min-w-0 items-center gap-1',
              variant === 'workspace' && 'text-foreground'
            )}
          >
            <span className="truncate font-medium">{label}</span>
            {variant === 'workspace' ? (
              <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : null}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {badgeLabel ? (
            <span
              className="rounded-full border border-primary-tint-20 bg-primary-tint-10 px-2 py-0.5 text-[10px] font-medium text-primary"
              aria-hidden="true"
            >
              {badgeLabel}
            </span>
          ) : null}
          {variant !== 'workspace' ? (
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
          ) : null}
        </span>
      </button>
      {trailingAction ? (
        <span className="flex shrink-0 items-center pr-1">{trailingAction}</span>
      ) : null}
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
