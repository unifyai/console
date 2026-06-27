'use client';

import * as React from 'react';

/**
 * Holds a boolean `true` for `releaseMs` after its source drops to `false`, while
 * reflecting a rising edge immediately. Used to debounce the call avatar's
 * "speaking turn" signal: the LiveKit agent state can briefly dip
 * (speaking -> thinking -> speaking) between sentences within a single turn, and
 * without this hold those sub-second gaps would flip the avatar's eye/mouth state
 * machine and make the face glitch. The rising edge stays instant so speech still
 * starts the animation promptly.
 */
export function useHeldFlag(active: boolean, releaseMs = 600): boolean {
  const [held, setHeld] = React.useState(active);

  React.useEffect(() => {
    if (active) {
      setHeld(true);
      return;
    }
    const timeout = window.setTimeout(() => setHeld(false), releaseMs);
    return () => window.clearTimeout(timeout);
  }, [active, releaseMs]);

  return held;
}
