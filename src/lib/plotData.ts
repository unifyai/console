/**
 * Shared Plot Data Fetching Logic
 *
 * Core logic for fetching plot data from Orchestra.
 * Used by both the API route and OG image generation.
 *
 * Flow:
 * 1. Fetch plot config from admin endpoint (includes userId, organizationId)
 * 2. Fetch user's API key from admin user endpoint
 * 3. Call /v0/logs with user's credentials to get data
 * 4. Fetch field metadata
 * 5. For bar charts, fetch pre-aggregated metrics
 * 6. Transform and return data
 */

import { snakeToCamelObject, snakeToCamel } from '@/utils/casing';

// =============================================================================
// Configuration
// =============================================================================

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds - increased for staging cold starts and large queries

// =============================================================================
// Types
// =============================================================================

interface OrchestraPlotConfig {
  type: string;
  xAxis: string;
  yAxis?: string;
  groupBy?: string;
  aggregate?: string;
  scaleX: string;
  scaleY: string;
  metric: string;
  binCount: number;
  showRegression: boolean;
  sortBy?: string;
  sortOrder?: string;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  showXLabel?: boolean;
  showYLabel?: boolean;
  xTickFormat?: string;
  yTickFormat?: string;
  groupByLabel?: string;
  aggregateLabel?: string;
  colors?: Record<string, string>;
}

interface FrontendPlotConfig {
  type: string;
  xAxis: string;
  yAxis?: string;
  groupBy?: string;
  aggregate?: string;
  scaleX: string;
  scaleY: string;
  metric: string;
  binCount: number;
  showRegression: boolean;
  sortBy?: string;
  sortOrder?: string;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  showXLabel?: boolean;
  showYLabel?: boolean;
  xTickFormat?: string;
  yTickFormat?: string;
  groupByLabel?: string;
  aggregateLabel?: string;
  colors?: Record<string, string>;
}

interface PlotMetadata {
  token: string;
  title?: string;
  projectName: string;
  createdAt: string;
  createdBy: string;
}

interface AdminPlotConfigResponse {
  userId: string;
  organizationId: number | null;
  config: OrchestraPlotConfig;
  projectConfig: Record<string, unknown>;
  metadata: PlotMetadata;
}

interface UserOrganization {
  id: number;
  name: string;
  roleId: number;
  roleName: string;
  apiKey: string;
}

interface AdminUserResponse {
  id: string;
  apiKey: string;
  organizations: UserOrganization[];
}

interface LogEntry {
  id: number;
  ts: string;
  entries?: Record<string, unknown>;
  derivedEntries?: Record<string, unknown>;
  clippedFields?: Record<string, unknown>;
}

interface LogsResponse {
  logs: LogEntry[];
  count?: number;
}

type DataLabel = [string, number];
type GroupedDataLabel = [string, DataLabel];

interface MetricsValue {
  [metric: string]: number | null | undefined;
}

export interface FetchPlotDataOptions {
  /** Shorter timeout for OG generation */
  timeoutMs?: number;
}

export interface PlotDataResult {
  config: FrontendPlotConfig;
  data: Record<string, unknown>[];
  fields: Record<string, unknown>;
  metadata: PlotMetadata;
  preAggregatedBarData?: DataLabel[] | GroupedDataLabel[];
  isGroupedBarChart?: boolean;
}

export interface PlotDataError {
  error: string;
  status: number;
  expired?: boolean;
}

export type FetchPlotDataResult =
  | { success: true; data: PlotDataResult }
  | { success: false; error: PlotDataError };

// =============================================================================
// Helper Functions
// =============================================================================

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

function prefixAxis(axis: string | undefined | null): string | undefined {
  if (!axis) return undefined;

  if (axis.includes('.')) {
    const [prefix, field] = axis.split('.', 2);
    return `${prefix}.${snakeToCamel(field)}`;
  }

  return `table1.${snakeToCamel(axis)}`;
}

