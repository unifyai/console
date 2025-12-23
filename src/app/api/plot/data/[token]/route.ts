/**
 * GET /api/plot/data/[token]
 *
 * Fetches plot configuration from cache and logs from Orchestra backend.
 * Returns combined data for the plot viewer page to render.
 *
 * This endpoint is public (no auth required) to enable shareable links.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPlotToken } from "@/lib/plot/store";
import {
  buildLogsParams,
  buildFieldsParams,
} from "@/lib/plot/normalization";

const ORCHESTRA_URL = process.env.ORCHESTRA_URL;

/**
 * Response structure for the plot viewer
 */
interface PlotDataResponse {
  config: {
    type: string;
    xAxis: string;
    yAxis?: string;
    groupBy?: string;
    aggregate?: string;
    scaleX?: string;
    scaleY?: string;
    metric?: string;
    binCount?: number;
    showRegression?: boolean;
    dimensions?: { width: number; height: number };
    margins?: { top: number; right: number; bottom: number; left: number };
    primaryColor?: string;
    colors?: Record<string, string>;
  };
  data: Record<string, unknown>[];
  fields: Record<string, unknown>;
  metadata: {
    title?: string;
    project_name: string;
    created_at: string;
    expires_at: string;
  };
}

/**
 * Error response structure
 */
interface ErrorResponse {
  error: string;
  expired?: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
): Promise<NextResponse<PlotDataResponse | ErrorResponse>> {
  const { token } = params;

  // Validate token format (alphanumeric, 12 chars)
  if (!/^[a-f0-9]{12}$/.test(token)) {
    return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
  }

  // Lookup token in cache
  const tokenData = getPlotToken(token);
  if (!tokenData) {
    return NextResponse.json(
      { error: "Plot not found or expired", expired: true },
      { status: 404 }
    );
  }

  // Check if token has expired (should be handled by NodeCache TTL, but double-check)
  const expiresAt = new Date(tokenData.expires_at);
  if (expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Plot link has expired", expired: true },
      { status: 410 }
    );
  }

  // Validate environment
  if (!ORCHESTRA_URL) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const { plot_config, project_config, created_at, expires_at, title, api_key } =
    tokenData;

  // Validate API key is present
  if (!api_key) {
    return NextResponse.json(
      { error: "Plot configuration is invalid (missing credentials)" },
      { status: 500 }
    );
  }

  try {
    // Build query params for logs and fields requests using normalization module
    const logsParams = buildLogsParams(project_config);
    const fieldsParams = buildFieldsParams(project_config);

    // Fetch logs and fields in parallel using the stored user API key
    const [logsRes, fieldsRes] = await Promise.all([
      fetch(`${ORCHESTRA_URL}/v0/logs?${logsParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${api_key}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }),
      fetch(`${ORCHESTRA_URL}/v0/logs/fields?${fieldsParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${api_key}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }),
    ]);

    if (!logsRes.ok) {
      const errorText = await logsRes.text();
      console.error("[plot/data] Failed to fetch logs:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch plot data" },
        { status: 502 }
      );
    }

    if (!fieldsRes.ok) {
      // Continue without fields - plot may still work
      console.warn("[plot/data] Failed to fetch fields, continuing without");
    }

    const logsData = await logsRes.json();
    const rawFieldsData = fieldsRes.ok ? await fieldsRes.json() : {};

    // Extract logs array from response
    const rawLogs = Array.isArray(logsData) ? logsData : logsData.logs || [];

    // Transform logs to match the format expected by frontend plot code
    // The plot code accesses data using:
    //   log["table1.entries"]["table1.fieldName"]
    // So we need to prefix both the container key AND the field keys within
    const dataArray = rawLogs.map((log: Record<string, unknown>) => {
      const rawEntries = (log.entries as Record<string, unknown>) || {};
      const rawDerivedEntries =
        (log.derived_entries as Record<string, unknown>) || {};
      const rawParams = (log.params as Record<string, unknown>) || {};
      const rawClippedFields =
        (log.clipped_fields as Record<string, unknown>) || {};

      // Merge entries with derived entries
      const combinedEntries = { ...rawEntries, ...rawDerivedEntries };

      // Add table1. prefix to all field keys within entries
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
        // Table-prefixed id/ts for hover identification (plot code uses d["table1.id"])
        "table1.id": log.id,
        "table1.ts": log.ts,
        // Original flat structure (for compatibility)
        params: rawParams,
        entries: combinedEntries,
        derived_entries: rawDerivedEntries,
        clipped_fields: rawClippedFields,
        // Table-prefixed structure expected by plot code
        // Keys within these objects are also prefixed: "table1.latency_ms"
        "table1.params": prefixedParams,
        "table1.entries": prefixedEntries,
        "table1.derived_entries": prefixedDerivedEntries,
        "table1.clipped_fields": rawClippedFields,
      };
    });

    // Transform fields to have table-prefixed keys (e.g., "latency_ms" -> "table1.latency_ms")
    // The plot code expects fields like { "table1.latency_ms": { data_type: "float", ... } }
    const fieldsData: Record<string, unknown> = {};
    for (const [fieldName, fieldMeta] of Object.entries(rawFieldsData)) {
      fieldsData[`table1.${fieldName}`] = fieldMeta;
    }

    // Prefix axis values with "table1." to match transformed data format
    // The plot code expects axis properties like "table1.latency_ms" to match
    // the keys in log["table1.entries"] and fields["table1.latency_ms"]
    const prefixAxis = (axis?: string): string | undefined => {
      if (!axis) return undefined;
      // Don't double-prefix if already has table prefix
      if (axis.includes(".")) return axis;
      return `table1.${axis}`;
    };

    // Build response with prefixed axis values
    const response: PlotDataResponse = {
      config: {
        ...plot_config,
        xAxis: prefixAxis(plot_config.xAxis) as string,
        yAxis: prefixAxis(plot_config.yAxis),
        groupBy: prefixAxis(plot_config.groupBy),
        aggregate: prefixAxis(plot_config.aggregate),
      },
      data: dataArray,
      fields: fieldsData,
      metadata: {
        title,
        project_name: project_config.project_name,
        created_at,
        expires_at,
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=60", // Cache 1 min (data is live)
      },
    });
  } catch (error) {
    console.error("[plot/data] Error fetching plot data:", error);
    return NextResponse.json(
      { error: "Failed to load plot data" },
      { status: 500 }
    );
  }
}
