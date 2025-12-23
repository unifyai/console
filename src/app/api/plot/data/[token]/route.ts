/**
 * Plot Data API Route
 *
 * Fetches plot data for a given token from Orchestra.
 *
 * Flow:
 * 1. Fetch plot config from admin endpoint (includes user_id, organization_id)
 * 2. Fetch user's API key from admin user endpoint
 * 3. Call /v0/logs with user's credentials to get data
 * 4. Transform data for D3 rendering and return
 */

import { NextRequest, NextResponse } from "next/server";

const ORCHESTRA_URL =
  process.env.ORCHESTRA_URL || "http://localhost:8000";
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

// ============================================================================
// Types
// ============================================================================

// Config from Orchestra (snake_case)
interface OrchestraPlotConfig {
  type: string;
  x_axis: string;
  y_axis?: string;
  group_by?: string;
  aggregate?: string;
  scale_x: string;
  scale_y: string;
  metric: string;
  bin_count: number;
  show_regression: boolean;
  sort_by?: string;
  sort_order?: string;
  title?: string;
  x_label?: string;
  y_label?: string;
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
  colors?: Record<string, string>;
}

interface PlotMetadata {
  token: string;
  title?: string;
  project_name: string;
  created_at: string;
  created_by: string;
}

interface AdminPlotConfigResponse {
  user_id: string;
  organization_id: number | null;
  config: OrchestraPlotConfig;
  project_config: Record<string, unknown>;
  metadata: PlotMetadata;
}

interface UserOrganization {
  id: number;
  name: string;
  role_id: number;
  role_name: string;
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
  derived_entries?: Record<string, unknown>;
  params?: Record<string, unknown>;
  clipped_fields?: Record<string, unknown>;
}

interface LogsResponse {
  logs: LogEntry[];
  count?: number;
  params?: Record<string, unknown>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Add table1. prefix to axis value if not already prefixed.
 */
function prefixAxis(axis: string | undefined | null): string | undefined {
  if (!axis) return undefined;
  if (axis.includes(".")) return axis;
  return `table1.${axis}`;
}

/**
 * Transform raw logs to the format expected by the frontend PlotCanvas.
 */
function transformLogsForFrontend(
  rawLogs: LogEntry[]
): Record<string, unknown>[] {
  return rawLogs.map((log) => {
    const rawEntries = log.entries || {};
    const rawDerivedEntries = log.derived_entries || {};
    const rawParams = log.params || {};
    const rawClippedFields = log.clipped_fields || {};

    // Merge entries with derived entries
    const combinedEntries = { ...rawEntries, ...rawDerivedEntries };

    // Add table1. prefix to all field keys
    const prefixedEntries: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(combinedEntries)) {
      prefixedEntries[`table1.${key}`] = value;
    }

    const prefixedParams: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawParams)) {
      prefixedParams[`table1.${key}`] = value;
    }

    const prefixedDerivedEntries: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawDerivedEntries)) {
      prefixedDerivedEntries[`table1.${key}`] = value;
    }

    return {
      type: "ungrouped",
      id: log.id,
      ts: log.ts,
      // Table-prefixed id/ts for hover identification
      "table1.id": log.id,
      "table1.ts": log.ts,
      // Original flat structure
      params: rawParams,
      entries: combinedEntries,
      derived_entries: rawDerivedEntries,
      clipped_fields: rawClippedFields,
      // Table-prefixed structure for plot code
      "table1.params": prefixedParams,
      "table1.entries": prefixedEntries,
      "table1.derived_entries": prefixedDerivedEntries,
      "table1.clipped_fields": rawClippedFields,
    };
  });
}

/**
 * Transform fields metadata with table prefix.
 */
function transformFieldsForFrontend(
  rawFields: Record<string, unknown>
): Record<string, unknown> {
  const prefixedFields: Record<string, unknown> = {};
  for (const [fieldName, fieldMeta] of Object.entries(rawFields)) {
    prefixedFields[`table1.${fieldName}`] = fieldMeta;
  }
  return prefixedFields;
}

/**
 * Normalize config from Orchestra (snake_case) to frontend format (camelCase with table1. prefixes).
 */
