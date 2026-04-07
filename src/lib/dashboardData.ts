/**
 * Shared Dashboard Data Fetching Logic
 *
 * Fetches dashboard layout from Orchestra via admin token resolution.
 * Pattern mirrors tileData.ts.
 */

import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;
const REQUEST_TIMEOUT_MS = 30000;

export interface TilePosition {
  tileToken: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardData {
  token: string;
  title: string;
  description: string | null;
  tiles: TilePosition[];
  tileCount: number;
}

export interface DashboardDataError {
  error: string;
  status: number;
}

export type FetchDashboardDataResult =
  | { success: true; data: DashboardData }
  | { success: false; error: DashboardDataError };

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchDashboardData(token: string): Promise<FetchDashboardDataResult> {
  if (!ORCHESTRA_ADMIN_KEY) {
    return { success: false, error: { error: 'ORCHESTRA_ADMIN_KEY not configured', status: 500 } };
  }

  try {
    // Step 1: Resolve token
    const resolveRes = await fetchWithTimeout(
      `${ORCHESTRA_URL}/v0/admin/dashboards/tokens/${token}`,
      {
        headers: { Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}` },
        cache: 'no-store',
      }
    );

    if (!resolveRes.ok) {
      return {
        success: false,
        error: {
          error: resolveRes.status === 404 ? 'Dashboard not found' : 'Token resolution failed',
          status: resolveRes.status,
        },
      };
    }

    const resolution = snakeToCamelObject<{
      contextName: string;
      userId: string;
      organizationId: number | null;
    }>(await resolveRes.json());

    // Step 2: Get creator's API key
    const userRes = await fetchWithTimeout(
      `${ORCHESTRA_URL}/v0/admin/user/by-user-id?user_id=${resolution.userId}`,
      {
        headers: { Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}` },
        cache: 'no-store',
      }
    );

    if (!userRes.ok) {
      return {
        success: false,
        error: { error: 'Failed to resolve creator', status: userRes.status },
      };
    }

    const userData = snakeToCamelObject<{
      apiKey?: string;
      organizations?: Array<{ id: number; apiKey?: string }>;
    }>(await userRes.json());
    let apiKey: string | undefined;

    if (resolution.organizationId && userData.organizations) {
      const org = userData.organizations.find((o) => o.id === resolution.organizationId);
      apiKey = org?.apiKey;
    }
    if (!apiKey) {
      apiKey = userData.apiKey;
    }

    if (!apiKey) {
      return { success: false, error: { error: 'No API key found for creator', status: 500 } };
    }

    // Step 3: Fetch dashboard record
    const logsUrl = new URL(`${ORCHESTRA_URL}/v0/logs`);
    logsUrl.searchParams.set('context', resolution.contextName);
    logsUrl.searchParams.set('filter_expr', `token == '${token}'`);
    logsUrl.searchParams.set('limit', '1');

    const logsRes = await fetchWithTimeout(logsUrl.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });

    if (!logsRes.ok) {
      return {
        success: false,
        error: { error: 'Failed to fetch dashboard data', status: logsRes.status },
      };
    }

    const logsData = snakeToCamelObject<{
      logs: Array<{ entries: Record<string, unknown>; derivedEntries: Record<string, unknown> }>;
    }>(await logsRes.json());
    const logs = logsData.logs || [];

    if (logs.length === 0) {
      return { success: false, error: { error: 'Dashboard not found in context', status: 404 } };
    }

    const record = { ...logs[0].entries, ...logs[0].derivedEntries } as Record<string, unknown>;
    let tiles: TilePosition[] = [];
    try {
      const parsed = JSON.parse((record.layout as string) || '[]');
      tiles = snakeToCamelObject<TilePosition[]>(parsed);
    } catch {
      tiles = [];
    }

    return {
      success: true,
      data: {
        token: (record.token as string) || token,
        title: (record.title as string) || 'Untitled Dashboard',
        description: (record.description as string) || null,
        tiles,
        tileCount: (record.tileCount as number) || tiles.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: { error: message, status: 500 } };
  }
}
