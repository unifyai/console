/**
 * POST /api/plot/create
 *
 * Endpoint to create shareable plot URLs.
 * Stores plot and project configuration, returns a URL to the plot viewer.
 *
 * Authentication: Requires user API key in Authorization header.
 *
 * Supports two modes:
 * 1. Direct config: Provide explicit plot_config
 * 2. Description-based: Provide a natural language description to infer config
 */

import { NextRequest, NextResponse } from "next/server";
import { storePlotToken, PlotConfig, ProjectConfig } from "@/lib/plot/store";
import { normalizeConfig, buildFieldsParams } from "@/lib/plot/normalization";
import {
  inferPlotConfigFromDescription,
  InferredPlotConfig,
} from "@/lib/plot/llm-config";

const ORCHESTRA_URL = process.env.ORCHESTRA_URL;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";

// Default TTL: 24 hours
const DEFAULT_TTL_HOURS = 24;

/**
 * Request body structure
 */
interface CreatePlotRequest {
  // Option 1: Direct config
  plot_config?: {
    type?: string; // "scatter" | "bar" | "histogram" | "line" (or full names)
    plot_type?: string; // Alternative: "Scatter Plot", "Bar Chart", etc.
    x_axis: string;
    y_axis?: string;
    group_by?: string;
    aggregate?: string;
    scale_x?: string;
    scale_y?: string;
    metric?: string;
    bin_count?: number;
    show_regression?: boolean;
    colors?: Record<string, string>;
  };

  // Option 2: Description-based (LLM inference)
  description?: string;

  // Project configuration (required for both modes)
  project_config: {
    project_name: string;
    context?: string;
    column_context?: string;
    filter_expr?: string;
    from_ids?: string;
    exclude_ids?: string;
    from_fields?: string;
    exclude_fields?: string;
    limit?: number;
    offset?: number;
    group_by?: string[];
    group_limit?: number;
    group_offset?: number;
    group_depth?: number;
    groups_only?: boolean;
    nested_groups?: boolean;
    sorting?: string;
    group_sorting?: string;
    value_limit?: number;
    randomize?: boolean;
    seed?: string;
  };

  title?: string;
}

/**
 * Response body structure
 */
interface CreatePlotResponse {
  url: string;
  token: string;
  inferred_config?: {
    type: string;
    x_axis: string;
    y_axis?: string | null;
    group_by?: string | null;
    confidence: number;
    reasoning?: string;
  };
}

/**
 * Extract API key from Authorization header
 */
function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7); // Remove 'Bearer ' prefix
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Extract API key from Authorization header
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }

  // Parse request body
  let body: CreatePlotRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate project config
  if (!body.project_config?.project_name) {
    return NextResponse.json(
      { error: "Missing project_config.project_name" },
      { status: 400 }
    );
  }

  // Validate that either plot_config or description is provided
  if (!body.plot_config && !body.description) {
    return NextResponse.json(
      { error: "Either plot_config or description is required" },
      { status: 400 }
    );
  }

  let plotConfig: PlotConfig;
  let inferredConfig: InferredPlotConfig | undefined;

  // Mode 2: Description-based inference
  if (body.description && !body.plot_config) {
    if (!ORCHESTRA_URL) {
      return NextResponse.json(
        { error: "Server configuration error - LLM inference not available" },
        { status: 500 }
      );
    }

    // Build project config for fields fetch
    const projectConfigForFields: ProjectConfig = {
      project_name: body.project_config.project_name,
      context: body.project_config.context,
      column_context: body.project_config.column_context,
    };

    // Fetch fields first to know what's available
    const fieldsParams = buildFieldsParams(projectConfigForFields);
    const fieldsRes = await fetch(
      `${ORCHESTRA_URL}/v0/logs/fields?${fieldsParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      }
    );

    if (!fieldsRes.ok) {
      const errorText = await fieldsRes.text();
      console.error("[plot/create] Failed to fetch fields:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch project fields for inference" },
        { status: 502 }
      );
    }

    const fields = await fieldsRes.json();

    try {
      // Infer config from description using Orchestra chat completions
      inferredConfig = await inferPlotConfigFromDescription({
        description: body.description,
        available_fields: Object.keys(fields),
        field_types: Object.fromEntries(
          Object.entries(fields).map(([k, v]: [string, unknown]) => [
            k,
            (v as { data_type?: string }).data_type || "unknown",
          ])
        ),
        apiKey, // Pass user's key for LLM billing
      });

      // Convert inferred config to internal format
      plotConfig = {
        type: inferredConfig.type,
        xAxis: inferredConfig.x_axis,
        yAxis: inferredConfig.y_axis || undefined,
        groupBy: inferredConfig.group_by || undefined,
        aggregate: inferredConfig.aggregate || undefined,
        scaleX: inferredConfig.scale_x || "linear",
        scaleY: inferredConfig.scale_y || "linear",
        metric: inferredConfig.metric || "mean",
        binCount: inferredConfig.bin_count || 10,
        showRegression: inferredConfig.show_regression || false,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "LLM inference failed";
      console.error("[plot/create] LLM inference failed:", message);
      return NextResponse.json(
        { error: `Failed to infer plot config: ${message}` },
        { status: 500 }
      );
    }
  }
  // Mode 1: Direct config
  else if (body.plot_config) {
    // Validate required fields for direct config
    if (!body.plot_config.x_axis) {
      return NextResponse.json(
        { error: "Missing plot_config.x_axis" },
        { status: 400 }
      );
    }

    // Normalize the config
    plotConfig = normalizeConfig(body.plot_config);
  } else {
    // Shouldn't reach here due to earlier validation
    return NextResponse.json(
      { error: "Either plot_config or description is required" },
      { status: 400 }
    );
  }

  // Build project config with all parameters
  const projectConfig: ProjectConfig = {
    project_name: body.project_config.project_name,
    context: body.project_config.context,
    column_context: body.project_config.column_context,
    filter_expr: body.project_config.filter_expr,
    from_ids: body.project_config.from_ids,
    exclude_ids: body.project_config.exclude_ids,
    from_fields: body.project_config.from_fields,
    exclude_fields: body.project_config.exclude_fields,
    limit: body.project_config.limit ?? 1000,
    offset: body.project_config.offset,
    group_by: body.project_config.group_by,
    group_limit: body.project_config.group_limit,
    group_offset: body.project_config.group_offset,
    group_depth: body.project_config.group_depth,
    groups_only: body.project_config.groups_only,
    nested_groups: body.project_config.nested_groups,
    sorting: body.project_config.sorting,
    group_sorting: body.project_config.group_sorting,
    value_limit: body.project_config.value_limit,
    randomize: body.project_config.randomize,
    seed: body.project_config.seed,
  };

  // Calculate TTL
  const ttlSeconds = DEFAULT_TTL_HOURS * 60 * 60;

  // Store token with API key for later data fetching
  const token = storePlotToken(
    plotConfig,
    projectConfig,
    ttlSeconds,
    body.title,
    apiKey
  );

  // Build URL
  const url = `${APP_URL}/plot/view/${token}`;

  // Build response
  const response: CreatePlotResponse = {
    url,
    token,
    // Include inferred config if description was used
    ...(inferredConfig && {
      inferred_config: {
        type: inferredConfig.type,
        x_axis: inferredConfig.x_axis,
        y_axis: inferredConfig.y_axis,
        group_by: inferredConfig.group_by,
        confidence: inferredConfig.confidence,
        reasoning: inferredConfig.reasoning,
      },
    }),
  };

  return NextResponse.json(response, { status: 201 });
}