function normalizeConfigForFrontend(
  config: OrchestraPlotConfig
): FrontendPlotConfig {
  return {
    type: config.type,
    xAxis: prefixAxis(config.x_axis) || "",
    yAxis: prefixAxis(config.y_axis),
    groupBy: prefixAxis(config.group_by),
    aggregate: config.aggregate,
    scaleX: config.scale_x || "linear",
    scaleY: config.scale_y || "linear",
    metric: config.metric || "mean",
    binCount: config.bin_count || 10,
    showRegression: config.show_regression || false,
    sortBy: config.sort_by,
    sortOrder: config.sort_order,
    title: config.title,
    xLabel: config.x_label,
    yLabel: config.y_label,
    colors: config.colors,
  };
}

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;

  // Validate token format (12 hex chars)
  if (!/^[a-f0-9]{12}$/.test(token)) {
    return NextResponse.json(
      { error: "Invalid token format" },
      { status: 400 }
    );
  }

  // Check for admin key
  if (!ORCHESTRA_ADMIN_KEY) {
    console.error("[plot/data] ORCHESTRA_ADMIN_KEY not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    // ========================================================================
    // Step 1: Fetch plot config from admin endpoint
    // ========================================================================
    const configUrl = `${ORCHESTRA_URL}/v0/admin/logs/plot?token=${token}`;
    const configRes = await fetch(configUrl, {
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!configRes.ok) {
      const errorData = await configRes.json().catch(() => ({}));

      if (configRes.status === 404) {
        return NextResponse.json(
          { error: "Plot not found or expired", expired: true },
          { status: 404 }
        );
      }

      console.error("[plot/data] Failed to fetch plot config:", errorData);
      return NextResponse.json(
        { error: errorData.detail || "Failed to fetch plot config" },
        { status: configRes.status }
      );
    }

    const plotConfig: AdminPlotConfigResponse = await configRes.json();

    // ========================================================================
    // Step 2: Fetch user data and extract the appropriate API key
    // ========================================================================
    const userUrl = `${ORCHESTRA_URL}/v0/admin/auth-user/by-user-id?user_id=${encodeURIComponent(plotConfig.user_id)}`;
    const userRes = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error("[plot/data] Failed to fetch user:", errorText);
      return NextResponse.json(
        { error: "Failed to retrieve user credentials" },
        { status: 500 }
      );
    }

    const userData: AdminUserResponse = await userRes.json();

    // Determine the correct API key based on organization context
    let userApiKey: string | undefined;

    if (plotConfig.organization_id) {
      // Find the org-specific API key
      const targetOrg = userData.organizations?.find(
        (org) => org.id === plotConfig.organization_id
      );
      if (targetOrg?.apiKey) {
        userApiKey = targetOrg.apiKey;
      } else {
        console.error(
          `[plot/data] User ${plotConfig.user_id} has no API key for org ${plotConfig.organization_id}`
        );
        return NextResponse.json(
          { error: "User credentials not available for this organization" },
          { status: 500 }
        );
      }
    } else {
      // Use personal API key
      userApiKey = userData.apiKey;
    }

    if (!userApiKey) {
      console.error("[plot/data] No API key found for user");
      return NextResponse.json(
        { error: "User credentials not available" },
        { status: 500 }
      );
    }

    // ========================================================================
    // Step 3: Call /v0/logs with user's API key
    // ========================================================================
    const projectConfig = plotConfig.project_config;
    const logsParams = new URLSearchParams();

    // Required: project name
    if (projectConfig.project_name) {
      logsParams.append("project", projectConfig.project_name as string);
    }

    // Optional parameters
    if (projectConfig.context) {
      logsParams.append("context", projectConfig.context as string);
    }
    if (projectConfig.column_context) {
      logsParams.append(
        "column_context",
        projectConfig.column_context as string
      );
    }
    if (projectConfig.filter_expr) {
      logsParams.append("filter_expr", projectConfig.filter_expr as string);
    }
    if (projectConfig.limit) {
      logsParams.append("limit", String(projectConfig.limit));
    }
    if (projectConfig.offset) {
      logsParams.append("offset", String(projectConfig.offset));
    }
    if (projectConfig.from_fields) {
      logsParams.append("from_fields", projectConfig.from_fields as string);
    }
    if (projectConfig.exclude_fields) {
      logsParams.append(
        "exclude_fields",
        projectConfig.exclude_fields as string
      );
    }
    if (projectConfig.sorting) {
      logsParams.append("sorting", projectConfig.sorting as string);
    }

    const logsUrl = `${ORCHESTRA_URL}/v0/logs?${logsParams.toString()}`;
    const logsRes = await fetch(logsUrl, {
      headers: {
        Authorization: `Bearer ${userApiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!logsRes.ok) {
      const errorData = await logsRes.json().catch(() => ({}));
      console.error("[plot/data] Failed to fetch logs:", errorData);
      return NextResponse.json(
        { error: errorData.detail || "Failed to fetch log data" },
        { status: logsRes.status }
      );
    }

    const logsData: LogsResponse = await logsRes.json();
    const rawLogs = logsData.logs || [];

    // ========================================================================
    // Step 4: Fetch fields metadata
    // ========================================================================
    const fieldsParams = new URLSearchParams();
    if (projectConfig.project_name) {
      fieldsParams.append("project", projectConfig.project_name as string);
    }
    if (projectConfig.context) {
      fieldsParams.append("context", projectConfig.context as string);
    }
    if (projectConfig.column_context) {
      fieldsParams.append(
        "column_context",
        projectConfig.column_context as string
      );
    }

    const fieldsUrl = `${ORCHESTRA_URL}/v0/logs/fields?${fieldsParams.toString()}`;
    const fieldsRes = await fetch(fieldsUrl, {
      headers: {
        Authorization: `Bearer ${userApiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    let rawFields: Record<string, unknown> = {};
    if (fieldsRes.ok) {
      rawFields = await fieldsRes.json();
    } else {
      console.warn("[plot/data] Failed to fetch fields, continuing without");
    }

    // ========================================================================
    // Step 5: Transform data and return
    // ========================================================================
    const transformedData = transformLogsForFrontend(rawLogs);
    const transformedFields = transformFieldsForFrontend(rawFields);
    const normalizedConfig = normalizeConfigForFrontend(plotConfig.config);

    // Add project_name to metadata for frontend (it's in project_config)
    const projectName =
      (projectConfig.project_name as string) || "Unknown Project";

    return NextResponse.json({
      config: normalizedConfig,
      data: transformedData,
      fields: transformedFields,
      metadata: {
        ...plotConfig.metadata,
        project_name: projectName,
      },
    });
  } catch (error) {
    console.error("[plot/data] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to load plot" }, { status: 500 });
  }
}
