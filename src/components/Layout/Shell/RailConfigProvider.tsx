'use client';

import * as React from 'react';
import { DEFAULT_RAIL_CONFIG } from '@/utils/shell/railConfig';
import type { RailConfig } from '@/types/shell/rail';

/**
 * The rail config as the server read it from the request cookie.
 *
 * `useRailConfig` seeds its state from here so the client's first render agrees
 * with the server's markup. The default stands in for trees mounted outside the
 * shell layout, where an unconfigured rail is the right answer anyway.
 */
export const RailConfigContext = React.createContext<RailConfig>(DEFAULT_RAIL_CONFIG);

export function RailConfigProvider({
  config,
  children,
}: {
  config: RailConfig;
  children: React.ReactNode;
}) {
  return <RailConfigContext.Provider value={config}>{children}</RailConfigContext.Provider>;
}
