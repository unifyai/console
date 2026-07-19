/**
 * Shared Table Data Fetching Logic
 *
 * Core logic for fetching table view data from Orchestra.
 * Used by both the API route and OG image generation.
 *
 * Flow:
 * 1. Fetch table view config from admin endpoint (includes userId, organizationId)
 * 2. Fetch user's API key from admin user endpoint
 * 3. Call /v0/logs with user's credentials to get data
 * 4. Fetch field metadata
 * 5. Transform and return data
 */

import { snakeToCamelObject } from '@/utils/casing';
import {
  USE_MOCK_EMBEDS,
  MOCK_TABLE_TOKEN,
  getMockTableData,
} from '@/utils/assistants/chat-embed-mock-data';
import type {
  TableConfig,
  FieldMetadata,
  AdminTableViewResponse,
  AdminUserResponse,
  LogEntry,
  LogsResponse,
  TableViewMetadata,
  PaginationInfo,
} from '@/types/tableView';

// =============================================================================
// Configuration
// =============================================================================

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

// =============================================================================
// Types
// =============================================================================

export interface FetchTableDataOptions {
  page?: number;
  pageSize?: number;
  /** Shorter timeout for OG generation */
  timeoutMs?: number;
}

export interface TableDataResult {
  config: TableConfig & {
    visibleColumns: string[];
    columnOrder: string[];
  };
  data: Record<string, unknown>[];
  fields: Record<string, FieldMetadata>;
  metadata: TableViewMetadata;
  pagination: PaginationInfo;
}

export interface TableDataError {
  error: string;
  status: number;
  expired?: boolean;
}

export type FetchTableDataResult =
  | { success: true; data: TableDataResult }
  | { success: false; error: TableDataError };

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Transform raw logs to a flat structure for table display.
 */
function transformLogsForTable(rawLogs: LogEntry[]): Record<string, unknown>[] {
  return rawLogs.map((log) => {
    const entries = log.entries || {};
    const derivedEntries = log.derivedEntries || {};

    /* eslint-disable @typescript-eslint/naming-convention */
    return {
      _id: log.id,
      _ts: log.ts,
      ...entries,
      ...derivedEntries,
    };
    /* eslint-enable @typescript-eslint/naming-convention */
  });
}

/**
 * Determine which columns to show based on config and available fields.
 */
function getVisibleColumns(config: TableConfig, allColumns: string[]): string[] {
  // If explicit visible list, use that
  if (config.columns?.visible && config.columns.visible.length > 0) {
    return config.columns.visible.filter((col) => allColumns.includes(col));
  }

  // If hidden list, show all except hidden
  if (config.columns?.hidden && config.columns.hidden.length > 0) {
    return allColumns.filter((col) => !config.columns!.hidden!.includes(col));
  }

  // Default: show all columns
  return allColumns;
}

/**
 * Get column order, defaulting to visible columns order.
 */
