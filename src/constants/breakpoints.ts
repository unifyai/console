/** Tailwind-aligned viewport breakpoints used across the assistants shell. */
export const BREAKPOINTS = {
  /** Below `sm` — phone layouts, full-width sheets. */
  compact: 640,
  /** Below `md` — stacked panes, collapsed toolbars. */
  mobile: 768,
  /** Below `lg` — docked rail, narrower split panes. */
  tablet: 1024,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

export function maxWidthMediaQuery(breakpoint: BreakpointKey): string {
  return `(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`;
}

export function minWidthMediaQuery(breakpoint: BreakpointKey): string {
  return `(min-width: ${BREAKPOINTS[breakpoint]}px)`;
}

export function matchesBelowBreakpoint(breakpoint: BreakpointKey): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(maxWidthMediaQuery(breakpoint)).matches;
}
