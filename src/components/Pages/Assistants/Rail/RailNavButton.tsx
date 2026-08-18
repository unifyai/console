import * as React from 'react';
import { Pin, PinOff, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RAIL_ROW_PAD,
  RAIL_ROW_SHELL,
  RAIL_TRAILING_GLYPH,
  RAIL_TRAILING_INSET,
  RailTrailingButton,
} from '@/components/Layout/Shell/railGeometry';
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
 * accent-soft active fill with a leading accent bar, and an icon-only compact
 * form (with a tooltip) when the rail is collapsed to a dock.
 *
 * The trailing slot is reserved exclusively for the activity dot. Selection is
 * carried by the fill, the ink shift and the bar, so a dot in that slot always
 * means activity rather than changing meaning row to row.
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
        RAIL_ROW_SHELL,
        // `overflow-hidden` + nowrap labels keep rows a fixed height while the
        // rail animates between dock and expanded widths; without it the longer
        // labels wrap mid-transition and the rail foot visibly jumps.
        'overflow-hidden',
        collapsed ? 'justify-center px-0 py-3' : cn(RAIL_ROW_PAD, 'py-2.5'),
        active ? 'bg-accent-soft text-accent-soft-foreground' : 'text-foreground hover:bg-muted',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      {/*
       * The accent fill alone separates from the page only by hue in the light
       * theme, where it sits a hair off paper and reads close to the hover fill.
       * The bar adds a contrast step that survives both themes.
       */}
      {active && (
        <span
          className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
          aria-hidden="true"
        />
      )}
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
            'text-body-dense truncate whitespace-nowrap',
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
    </button>
  );

  // The pin sits beside the trailing indicator rather than replacing it — a
  // notification marker should not vanish because the pointer crossed it.
  const row = pinControl ? (
    <div className="group/nav relative">
      {button}
      {!collapsed && (
        <RailTrailingButton
          onClick={pinControl.onTogglePin}
          aria-label={`${pinControl.pinned ? 'Unpin' : 'Pin'} ${label}`}
          data-testid={testId ? `${testId}-pin-toggle` : undefined}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 opacity-0 focus-visible:opacity-100 group-hover/nav:opacity-100',
            showActivityDot ? 'right-8' : RAIL_TRAILING_INSET
          )}
        >
          {pinControl.pinned ? (
            <PinOff className={RAIL_TRAILING_GLYPH} aria-hidden="true" />
          ) : (
            <Pin className={RAIL_TRAILING_GLYPH} aria-hidden="true" />
          )}
        </RailTrailingButton>
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
