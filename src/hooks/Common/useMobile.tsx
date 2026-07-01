import * as React from 'react';
import { BREAKPOINTS, maxWidthMediaQuery, type BreakpointKey } from '@/constants/breakpoints';

export interface BreakpointState {
  /** Viewport width is below 640px. */
  isBelowCompact: boolean;
  /** Viewport width is below 768px. */
  isBelowMobile: boolean;
  /** Viewport width is below 1024px. */
  isBelowTablet: boolean;
}

function readBreakpointState(): BreakpointState {
  if (typeof window === 'undefined') {
    return { isBelowCompact: false, isBelowMobile: false, isBelowTablet: false };
  }
  const width = window.innerWidth;
  return {
    isBelowCompact: width < BREAKPOINTS.compact,
    isBelowMobile: width < BREAKPOINTS.mobile,
    isBelowTablet: width < BREAKPOINTS.tablet,
  };
}

function subscribeBreakpoint(onChange: () => void): () => void {
  const queries = (['compact', 'mobile', 'tablet'] as const).map((key) =>
    window.matchMedia(maxWidthMediaQuery(key))
  );
  const handler = () => onChange();
  queries.forEach((mql) => mql.addEventListener('change', handler));
  return () => queries.forEach((mql) => mql.removeEventListener('change', handler));
}

export function useBreakpoint(): BreakpointState {
  const [state, setState] = React.useState<BreakpointState>(readBreakpointState);

  React.useEffect(() => {
    const update = () => setState(readBreakpointState());
    update();
    return subscribeBreakpoint(update);
  }, []);

  return state;
}

export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = React.useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : defaultValue
  );

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function useMatchesBelow(breakpoint: BreakpointKey): boolean {
  return useMediaQuery(maxWidthMediaQuery(breakpoint));
}

/** @deprecated Prefer `useBreakpoint().isBelowMobile`. */
export function useIsMobile() {
  return useMatchesBelow('mobile');
}
