'use client';

import * as React from 'react';
import type { RailConfig, RailGroupId } from '@/types/shell/rail';

export const RAIL_CONFIG_STORAGE_KEY = 'console:assistants:railConfig';

/** Everything pinned, default order — so an upgrade changes nobody's rail. */
export const DEFAULT_RAIL_CONFIG: RailConfig = { v: 1, unpinned: [], order: {} };

/**
 * Stored config, or the default when there is nothing usable to read. A config
 * written by a different version is discarded rather than migrated: the shape
 * is small enough that re-pinning costs less than a migration path nobody
 * exercises.
 */
function readStoredConfig(): RailConfig {
  const raw = window.localStorage.getItem(RAIL_CONFIG_STORAGE_KEY);
  if (raw === null) return DEFAULT_RAIL_CONFIG;
  // Hand-edited or half-written storage is an expected, recoverable input here.
  try {
    const parsed = JSON.parse(raw) as Partial<RailConfig>;
    if (parsed.v !== 1) return DEFAULT_RAIL_CONFIG;
    return {
      v: 1,
      unpinned: Array.isArray(parsed.unpinned) ? parsed.unpinned : [],
      order: parsed.order ?? {},
    };
  } catch {
    return DEFAULT_RAIL_CONFIG;
  }
}

export interface RailConfigActions {
  config: RailConfig;
  isPinned: (sectionId: string) => boolean;
  setPinned: (sectionId: string, pinned: boolean) => void;
  reorder: (groupId: RailGroupId, orderedIds: string[]) => void;
  /** Re-pin every section in a group and drop its stored order. */
  resetGroup: (groupId: RailGroupId, sectionIds: string[]) => void;
  unpinAll: (sectionIds: string[]) => void;
  reset: () => void;
}

/**
 * Rail pin state, persisted per browser alongside the other `console:*`
 * preferences. Storage is read after mount, mirroring `railCollapsed` — the
 * rail renders its default for a frame rather than risking a hydration
 * mismatch against server-rendered markup that cannot know the config.
 */
export function useRailConfig(): RailConfigActions {
  const [config, setConfig] = React.useState<RailConfig>(DEFAULT_RAIL_CONFIG);

  React.useEffect(() => {
    setConfig(readStoredConfig());
  }, []);

  /** Apply a change to the freshest config and persist whatever it produces. */
  const update = React.useCallback((change: (current: RailConfig) => RailConfig) => {
    setConfig((current) => {
      const next = change(current);
      if (next === current) return current;
      window.localStorage.setItem(RAIL_CONFIG_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setPinned = React.useCallback(
    (sectionId: string, pinned: boolean) =>
      update((current) => {
        if (pinned === !current.unpinned.includes(sectionId)) return current;
        return {
          ...current,
          unpinned: pinned
            ? current.unpinned.filter((id) => id !== sectionId)
            : [...current.unpinned, sectionId],
        };
      }),
    [update]
  );

  const reorder = React.useCallback(
    (groupId: RailGroupId, orderedIds: string[]) =>
      update((current) => ({
        ...current,
        order: { ...current.order, [groupId]: orderedIds },
      })),
    [update]
  );

  const resetGroup = React.useCallback(
    (groupId: RailGroupId, sectionIds: string[]) =>
      update((current) => {
        const order = { ...current.order };
        delete order[groupId];
        return {
          ...current,
          unpinned: current.unpinned.filter((id) => !sectionIds.includes(id)),
          order,
        };
      }),
    [update]
  );

  const unpinAll = React.useCallback(
    (sectionIds: string[]) =>
      update((current) => ({
        ...current,
        unpinned: Array.from(new Set([...current.unpinned, ...sectionIds])),
      })),
    [update]
  );

  const reset = React.useCallback(() => update(() => DEFAULT_RAIL_CONFIG), [update]);

  const isPinned = React.useCallback(
    (sectionId: string) => !config.unpinned.includes(sectionId),
    [config.unpinned]
  );

  return { config, isPinned, setPinned, reorder, resetGroup, unpinAll, reset };
}