function transformLogsForFrontend(rawLogs: LogEntry[]): Record<string, unknown>[] {
  return rawLogs.map((log) => {
    const rawEntries = log.entries || {};
    const rawDerivedEntries = log.derivedEntries || {};
    const rawClippedFields = log.clippedFields || {};

    const combinedEntries = { ...rawEntries, ...rawDerivedEntries };

    const prefixedEntries: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(combinedEntries)) {
      prefixedEntries[`table1.${key}`] = value;
    }

    const prefixedDerivedEntries: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawDerivedEntries)) {
      prefixedDerivedEntries[`table1.${key}`] = value;
    }

    return {
      type: 'ungrouped',
      id: log.id,
      ts: log.ts,
      'table1.id': log.id,
      'table1.ts': log.ts,
      entries: combinedEntries,
      derivedEntries: rawDerivedEntries,
      clippedFields: rawClippedFields,
      'table1.entries': prefixedEntries,
      'table1.derivedEntries': prefixedDerivedEntries,
      'table1.clippedFields': rawClippedFields,
    };
  });
}

function transformFieldsForFrontend(rawFields: Record<string, unknown>): Record<string, unknown> {
  const prefixedFields: Record<string, unknown> = {};
  for (const [fieldName, fieldMeta] of Object.entries(rawFields)) {
    prefixedFields[`table1.${fieldName}`] = fieldMeta;
  }
  return prefixedFields;
}

