import type * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

interface AssistantListGroupHeaderProps {
  label: string;
  count: number;
  isFolded: boolean;
  onToggleFold: () => void;
  description?: string | null;
  variant?: 'section' | 'group' | 'workspace';
  countLabel?: string;
  subtitle?: string | null;
  icon?: React.ReactNode;
  badgeLabel?: string;
}

export function AssistantListGroupHeader({
  label,
  count,
  isFolded,
  onToggleFold,
  description,
  variant = 'group',
  countLabel,
  subtitle,
  icon,
  badgeLabel,
}: AssistantListGroupHeaderProps) {
  const Icon = isFolded ? ChevronRight : ChevronDown;
  const header = (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-1.5 text-xs transition-colors hover:bg-muted hover:text-foreground',
        variant === 'section' &&
          'border-b px-2 py-2 font-semibold uppercase tracking-wide text-muted-foreground',
        variant === 'group' && 'border-b px-2 py-1.5 text-muted-foreground',
        variant === 'workspace' &&
          'bg-muted/15 hover:border-primary/30 hover:bg-primary/5 rounded-xl border border-border px-3 py-2.5 text-muted-foreground'
      )}
      aria-expanded={!isFolded}
      onClick={onToggleFold}
    >
      <Icon className="h-3 w-3 shrink-0" />
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
          className={cn('block truncate font-medium', variant === 'workspace' && 'text-foreground')}
        >
          {label}
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
            className="border-primary/20 bg-primary/10 rounded-full border px-2 py-0.5 text-[10px] font-medium text-primary"
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        ) : null}
        <span className="tabular-nums">{countLabel ?? count}</span>
      </span>
    </button>
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
