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
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

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
  const fieldMetrics = metricsResponse[yAxisField] || {};

  for (const [groupKey, categories] of Object.entries(fieldMetrics)) {
    for (const [category, values] of Object.entries(categories as Record<string, MetricsValue>)) {
      const value = values.sharedValue ?? values[metric] ?? 0;
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
      console.warn('[plotData] Bar chart metrics fetch failed, falling back to raw logs');
      return null;
    }

    const metricsData = await response.json();

    if (groupBy) {
      return {
        data: convertMetricsToGroupedDataLabels(metricsData, yAxis, metric),
        isGrouped: true,
      };
    } else {
      return {
        data: convertMetricsToDataLabels(metricsData, yAxis, metric),
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
  const { timeoutMs = REQUEST_TIMEOUT_MS } = options;

  // Validate token format (12 hex chars)
  if (!/^[a-f0-9]{12}$/.test(token)) {
    return {
      success: false,
      error: { error: 'Invalid token format', status: 400 },
    };
  }

  // Check for admin key
  if (!ORCHESTRA_ADMIN_KEY) {
    console.error('[plotData] ORCHESTRA_ADMIN_KEY not configured');
    return {
      success: false,
      error: { error: 'Server configuration error', status: 500 },
    };
  }

  try {
    // ========================================================================
    // Step 1: Fetch plot config from admin endpoint
    // ========================================================================
    const configUrl = `${ORCHESTRA_URL}/v0/admin/logs/plot?token=${token}`;
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

    // ========================================================================
    // Step 2: Fetch user data and extract the appropriate API key
    // ========================================================================
    const userUrl = `${ORCHESTRA_URL}/v0/admin/auth-user/by-user-id?user_id=${encodeURIComponent(plotConfig.userId)}`;
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

    // ========================================================================
    // Step 3: Call /v0/logs with user's API key
    // ========================================================================
    const projectConfig = plotConfig.projectConfig;
    const logsParams = new URLSearchParams();

    const projectName = plotConfig.metadata?.projectName;
    if (!projectName) {
      console.error('[plotData] No project name found in metadata');
      return {
        success: false,
        error: { error: 'Plot configuration missing project name', status: 400 },
      };
    }
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
      console.error('[plotData] Failed to fetch logs:', errorData);
      return {
        success: false,
        error: { error: errorData.detail || 'Failed to fetch log data', status: logsRes.status },
      };
    }

    const logsData: LogsResponse = snakeToCamelObject(await logsRes.json());
    const rawLogs = logsData.logs || [];

    // ========================================================================
    // Step 4: Fetch fields metadata
    // ========================================================================
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
    } else {
      console.warn('[plotData] Failed to fetch fields, continuing without');
    }

    // ========================================================================
    // Step 5: Transform data
    // ========================================================================
    const transformedData = transformLogsForFrontend(rawLogs);
    const transformedFields = transformFieldsForFrontend(rawFields);
    const normalizedConfig = normalizeConfigForFrontend(plotConfig.config);

    // ========================================================================
    // Step 6: For Bar Charts, fetch pre-aggregated data
    // ========================================================================
    let preAggregatedBarData: DataLabel[] | GroupedDataLabel[] | undefined;
    let isGroupedBarChart: boolean | undefined;

    const isBarChart = plotConfig.config.type === 'Bar Chart' || plotConfig.config.type === 'bar';
    if (isBarChart && plotConfig.config.xAxis && plotConfig.config.yAxis) {
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
      }
    }

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
