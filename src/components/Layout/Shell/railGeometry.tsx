'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared geometry for every row in the app rail.
 *
 * The rail has one content inset. Every leading glyph, avatar and label starts
 * there, and every trailing control's box ends there, so the column reads as a
 * single spine instead of five rows that each picked their own margin.
 *
 * The inset is reached in two hops. A container sets `RAIL_GUTTER`, which is
 * where a row's hover or active fill begins so it breathes inside the rail's
 * edge; each row inside then carries `RAIL_ROW_PAD` from that fill edge to its
 * content. Headings take the same `RAIL_ROW_PAD` as the rows they head, so
 * they share the spine without painting a fill.
 *
 * A row that sits directly on the rail rather than inside a gutter container —
 * only the brand lockup does — takes `RAIL_FLUSH_PAD` instead and lands on the
 * same x in one hop.
 */

/** Where a row's fill begins, set by the container. */
export const RAIL_GUTTER = 'px-2.5';

/** A row's own padding, from the fill's edge to its content. */
export const RAIL_ROW_PAD = 'px-2.5';

/** The whole inset in one hop, for rows outside a gutter container. */
export const RAIL_FLUSH_PAD = 'px-5';

/**
 * The shell every filled row shares: the fill's shape, the gap between a
 * leading glyph and its label, and the transition they animate on. Callers add
 * their own vertical padding, since an icon row and a two-line identity row
 * are legitimately different heights.
 */
export const RAIL_ROW_SHELL =
  'relative flex w-full items-center gap-3 rounded-lg transition-colors';

/**
 * The box every trailing control occupies — the section-heading menu, a row's
 * pin, both switcher chevrons, the drawer's close. Sizing the box rather than
 * the glyph is what lets a button and a bare indicator centre on the same axis.
 */
export const RAIL_TRAILING_SLOT = 'grid h-5 w-5 shrink-0 place-items-center';

/** The glyph inside that box. One size for every trailing control. */
export const RAIL_TRAILING_GLYPH = 'h-3.5 w-3.5';

/** Pulls a trailing control's box onto the rail's content inset. */
export const RAIL_TRAILING_INSET = 'right-2.5';

interface RailTrailingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

/**
 * An interactive control in a row's trailing slot.
 *
 * The visible box stays at the slot's 20px so the control carries the same
 * weight as the glyphs beside it, while an inset pseudo-element lifts the
 * touch target to 32px. Growing the box instead would push the row's rhythm
 * around, and the rail renders expanded inside the mobile drawer, where these
 * are the only way to reach the menus behind them.
 */
export const RailTrailingButton = React.forwardRef<HTMLButtonElement, RailTrailingButtonProps>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        RAIL_TRAILING_SLOT,
        'relative rounded-md text-muted-foreground transition-colors after:absolute after:-inset-1.5 after:content-[""]',
        'hover:bg-muted hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
RailTrailingButton.displayName = 'RailTrailingButton';
