import * as React from 'react';
import { Pin, PinOff, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/UI/context-menu';
import type { LucideIcon } from 'lucide-react';
import type { SectionActivity } from '@/types/shell/rail';

/** Rail nav icons — thinner stroke matches the design prototype. */
const RAIL_ICON_STROKE = 1.75;

/** Lucide icons plus custom SVGs that accept className / strokeWidth. */
export type RailNavIcon =
  | LucideIcon
  | React.ComponentType<{ className?: string; strokeWidth?: number }>;

/** Pin/unpin controls, present only on rows that represent a rail section. */
export interface RailNavPinControl {
  pinned: boolean;
  onTogglePin: () => void;
  onCustomize: () => void;
}

interface RailNavButtonProps {
  Icon: RailNavIcon;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
  activity?: SectionActivity;
  /** Muted treatment for a section the rail is showing on the user's behalf. */
  guest?: boolean;
  pinControl?: RailNavPinControl;
}

/** How the activity dot reads to a screen reader, which the dot itself cannot. */
function activityNote(activity: SectionActivity | undefined): string {
  if (activity?.active !== true) return '';
  if (activity.kind === 'running') return ', running';
  if (activity.count !== undefined && activity.count > 0) return `, ${activity.count} unread`;
  return ', new activity';
}

/**
 * A single rail navigation entry. Mirrors the prototype's `.nav-item`: an
 * accent-soft active fill, a primary dot trailing the label when active, and an
 * icon-only compact form (with a tooltip) when the rail is collapsed to a dock.
 *
 * Section rows also carry pin controls — a glyph that fades in on hover or
 * keyboard focus, and a context menu that works from right-click on a pointer
 * and long-press on touch, so the folded dock and the mobile drawer reach the
 * same actions without depending on hover.
 */
export function RailNavButton({
  Icon,
  label,
  active = false,
  collapsed = false,
  disabled = false,
  onClick,
  testId,
  activity,
  guest = false,
  pinControl,
}: RailNavButtonProps) {
  const showActivityDot = activity?.active === true;
  const showActiveDot = !collapsed && active && !showActivityDot;
  const note = activityNote(activity);
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed || note ? `${label}${note}` : undefined}
      data-testid={testId}
      className={cn(
        // `overflow-hidden` + nowrap labels keep rows a fixed height while the
        // rail animates between dock and expanded widths; without it the longer
        // labels wrap mid-transition and the rail foot visibly jumps.
        'relative flex w-full items-center gap-3 overflow-hidden rounded-[10px] font-medium transition-colors',
        collapsed ? 'justify-center px-0 py-[11px]' : 'px-[11px] py-[9px]',
        active ? 'bg-accent-soft text-accent-soft-foreground' : 'text-foreground hover:bg-muted',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      <span
        className={cn(
          'grid shrink-0 place-items-center transition-colors',
          active ? 'text-accent-soft-foreground' : 'text-foreground',
          guest && !active && 'opacity-80'
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={RAIL_ICON_STROKE} aria-hidden="true" />
      </span>
      {!collapsed && (
        <span
          className={cn(
            'truncate whitespace-nowrap text-[13px] font-normal',
            guest && !active && 'text-muted-foreground'
          )}
        >
          {label}
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
      {showActiveDot && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
      )}
    </button>
  );

  // The pin sits beside the trailing indicator rather than replacing it — a
  // notification marker should not vanish because the pointer crossed it.
  const row = pinControl ? (
    <div className="group/nav relative">
      {button}
      {!collapsed && (
        <button
          type="button"
          onClick={pinControl.onTogglePin}
          aria-label={`${pinControl.pinned ? 'Unpin' : 'Pin'} ${label}`}
          data-testid={testId ? `${testId}-pin-toggle` : undefined}
          className={cn(
            'absolute top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/nav:opacity-100',
            showActivityDot || showActiveDot ? 'right-7' : 'right-2'
          )}
        >
          {pinControl.pinned ? (
            <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  ) : (
    button
  );

  const withTooltip = collapsed ? (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{row}</TooltipTrigger>
        <TooltipContent side="right">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    row
  );

  if (!pinControl) return withTooltip;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{withTooltip}</ContextMenuTrigger>
      <ContextMenuContent
        className="w-52"
        data-testid={testId ? `${testId}-context-menu` : undefined}
      >
        <ContextMenuItem onSelect={pinControl.onTogglePin}>
          {pinControl.pinned ? (
            <PinOff className="mr-2 h-4 w-4" aria-hidden="true" />
          ) : (
            <Pin className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          {pinControl.pinned ? 'Unpin from rail' : 'Pin to rail'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={pinControl.onCustomize}>
          <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
          Customize rail…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