function toOrchestraField(field: string): string {
  let cleanField = field.replace(/^table1\./, '');
  cleanField = cleanField.replace(/^(entries|derived_entries)\//, '');
  return cleanField;
}

function convertMetricsToDataLabels(
  metricsResponse: Record<string, Record<string, MetricsValue> | MetricsValue>,
  yAxisField: string,
  metric: string
): DataLabel[] {
  const fieldMetrics = metricsResponse[yAxisField] || metricsResponse;
  return Object.entries(fieldMetrics).map(([category, values]) => {
    const valuesObj = values as MetricsValue;
    const value = valuesObj.sharedValue ?? valuesObj[metric] ?? valuesObj.shared_value ?? 0;
    return [category, typeof value === 'number' ? value : 0] as DataLabel;
  });
}

function convertMetricsToGroupedDataLabels(
  metricsResponse: Record<string, Record<string, Record<string, MetricsValue>>>,
  yAxisField: string,
  metric: string
): GroupedDataLabel[] {
  const result: GroupedDataLabel[] = [];
  // Fall back to metricsResponse if yAxisField key doesn't exist (same as non-grouped version)
  const fieldMetrics = metricsResponse[yAxisField] || metricsResponse;

  for (const [groupKey, categories] of Object.entries(fieldMetrics)) {
    for (const [category, values] of Object.entries(categories as Record<string, MetricsValue>)) {
      // Handle both camelCase and snake_case response formats
      const value = values.sharedValue ?? values[metric] ?? values.shared_value ?? 0;
      result.push([groupKey, [category, typeof value === 'number' ? value : 0]]);
    }
  }
  return result;
}

async function fetchBarChartMetrics(
  userApiKey: string,
  projectName: string,
  context: string | null,
  xAxis: string,
  yAxis: string,
  metric: string,
  groupBy: string | null,
  filterExpr: string | null,
  timeoutMs: number
): Promise<{ data: DataLabel[] | GroupedDataLabel[]; isGrouped: boolean } | null> {
  try {
    const params = new URLSearchParams();
    params.set('project_name', projectName);
    if (context) params.set('context', context);
    params.set('key', toOrchestraField(yAxis));

    const groupByFields = groupBy
      ? [toOrchestraField(groupBy), toOrchestraField(xAxis)]
      : [toOrchestraField(xAxis)];
    params.set('group_by', JSON.stringify(groupByFields));

    if (filterExpr) params.set('filter_expr', filterExpr);

    const metricsUrl = `${ORCHESTRA_URL}/v0/logs/metric/${metric}?${params.toString()}`;
    const response = await fetchWithTimeout(
      metricsUrl,
      {
        headers: {
          Authorization: `Bearer ${userApiKey}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
      timeoutMs
    );

    if (!response.ok) {
      console.warn('[plotData] Bar chart metrics fetch failed:', response.status);
      return null;
    }

    const metricsData = await response.json();
    console.log(
      '[plotData] Bar chart metrics response keys:',
      Object.keys(metricsData).slice(0, 5),
      '... (total:',
      Object.keys(metricsData).length,
      ')'
    );

    if (groupBy) {
      const data = convertMetricsToGroupedDataLabels(metricsData, yAxis, metric);
      console.log('[plotData] Grouped bar data converted:', data.length, 'items');
      return {
        data,
        isGrouped: true,
      };
    } else {
      const data = convertMetricsToDataLabels(metricsData, yAxis, metric);
      console.log('[plotData] Bar data converted:', data.length, 'items');
      return {
        data,
        isGrouped: false,
      };
    }
  } catch (err) {
    console.warn('[plotData] Bar chart metrics fetch error:', err);
    return null;
  }
}

function normalizeConfigForFrontend(config: OrchestraPlotConfig): FrontendPlotConfig {
  return {
    type: config.type,
    xAxis: prefixAxis(config.xAxis) || '',
    yAxis: prefixAxis(config.yAxis),
    groupBy: prefixAxis(config.groupBy),
    aggregate: config.aggregate,
    scaleX: config.scaleX || 'linear',
    scaleY: config.scaleY || 'linear',
    metric: config.metric || 'mean',
    binCount: config.binCount || 10,
    showRegression: config.showRegression || false,
    sortBy: config.sortBy,
    sortOrder: config.sortOrder,
    title: config.title,
    xLabel: config.xLabel,
    yLabel: config.yLabel,
    showXLabel: config.showXLabel,
    showYLabel: config.showYLabel,
    xTickFormat: config.xTickFormat,
    yTickFormat: config.yTickFormat,
    groupByLabel: config.groupByLabel,
    aggregateLabel: config.aggregateLabel,
    colors: config.colors,
  };
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Fetch plot data for a given token.
 *
 * This is the core logic shared between the API route and OG image generation.
 * Returns either success with data or failure with error details.
 */
export async function fetchPlotData(
  token: string,
  options: FetchPlotDataOptions = {}
): Promise<FetchPlotDataResult> {
  console.log('[plotData] === fetchPlotData START ===');
  console.log('[plotData] Input token:', token);
  console.log('[plotData] Options:', JSON.stringify(options));
  console.log('[plotData] ORCHESTRA_URL:', ORCHESTRA_URL);
  console.log('[plotData] ORCHESTRA_ADMIN_KEY present:', !!ORCHESTRA_ADMIN_KEY);

  const { timeoutMs = REQUEST_TIMEOUT_MS } = options;

  // Validate token format (12 hex chars)
  if (!/^[a-f0-9]{12}$/.test(token)) {
    console.error('[plotData] Invalid token format:', token);
    return {
      success: false,
      error: { error: 'Invalid token format', status: 400 },
    };
  }
  console.log('[plotData] Token format valid');

  // Check for admin key
  if (!ORCHESTRA_ADMIN_KEY) {
    console.error('[plotData] ORCHESTRA_ADMIN_KEY not configured');
    return {
      success: false,
      error: { error: 'Server configuration error', status: 500 },
    };
  }
  console.log('[plotData] Admin key configured, proceeding...');

  try {
    // ========================================================================
    // Step 1: Fetch plot config from admin endpoint
    // ========================================================================
    console.log('[plotData] Step 1: Fetching plot config...');
    const configUrl = `${ORCHESTRA_URL}/v0/admin/logs/plot?token=${token}`;
    console.log('[plotData] Config URL:', configUrl);
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
          error: { error: 'Plot not found or expired', status: 404, expired: true },
        };
      }

      const errorData = await configRes.json().catch(() => ({}));
      console.error('[plotData] Failed to fetch plot config:', errorData);
      return {
        success: false,
        error: {
          error: errorData.detail || 'Failed to fetch plot config',
          status: configRes.status,
        },
      };
    }

    const plotConfig: AdminPlotConfigResponse = snakeToCamelObject(await configRes.json());
    console.log('[plotData] Step 1 SUCCESS - Config fetched');
    console.log('[plotData] userId:', plotConfig.userId);
    console.log('[plotData] organizationId:', plotConfig.organizationId);
    console.log('[plotData] metadata:', JSON.stringify(plotConfig.metadata));

    // ========================================================================
    // Step 2: Fetch user data and extract the appropriate API key
    // ========================================================================
    console.log('[plotData] Step 2: Fetching user data...');
    const userUrl = `${ORCHESTRA_URL}/v0/admin/user/by-user-id?user_id=${encodeURIComponent(plotConfig.userId)}`;
    console.log('[plotData] User URL:', userUrl);
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
      console.error('[plotData] Failed to fetch user:', errorText);
      return {
        success: false,
        error: { error: 'Failed to retrieve user credentials', status: 500 },
      };
    }

    const userData: AdminUserResponse = snakeToCamelObject(await userRes.json());

    // Determine the correct API key based on organization context
    let userApiKey: string | undefined;

    if (plotConfig.organizationId) {
      const targetOrg = userData.organizations?.find((org) => org.id === plotConfig.organizationId);
      if (targetOrg?.apiKey) {
        userApiKey = targetOrg.apiKey;
      } else {
        console.error(
          `[plotData] User ${plotConfig.userId} has no API key for org ${plotConfig.organizationId}`
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
      console.error('[plotData] No API key found for user');
      return {
        success: false,
        error: { error: 'User credentials not available', status: 500 },
      };
    }
    console.log('[plotData] Step 2 SUCCESS - Got API key (length:', userApiKey.length, ')');

    // ========================================================================
    // Step 3: Extract project config and check chart type
    // ========================================================================
    const projectConfig = plotConfig.projectConfig;
    console.log('[plotData] projectConfig:', JSON.stringify(projectConfig));

    const projectName = plotConfig.metadata?.projectName;
    if (!projectName) {
      console.error('[plotData] No project name found in metadata');
      return {
        success: false,
        error: { error: 'Plot configuration missing project name', status: 400 },
      };
    }

    // Check if this is a bar chart - we can use pre-aggregated data and skip slow logs fetch
    const isBarChart = plotConfig.config.type === 'Bar Chart' || plotConfig.config.type === 'bar';
    let preAggregatedBarData: DataLabel[] | GroupedDataLabel[] | undefined;
    let isGroupedBarChart: boolean | undefined;
    let rawLogs: LogEntry[] = [];

    // ========================================================================
    // Step 3a: For Bar Charts, try pre-aggregated metrics first (faster)
    // ========================================================================
    if (isBarChart && plotConfig.config.xAxis && plotConfig.config.yAxis) {
      console.log(
        '[plotData] Step 3a: Bar chart detected, fetching pre-aggregated metrics first...'
      );
      const barChartResult = await fetchBarChartMetrics(
        userApiKey,
        projectName,
        (projectConfig.context as string) || null,
        plotConfig.config.xAxis,
        plotConfig.config.yAxis,
        plotConfig.config.metric || 'mean',
        plotConfig.config.groupBy || null,
        (projectConfig.filterExpr as string) || null,
        timeoutMs
      );

      if (barChartResult) {
        preAggregatedBarData = barChartResult.data;
        isGroupedBarChart = barChartResult.isGrouped;
        console.log(
          '[plotData] Step 3a SUCCESS - Got pre-aggregated bar data:',
          preAggregatedBarData.length,
          'items'
        );
      } else {
        console.log('[plotData] Step 3a WARN - Pre-aggregated metrics failed, will try raw logs');
      }
    }

    // ========================================================================
    // Step 3b: Fetch raw logs (skip for bar charts if we have pre-aggregated data)
    // ========================================================================
    if (!preAggregatedBarData || !isBarChart) {
      console.log('[plotData] Step 3b: Fetching raw logs...');
      const logsParams = new URLSearchParams();
      logsParams.append('project_name', projectName);

      if (projectConfig.context) {
        logsParams.append('context', projectConfig.context as string);
      }
      if (projectConfig.columnContext) {
        logsParams.append('column_context', projectConfig.columnContext as string);
      }
      if (projectConfig.filterExpr) {
        logsParams.append('filter_expr', projectConfig.filterExpr as string);
      }
      if (projectConfig.limit) {
        logsParams.append('limit', String(projectConfig.limit));
      }
      if (projectConfig.offset) {
        logsParams.append('offset', String(projectConfig.offset));
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
      if (projectConfig.randomize) {
        logsParams.append('randomize', String(projectConfig.randomize));
      }

      const logsUrl = `${ORCHESTRA_URL}/v0/logs?${logsParams.toString()}`;
      console.log(
        '[plotData] Logs URL:',
        logsUrl.substring(0, 200) + (logsUrl.length > 200 ? '...' : '')
      );
      const logsStartTime = Date.now();
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
        const responseText = await logsRes.text();
        let errorData: Record<string, unknown> = {};
        try {
          errorData = JSON.parse(responseText);
        } catch {
          // Response is not JSON
        }
        console.error(
          '[plotData] Failed to fetch logs - Status:',
          logsRes.status,
          'Response:',
          responseText.substring(0, 500)
        );
        // For bar charts with pre-aggregated data, we can continue without raw logs
        if (preAggregatedBarData) {
          console.log('[plotData] Continuing with pre-aggregated data only (raw logs failed)');
        } else {
          const errorMessage =
            typeof errorData.detail === 'string'
              ? errorData.detail
              : `Failed to fetch log data (${logsRes.status})`;
          return {
            success: false,
            error: { error: errorMessage, status: logsRes.status },
          };
        }
      } else {
        const logsData: LogsResponse = snakeToCamelObject(await logsRes.json());
        rawLogs = logsData.logs || [];
        console.log(
          '[plotData] Step 3b SUCCESS - Got',
          rawLogs.length,
          'logs in',
          Date.now() - logsStartTime,
          'ms'
        );
      }
    } else {
      console.log('[plotData] Step 3b SKIPPED - Using pre-aggregated bar chart data');
    }

    // ========================================================================
    // Step 4: Fetch fields metadata
    // ========================================================================
    console.log('[plotData] Step 4: Fetching fields metadata...');
    const fieldsParams = new URLSearchParams();
    fieldsParams.append('project_name', projectName);
    if (projectConfig.context) {
      fieldsParams.append('context', projectConfig.context as string);
    }
    if (projectConfig.columnContext) {
      fieldsParams.append('column_context', projectConfig.columnContext as string);
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

    let rawFields: Record<string, unknown> = {};
    if (fieldsRes.ok) {
      rawFields = snakeToCamelObject(await fieldsRes.json());
      console.log('[plotData] Step 4 SUCCESS - Got', Object.keys(rawFields).length, 'fields');
    } else {
      console.warn('[plotData] Step 4 WARN - Failed to fetch fields, continuing without');
    }

    // ========================================================================
    // Step 5: Transform data
    // ========================================================================
    console.log('[plotData] Step 5: Transforming data...');
    const transformedData = transformLogsForFrontend(rawLogs);
    console.log('[plotData] Transformed', transformedData.length, 'data points');
    const transformedFields = transformFieldsForFrontend(rawFields);
    const normalizedConfig = normalizeConfigForFrontend(plotConfig.config);

    // Note: Bar chart pre-aggregation is now handled in Step 3a for better performance

    console.log('[plotData] === fetchPlotData SUCCESS ===');
    console.log(
      '[plotData] Returning',
      transformedData.length,
      'data points,',
      Object.keys(transformedFields).length,
      'fields'
    );

    return {
      success: true,
      data: {
        config: normalizedConfig,
        data: transformedData,
        fields: transformedFields,
        metadata: {
          ...plotConfig.metadata,
          projectName,
        },
        ...(preAggregatedBarData && {
          preAggregatedBarData,
          isGroupedBarChart,
        }),
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[plotData] Request timeout');
      return {
        success: false,
        error: { error: 'Request timed out. Please try again.', status: 504 },
      };
    }

    console.error('[plotData] Unexpected error:', error);
    return {
      success: false,
      error: { error: 'Failed to load plot', status: 500 },
    };
  }
}
