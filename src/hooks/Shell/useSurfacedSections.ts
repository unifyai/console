'use client';

import * as React from 'react';
import { SURFACED_CAP } from '@/utils/shell/railLayout';
import type { SectionActivityMap } from '@/types/shell/rail';

/**
 * How long a surfaced section stays in the rail after its activity clears.
 * Long enough that a finishing task does not pull the row out from under a
 * click that was already on its way to it.
 */
export const SURFACED_HOLD_MS = 30_000;

interface UseSurfacedSectionsArgs {
  activity: SectionActivityMap | undefined;
  /** Section ids the user has unpinned — the only ones eligible to surface. */
  unpinned: string[];
  activeSectionId: string | null;
  /** True while a menu or the editor is open; nothing retires under one. */
  frozen: boolean;
  holdMs?: number;
}

/**
 * The ordered set of unpinned sections the rail is showing on the user's
 * behalf.
 *
 * Promotion is immediate and appends, so a second arrival never shoves the
 * first one sideways. Retirement is deliberately slow: a section stays for a
 * hold window after its activity clears, and visiting it consumes the
 * surfacing outright — while you are on a section the layout shows it anyway,
 * so it drops out the moment you navigate away rather than lingering.
 */
export function useSurfacedSections({
  activity,
  unpinned,
  activeSectionId,
  frozen,
  holdMs = SURFACED_HOLD_MS,
}: UseSurfacedSectionsArgs): string[] {
  const [surfaced, setSurfaced] = React.useState<string[]>([]);
  const timers = React.useRef(new Map<string, number>());

  // Stable keys: the arrays behind them are rebuilt every render upstream.
  const eligibleKey = unpinned.join(',');
  const liveKey = unpinned.filter((id) => activity?.[id]?.active === true).join(',');

  // Membership and hold timers reconcile together: a retirement frees a capped
  // slot, and the section waiting behind it has to be able to take that slot.
  React.useEffect(() => {
    const eligible = eligibleKey === '' ? [] : eligibleKey.split(',');
    const live = liveKey === '' ? [] : liveKey.split(',');
    const pending = timers.current;

    // Re-pinning a section, or opening it, takes it out of the zone.
    const kept = surfaced.filter((id) => eligible.includes(id) && id !== activeSectionId);
    const added = live.filter((id) => id !== activeSectionId && !kept.includes(id));
    const next = [...kept, ...added].slice(0, SURFACED_CAP);

    if (next.length !== surfaced.length || next.some((id, index) => id !== surfaced[index])) {
      setSurfaced(next);
      return;
    }

    // A section that went live again, or left the zone, has nothing pending.
    for (const [id, timer] of pending) {
      if (live.includes(id) || !next.includes(id)) {
        window.clearTimeout(timer);
        pending.delete(id);
      }
    }

    // Menus and the editor pause retirement so rows never move under a cursor.
    if (frozen) {
      for (const [, timer] of pending) window.clearTimeout(timer);
      pending.clear();
      return;
    }

    for (const id of next) {
      if (live.includes(id) || pending.has(id)) continue;
      pending.set(
        id,
        window.setTimeout(() => {
          pending.delete(id);
          setSurfaced((current) => current.filter((entry) => entry !== id));
        }, holdMs)
      );
    }
  }, [surfaced, eligibleKey, liveKey, activeSectionId, frozen, holdMs]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const [, timer] of pending) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return surfaced;
}