function getColumnOrder(config: TableConfig, visibleColumns: string[]): string[] {
  if (config.columns?.order && config.columns.order.length > 0) {
    // Use specified order, but only include visible columns
    const ordered = config.columns.order.filter((col) => visibleColumns.includes(col));
    // Add any visible columns not in the order list
    const remaining = visibleColumns.filter((col) => !config.columns!.order!.includes(col));
    return [...ordered, ...remaining];
  }

  return visibleColumns;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Fetch table data for a given token.
 *
 * This is the core logic shared between the API route and OG image generation.
 * Returns either success with data or failure with error details.
 */
export async function fetchTableData(
  token: string,
  options: FetchTableDataOptions = {}
): Promise<FetchTableDataResult> {
  console.log('[tableData] === fetchTableData START ===');
  console.log('[tableData] Input token:', token);
  console.log('[tableData] Options:', JSON.stringify(options));
  console.log('[tableData] ORCHESTRA_URL:', ORCHESTRA_URL);
  console.log('[tableData] ORCHESTRA_ADMIN_KEY present:', !!ORCHESTRA_ADMIN_KEY);

  const {
    page = 1,
    pageSize: requestedPageSize = DEFAULT_PAGE_SIZE,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = options;

  // Normalize token to lowercase for case-insensitive matching
  const normalizedToken = token.toLowerCase();
  console.log('[tableData] Normalized token:', normalizedToken);

  // Validate token format (12 hex chars)
  if (!/^[a-f0-9]{12}$/.test(normalizedToken)) {
    console.error('[tableData] Invalid token format:', normalizedToken);
    return {
      success: false,
      error: { error: 'Invalid token format', status: 400 },
    };
  }
  console.log('[tableData] Token format valid');

  // Mock data path: return pre-built data for the mock token (no backend needed)
  if (USE_MOCK_EMBEDS && normalizedToken === MOCK_TABLE_TOKEN) {
    console.log('[tableData] Returning mock data for token:', normalizedToken);
    return { success: true, data: getMockTableData() as TableDataResult };
  }

  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedPageSize));
  console.log('[tableData] Page:', page, 'PageSize:', pageSize, 'Timeout:', timeoutMs);

  // Check for admin key
  if (!ORCHESTRA_ADMIN_KEY) {
    console.error('[tableData] ORCHESTRA_ADMIN_KEY not configured');
    return {
      success: false,
      error: { error: 'Server configuration error', status: 500 },
    };
  }
  console.log('[tableData] Admin key configured, proceeding...');

  try {
    // ========================================================================
    // Step 1: Fetch table view config from admin endpoint
    // ========================================================================
    console.log('[tableData] Step 1: Fetching table view config...');
    const configUrl = `${ORCHESTRA_URL}/v0/admin/logs/table?token=${normalizedToken}`;
    console.log('[tableData] Config URL:', configUrl);
    const configRes = await fetchWithTimeout(
      configUrl,
      {
        headers: {
          Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
      timeoutMs
    );

    if (!configRes.ok) {
      if (configRes.status === 404) {
        return {
          success: false,
          error: { error: 'Table view not found or expired', status: 404, expired: true },
        };
      }

      const errorData = await configRes.json().catch(() => ({}));
      console.error('[tableData] Failed to fetch table view config:', errorData);
      return {
        success: false,
        error: {
          error: errorData.detail || 'Failed to fetch table view config',
          status: configRes.status,
        },
      };
    }

    const tableViewConfig: AdminTableViewResponse = snakeToCamelObject(await configRes.json());
    console.log('[tableData] Step 1 SUCCESS - Config fetched');
    console.log('[tableData] userId:', tableViewConfig.userId);
    console.log('[tableData] organizationId:', tableViewConfig.organizationId);
    console.log('[tableData] metadata:', JSON.stringify(tableViewConfig.metadata));

    // ========================================================================
    // Step 2: Fetch user data and extract the appropriate API key
    // ========================================================================
    console.log('[tableData] Step 2: Fetching user data...');
    const userUrl = `${ORCHESTRA_URL}/v0/admin/user/by-user-id?user_id=${encodeURIComponent(tableViewConfig.userId)}`;
    console.log('[tableData] User URL:', userUrl);
    const userRes = await fetchWithTimeout(
      userUrl,
      {
        headers: {
          Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
      timeoutMs
    );

    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error('[tableData] Failed to fetch user:', errorText);
      return {
        success: false,
        error: { error: 'Failed to retrieve user credentials', status: 500 },
      };
    }

    const userData: AdminUserResponse = snakeToCamelObject(await userRes.json());

    // Determine the correct API key based on organization context
    let userApiKey: string | undefined;

    if (tableViewConfig.organizationId) {
      const targetOrg = userData.organizations?.find(
        (org) => org.id === tableViewConfig.organizationId
      );
      if (targetOrg?.apiKey) {
        userApiKey = targetOrg.apiKey;
      } else {
        console.error(
          `[tableData] User ${tableViewConfig.userId} has no API key for org ${tableViewConfig.organizationId}`
        );
        return {
          success: false,
          error: { error: 'User credentials not available for this organization', status: 500 },
        };
      }
    } else {
      userApiKey = userData.apiKey;
    }

    if (!userApiKey) {
      console.error('[tableData] No API key found for user');
      return {
        success: false,
        error: { error: 'User credentials not available', status: 500 },
      };
    }
    console.log('[tableData] Step 2 SUCCESS - Got API key (length:', userApiKey.length, ')');

    // ========================================================================
    // Step 3: Call /v0/logs with user's API key
    // ========================================================================
    console.log('[tableData] Step 3: Fetching logs...');
    const projectConfig = tableViewConfig.projectConfig;
    console.log('[tableData] projectConfig:', JSON.stringify(projectConfig));
    const logsParams = new URLSearchParams();

    // Required: project name (from metadata, not projectConfig - it's stored via FK)
    const projectName = tableViewConfig.metadata.projectName;
    if (!projectName) {
      console.error('[tableData] Project name not found in table view metadata');
      return {
        success: false,
        error: { error: 'Invalid table view configuration - missing project name', status: 500 },
      };
    }
    logsParams.append('project_name', projectName);

    // Optional parameters from project config
    if (projectConfig.context) {
      logsParams.append('context', projectConfig.context as string);
    }
    if (projectConfig.filter) {
      logsParams.append('filter', projectConfig.filter as string);
    }
    if (projectConfig.fromFields) {
      logsParams.append('from_fields', projectConfig.fromFields as string);
    }
    if (projectConfig.excludeFields) {
      logsParams.append('exclude_fields', projectConfig.excludeFields as string);
    }
    if (projectConfig.sorting) {
      logsParams.append('sorting', projectConfig.sorting as string);
    }

    // Server-side pagination: calculate offset from page number
    const offset = (page - 1) * pageSize;
    logsParams.append('limit', String(pageSize));
    logsParams.append('offset', String(offset));

    const logsUrl = `${ORCHESTRA_URL}/v0/logs?${logsParams.toString()}`;
    const logsRes = await fetchWithTimeout(
      logsUrl,
      {
        headers: {
          Authorization: `Bearer ${userApiKey}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
      timeoutMs
    );

    if (!logsRes.ok) {
      const errorData = await logsRes.json().catch(() => ({}));
      console.error('[tableData] Failed to fetch logs:', errorData);
      return {
        success: false,
        error: { error: errorData.detail || 'Failed to fetch log data', status: logsRes.status },
      };
    }

    const logsData: LogsResponse = snakeToCamelObject(await logsRes.json());
    const rawLogs = logsData.logs || [];
    console.log('[tableData] Step 3 SUCCESS - Got', rawLogs.length, 'logs');
    console.log('[tableData] Total logs available:', logsData.count);

    // ========================================================================
    // Step 4: Fetch fields metadata
    // ========================================================================
    console.log('[tableData] Step 4: Fetching fields metadata...');
    const fieldsParams = new URLSearchParams();
    if (projectName) {
      fieldsParams.append('project_name', projectName);
    }
    if (projectConfig.context) {
      fieldsParams.append('context', projectConfig.context as string);
    }

    const fieldsUrl = `${ORCHESTRA_URL}/v0/logs/fields?${fieldsParams.toString()}`;
    const fieldsRes = await fetchWithTimeout(
      fieldsUrl,
      {
        headers: {
          Authorization: `Bearer ${userApiKey}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
      timeoutMs
    );

    let rawFields: Record<string, FieldMetadata> = {};
    if (fieldsRes.ok) {
      rawFields = snakeToCamelObject(await fieldsRes.json());
      console.log('[tableData] Step 4 SUCCESS - Got', Object.keys(rawFields).length, 'fields');
    } else {
      console.warn('[tableData] Step 4 WARN - Failed to fetch fields, continuing without');
    }

    // ========================================================================
    // Step 5: Transform data and build response
    // ========================================================================
    console.log('[tableData] Step 5: Transforming data...');
    const transformedData = transformLogsForTable(rawLogs);
    console.log('[tableData] Transformed', transformedData.length, 'rows');

    // Get all available column names from data
    const allColumns = new Set<string>();
    transformedData.forEach((row) => {
      Object.keys(row).forEach((key) => allColumns.add(key));
    });
    const columnList = Array.from(allColumns);

    // Determine visible columns and order
    const visibleColumns = getVisibleColumns(tableViewConfig.config, columnList);
    const columnOrder = getColumnOrder(tableViewConfig.config, visibleColumns);

    const totalCount = logsData.count ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    console.log('[tableData] === fetchTableData SUCCESS ===');
    console.log(
      '[tableData] Returning',
      transformedData.length,
      'rows,',
      Object.keys(rawFields).length,
      'fields'
    );
    console.log('[tableData] Pagination: page', page, 'of', totalPages, '| total:', totalCount);

    return {
      success: true,
      data: {
        config: {
          ...tableViewConfig.config,
          visibleColumns,
          columnOrder,
        },
        data: transformedData,
        fields: rawFields,
        metadata: {
          ...tableViewConfig.metadata,
          projectName: projectName || 'Unknown Project',
        },
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    };
  } catch (error) {
    // Handle timeout errors specifically
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[tableData] Request timeout');
      return {
        success: false,
        error: { error: 'Request timed out. Please try again.', status: 504 },
      };
    }

    console.error('[tableData] Unexpected error:', error);
    return {
      success: false,
      error: { error: 'Failed to load table view', status: 500 },
    };
  }
}
