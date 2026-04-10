/**
 * Shared Tile Data Fetching Logic
 *
 * Fetches tile HTML content from Orchestra via admin token resolution.
 * Pattern mirrors tableData.ts:
 * 1. Resolve token via admin endpoint -> context_name + user_id
 * 2. Fetch user's API key
 * 3. Fetch tile record from Unify context via /v0/logs
 */

import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;
const REQUEST_TIMEOUT_MS = 30000;

export interface TileData {
  token: string;
  title: string;
  htmlContent: string;
  hasDataBindings: boolean;
  dataBindingContexts: string | null;
  dataBindingsJson: string | null;
  onDataScript: string | null;
  description: string | null;
}

export interface TileDataError {
  error: string;
  status: number;
}

export type FetchTileDataResult =
  | { success: true; data: TileData }
  | { success: false; error: TileDataError };

interface TokenResolution {
  entityType: string;
  contextName: string;
  userId: string;
  organizationId: number | null;
  projectId: number;
  projectName: string;
}

interface AdminUserResponse {
  apiKey?: string;
  organizations?: Array<{
    id: number;
    apiKey?: string;
  }>;
}

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

export async function fetchTileData(token: string): Promise<FetchTileDataResult> {
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
          error: resolveRes.status === 404 ? 'Tile not found' : 'Token resolution failed',
          status: resolveRes.status,
        },
      };
    }

    const resolution = snakeToCamelObject<TokenResolution>(await resolveRes.json());

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

    const userData = snakeToCamelObject<AdminUserResponse>(await userRes.json());
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

    // Step 3: Fetch tile record from Unify context
    const logsUrl = new URL(`${ORCHESTRA_URL}/v0/logs`);
    logsUrl.searchParams.set('project_name', resolution.projectName);
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
        error: { error: 'Failed to fetch tile data', status: logsRes.status },
      };
    }

    const logsData = snakeToCamelObject<{
      logs: Array<{ entries: Record<string, unknown>; derivedEntries: Record<string, unknown> }>;
    }>(await logsRes.json());
    const logs = logsData.logs || [];

    if (logs.length === 0) {
      return { success: false, error: { error: 'Tile not found in context', status: 404 } };
    }

    const record = { ...logs[0].entries, ...logs[0].derivedEntries } as Record<string, unknown>;

    return {
      success: true,
      data: {
        token: (record.token as string) || token,
        title: (record.title as string) || 'Untitled Tile',
        htmlContent: (record.htmlContent as string) || '',
        hasDataBindings: (record.hasDataBindings as boolean) || false,
        dataBindingContexts: (record.dataBindingContexts as string) || null,
        dataBindingsJson: (record.dataBindingsJson as string) || null,
        onDataScript: (record.onDataScript as string) || null,
        description: (record.description as string) || null,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: { error: message, status: 500 } };
  }
}
