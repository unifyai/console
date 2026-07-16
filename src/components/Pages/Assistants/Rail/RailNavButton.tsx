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
  collapsed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
  showActivityDot?: boolean;
  /** Optional chip shown next to the label. */
  badge?: string;
}

/**
 * A single rail navigation entry. Mirrors the prototype's `.nav-item`: an
 * accent-soft active fill, a primary dot trailing the label when active, and an
 * icon-only compact form (with a tooltip) when the rail is collapsed to a dock.
 */
export function RailNavButton({
  Icon,
  label,
  active = false,
  collapsed = false,
  disabled = false,
  onClick,
  testId,
  showActivityDot = false,
  badge,
}: RailNavButtonProps) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? (badge ? `${label} (${badge})` : label) : undefined}
      data-testid={testId}
      className={cn(
        'group/nav relative flex w-full items-center gap-3 rounded-[10px] font-medium transition-colors',
        collapsed ? 'justify-center px-0 py-[11px]' : 'px-[11px] py-[9px]',
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
      {!collapsed && <span className="text-[13px] font-normal">{label}</span>}
      {!collapsed && badge && (
        <span
          className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-[0.06em] text-muted-foreground"
          data-testid={testId ? `${testId}-badge` : undefined}
        >
          {badge}
        </span>
      )}
      {showActivityDot && (
        <span
          className={cn(
            'animate-rail-activity-dot h-2 w-2 shrink-0 rounded-full bg-primary ring-1 ring-primary-tint-30',
            collapsed ? 'absolute right-2.5 top-2' : 'ml-auto'
          )}
          aria-hidden="true"
          data-testid={testId ? `${testId}-activity-dot` : undefined}
        />
      )}
      {!collapsed && active && !showActivityDot && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
      )}
    </button>
  );

  if (!collapsed) return button;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">
          <p>{badge ? `${label} · ${badge}` : label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
