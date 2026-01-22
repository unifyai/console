/**
 * Plot Data API Route
 *
 * Fetches plot data for a given token from Orchestra.
 *
 * Flow:
 * 1. Fetch plot config from admin endpoint (includes userId, organizationId)
 * 2. Fetch user's API key from admin user endpoint
 * 3. Call /v0/logs with user's credentials to get data
 * 4. Transform data for D3 rendering and return
 */

import { NextRequest, NextResponse } from 'next/server';
import { badRequest, internalError } from '../../../_utils/auth';
import { snakeToCamelObject, snakeToCamel } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

// ============================================================================
// Types
// ============================================================================

// Config from Orchestra (snake_case)
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

// Config for frontend (camelCase with table1. prefixes)
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
  apiKey: string; // Personal API key
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

// Pre-aggregated bar chart data types
type DataLabel = [string, number];
type GroupedDataLabel = [string, DataLabel];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Add table1. prefix to axis value and convert to camelCase.
 * Orchestra stores field names in snake_case but frontend uses camelCase.
 */
function prefixAxis(axis: string | undefined | null): string | undefined {
  if (!axis) return undefined;

  // If already has table prefix, just convert the field part to camelCase
  if (axis.includes('.')) {
    const [prefix, field] = axis.split('.', 2);
    return `${prefix}.${snakeToCamel(field)}`;
  }

  // Add prefix and convert to camelCase
  return `table1.${snakeToCamel(axis)}`;
}

/**
 * Transform raw logs to the format expected by the frontend PlotCanvas.
 */
function transformLogsForFrontend(rawLogs: LogEntry[]): Record<string, unknown>[] {
  return rawLogs.map((log) => {
    const rawEntries = log.entries || {};
    const rawDerivedEntries = log.derivedEntries || {};
    const rawClippedFields = log.clippedFields || {};

    // Merge entries with derived entries
    const combinedEntries = { ...rawEntries, ...rawDerivedEntries };

    // Add table1. prefix to all field keys
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
      // Table-prefixed id/ts for hover identification
      'table1.id': log.id,
      'table1.ts': log.ts,
      // Original flat structure
      entries: combinedEntries,
      derivedEntries: rawDerivedEntries,
      clippedFields: rawClippedFields,
      // Table-prefixed structure for plot code
      'table1.entries': prefixedEntries,
      'table1.derivedEntries': prefixedDerivedEntries,
      'table1.clippedFields': rawClippedFields,
    };
  });
}

/**
 * Transform fields metadata with table prefix.
 */
function transformFieldsForFrontend(rawFields: Record<string, unknown>): Record<string, unknown> {
  const prefixedFields: Record<string, unknown> = {};
  for (const [fieldName, fieldMeta] of Object.entries(rawFields)) {
    prefixedFields[`table1.${fieldName}`] = fieldMeta;
  }
  return prefixedFields;
}

// Metrics value type from backend
interface MetricsValue {
  [metric: string]: number | null | undefined;
}

/**
 * Convert backend metrics response to DataLabel[] for non-grouped bar charts.
 */
function convertMetricsToDataLabels(
  metricsResponse: Record<string, Record<string, MetricsValue> | MetricsValue>,
  yAxisField: string,
  metric: string
): DataLabel[] {
  // Orchestra returns data directly: { "2026-01-11": { sum: 0.51 }, ... }
  // Or wrapped in field name: { "billed_cost": { "2026-01-11": { sum: 0.51 }, ... } }
  const fieldMetrics = metricsResponse[yAxisField] || metricsResponse;
  return Object.entries(fieldMetrics).map(([category, values]) => {
    // Handle both { sum: value } and direct value formats
    const valuesObj = values as MetricsValue;
    const value = valuesObj.sharedValue ?? valuesObj[metric] ?? valuesObj.shared_value ?? 0;
    return [category, typeof value === 'number' ? value : 0] as DataLabel;
  });
}

/**
 * Convert backend metrics response to GroupedDataLabel[] for grouped bar charts.
 */
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

/**
 * Fetch pre-aggregated bar chart data from backend metrics endpoint.
 */
/**
 * Strip prefixes from field names for Orchestra metrics endpoint.
 * Orchestra expects plain field names (e.g., "billed_cost", not "entries/billed_cost" or "table1.billed_cost").
 */
