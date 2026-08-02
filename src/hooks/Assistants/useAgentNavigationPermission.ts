'use client';

import * as React from 'react';

/**
 * Whether a teammate may move around the console on the user's behalf.
 *
 * Opt-out rather than opt-in, matching the floating chat beside it: the moves
 * are always narrated, always reversible, and only happen while the user is
 * here to watch. But someone who does not want their page changing under them
 * needs a way to say so that does not involve closing the console, so this is
 * checked in two places — the catalogue is withheld from the runtime, which
 * takes the tool away entirely, and any script already in flight stops running.
 */
export const AGENT_NAVIGATION_ENABLED_STORAGE_KEY = 'console:agent-navigation-enabled';

/** Same-tab sync; storage events only fire in other tabs. */
export const AGENT_NAVIGATION_ENABLED_CHANGE_EVENT = 'console:agent-navigation-enabled-change';

export function readAgentNavigationEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(AGENT_NAVIGATION_ENABLED_STORAGE_KEY);
    if (stored === null) return true;
    return stored === '1';
  } catch {
    return true;
  }
}

export function writeAgentNavigationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AGENT_NAVIGATION_ENABLED_STORAGE_KEY, enabled ? '1' : '0');
    window.dispatchEvent(new Event(AGENT_NAVIGATION_ENABLED_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

/** Reactive permission, kept in step across tabs and within this one. */
export function useAgentNavigationPermission(): {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
} {
  const [enabled, setEnabledState] = React.useState(readAgentNavigationEnabled);

  React.useEffect(() => {
    const sync = () => setEnabledState(readAgentNavigationEnabled());
    window.addEventListener(AGENT_NAVIGATION_ENABLED_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(AGENT_NAVIGATION_ENABLED_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setEnabled = React.useCallback((next: boolean) => {
    writeAgentNavigationEnabled(next);
    setEnabledState(next);
  }, []);

  return { enabled, setEnabled };
}
