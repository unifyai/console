'use client';

import * as React from 'react';
import { RailConfigContext } from '@/components/Layout/Shell/RailConfigProvider';
import {
  DEFAULT_RAIL_CONFIG,
  RAIL_CONFIG_COOKIE,
  RAIL_CONFIG_MAX_AGE_SECONDS,
  serializeRailConfig,
} from '@/utils/shell/railConfig';
import type { RailConfig, RailGroupId } from '@/types/shell/rail';

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
 * Rail pin state, persisted per browser in a cookie.
 *
 * The initial value comes from the server, which read the same cookie off the
 * request — so the first client render reproduces the markup it is hydrating
 * and an unpinned rail never shows its full default set for a frame.
 */
export function useRailConfig(): RailConfigActions {
  const [config, setConfig] = React.useState<RailConfig>(React.useContext(RailConfigContext));

  /** Apply a change to the freshest config and persist whatever it produces. */
  const update = React.useCallback((change: (current: RailConfig) => RailConfig) => {
    setConfig((current) => {
      const next = change(current);
      if (next === current) return current;
      document.cookie = `${RAIL_CONFIG_COOKIE}=${serializeRailConfig(next)}; path=/; max-age=${RAIL_CONFIG_MAX_AGE_SECONDS}; samesite=lax`;
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