function toOrchestraField(field: string): string {
  // Strip table1. prefix if present (from frontend format)
  let cleanField = field.replace(/^table1\./, '');
  // Strip entries/ or derived_entries/ prefix if present
  cleanField = cleanField.replace(/^(entries|derived_entries)\//, '');
  return cleanField;
}

async function fetchBarChartMetrics(
  userApiKey: string,
  projectName: string,
  context: string | null,
  xAxis: string,
  yAxis: string,
  metric: string,
  groupBy: string | null,
  filterExpr: string | null
): Promise<{ data: DataLabel[] | GroupedDataLabel[]; isGrouped: boolean } | null> {
  try {
    const params = new URLSearchParams();
    params.set('project_name', projectName); // Orchestra uses snake_case
    if (context) params.set('context', context);
    params.set('key', toOrchestraField(yAxis));

    // Build groupBy: if we have a secondary groupBy, use [groupBy, xAxis] for nested grouping
    // Strip prefixes for Orchestra metrics endpoint
    const groupByFields = groupBy
      ? [toOrchestraField(groupBy), toOrchestraField(xAxis)]
      : [toOrchestraField(xAxis)];
    params.set('group_by', JSON.stringify(groupByFields)); // Orchestra uses snake_case

    if (filterExpr) params.set('filter_expr', filterExpr); // Orchestra uses snake_case

    const metricsUrl = `${ORCHESTRA_URL}/v0/logs/metric/${metric}?${params.toString()}`;
    const response = await fetch(metricsUrl, {
      headers: {
        Authorization: `Bearer ${userApiKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[plot/data] Bar chart metrics fetch failed, falling back to raw logs');
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
    console.warn('[plot/data] Bar chart metrics fetch error:', err);
    return null;
  }
}

/**
 * Normalize config from Orchestra (snake_case) to frontend format (camelCase with table1. prefixes).
 */
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

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const { token } = params;

  // Validate token format (12 hex chars)
  if (!/^[a-f0-9]{12}$/.test(token)) {
    return badRequest('Invalid token format');
  }

  // Check for admin key
  if (!ORCHESTRA_ADMIN_KEY) {
    console.error('[plot/data] ORCHESTRA_ADMIN_KEY not configured');
    return internalError('Server configuration error');
  }

  try {
    // ========================================================================
    // Step 1: Fetch plot config from admin endpoint
    // ========================================================================
    const configUrl = `${ORCHESTRA_URL}/v0/admin/logs/plot?token=${token}`;
    const configRes = await fetch(configUrl, {
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!configRes.ok) {
      const errorData = await configRes.json().catch(() => ({}));

      if (configRes.status === 404) {
        return NextResponse.json(
          { error: 'Plot not found or expired', expired: true },
          { status: 404 }
        );
      }

      console.error('[plot/data] Failed to fetch plot config:', errorData);
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch plot config' },
        { status: configRes.status }
      );
    }

    const plotConfig: AdminPlotConfigResponse = snakeToCamelObject(await configRes.json());

    // ========================================================================
    // Step 2: Fetch user data and extract the appropriate API key
    // ========================================================================
    const userUrl = `${ORCHESTRA_URL}/v0/admin/auth-user/by-user-id?user_id=${encodeURIComponent(plotConfig.userId)}`;
    const userRes = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error('[plot/data] Failed to fetch user:', errorText);
      return NextResponse.json({ error: 'Failed to retrieve user credentials' }, { status: 500 });
    }

    const userData: AdminUserResponse = snakeToCamelObject(await userRes.json());

    // Determine the correct API key based on organization context
    let userApiKey: string | undefined;

    if (plotConfig.organizationId) {
      // Find the org-specific API key
      const targetOrg = userData.organizations?.find((org) => org.id === plotConfig.organizationId);
      if (targetOrg?.apiKey) {
        userApiKey = targetOrg.apiKey;
      } else {
        console.error(
          `[plot/data] User ${plotConfig.userId} has no API key for org ${plotConfig.organizationId}`
        );
        return NextResponse.json(
          { error: 'User credentials not available for this organization' },
          { status: 500 }
        );
      }
    } else {
      // Use personal API key
      userApiKey = userData.apiKey;
    }

    if (!userApiKey) {
      console.error('[plot/data] No API key found for user');
      return NextResponse.json({ error: 'User credentials not available' }, { status: 500 });
    }

    // ========================================================================
    // Step 3: Call /v0/logs with user's API key
    // ========================================================================
    const projectConfig = plotConfig.projectConfig;
    const logsParams = new URLSearchParams();

    // Required: project name (stored in metadata, not projectConfig)
    const projectName = plotConfig.metadata?.projectName;
    if (projectName) {
      logsParams.append('project_name', projectName);
    } else {
      console.error('[plot/data] No project name found in metadata');
      return NextResponse.json(
        { error: 'Plot configuration missing project name' },
        { status: 400 }
      );
    }

    // Optional parameters
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
    const logsRes = await fetch(logsUrl, {
      headers: {
        Authorization: `Bearer ${userApiKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!logsRes.ok) {
      const errorData = await logsRes.json().catch(() => ({}));
      console.error('[plot/data] Failed to fetch logs:', errorData);
      return NextResponse.json(
        { error: errorData.detail || 'Failed to fetch log data' },
        { status: logsRes.status }
      );
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
    const fieldsRes = await fetch(fieldsUrl, {
      headers: {
        Authorization: `Bearer ${userApiKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    let rawFields: Record<string, unknown> = {};
    if (fieldsRes.ok) {
      rawFields = snakeToCamelObject(await fieldsRes.json());
    } else {
      console.warn('[plot/data] Failed to fetch fields, continuing without');
    }

    // ========================================================================
    // Step 5: Transform data and return
    // ========================================================================
    const transformedData = transformLogsForFrontend(rawLogs);
    const transformedFields = transformFieldsForFrontend(rawFields);
    const normalizedConfig = normalizeConfigForFrontend(plotConfig.config);

    // projectName is already defined above from metadata

    // ========================================================================
    // Step 6: For Bar Charts, fetch pre-aggregated data from backend
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
        (projectConfig.filterExpr as string) || null
      );

      if (barChartResult) {
        preAggregatedBarData = barChartResult.data;
        isGroupedBarChart = barChartResult.isGrouped;
      }
    }

    return NextResponse.json({
      config: normalizedConfig,
      data: transformedData,
      fields: transformedFields,
      metadata: {
        ...plotConfig.metadata,
        projectName: projectName,
      },
      // Include pre-aggregated bar chart data if available
      ...(preAggregatedBarData && {
        preAggregatedBarData,
        isGroupedBarChart,
      }),
    });
  } catch (error) {
    console.error('[plot/data] Unexpected error:', error);
    return internalError('Failed to load plot');
  }
}
