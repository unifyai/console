import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import type { LucideIcon } from 'lucide-react';

/** Rail nav icons — thinner stroke matches the design prototype. */
const RAIL_ICON_STROKE = 1.75;

/** Lucide icons plus custom SVGs that accept className / strokeWidth. */
export type RailNavIcon =
  | LucideIcon
  | React.ComponentType<{ className?: string; strokeWidth?: number }>;

interface RailNavButtonProps {
  Icon: RailNavIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
  showActivityDot?: boolean;
  /** Optional chip shown in the tooltip. */
  badge?: string;
}

/**
 * A single icon-only rail navigation entry with a hover tooltip for the label.
 */
export function RailNavButton({
  Icon,
  label,
  active = false,
  disabled = false,
  onClick,
  testId,
  showActivityDot = false,
  badge,
}: RailNavButtonProps) {
  const tooltip = badge ? `${label} · ${badge}` : label;

  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      aria-label={tooltip}
      data-testid={testId}
      className={cn(
        'group/nav relative flex w-full items-center justify-center rounded-[10px] px-0 py-[11px] font-medium transition-colors',
        active ? 'bg-accent-soft text-accent-soft-foreground' : 'text-foreground hover:bg-muted',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      <span
        className={cn(
          'grid shrink-0 place-items-center transition-colors',
          active ? 'text-accent-soft-foreground' : 'text-foreground'
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={RAIL_ICON_STROKE} aria-hidden="true" />
      </span>
      {showActivityDot && (
        <span
          className="animate-rail-activity-dot absolute right-2.5 top-2 h-2 w-2 shrink-0 rounded-full bg-primary ring-1 ring-primary-tint-30"
          aria-hidden="true"
          data-testid={testId ? `${testId}-activity-dot` : undefined}
        />
      )}
    </button>
  );

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
