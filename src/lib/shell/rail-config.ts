import { cookies } from 'next/headers';
import { parseRailConfig, RAIL_CONFIG_COOKIE } from '@/utils/shell/railConfig';
import type { RailConfig } from '@/types/shell/rail';

/**
 * The requesting browser's rail config, so the shell can server-render the rail
 * that browser is about to show rather than the default one.
 */
export async function getRailConfig(): Promise<RailConfig> {
  const cookieStore = await cookies();
  return parseRailConfig(cookieStore.get(RAIL_CONFIG_COOKIE)?.value);
}
