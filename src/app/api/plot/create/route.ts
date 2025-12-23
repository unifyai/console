/**
 * POST /api/plot/create
 *
 * Proxy endpoint to create shareable plot URLs via Orchestra backend.
 *
 * This route acts as a pass-through to the Orchestra POST /logs/plot endpoint,
 * which handles:
 * - Plot creation and storage in the database
 * - LLM inference for description-based plots
 * - Token generation
 *
 * Authentication: Requires user API key in Authorization header.
 * The API key is forwarded to Orchestra for authentication and billing.
 *
 * Supports two modes:
 * 1. Direct config: Provide explicit plot_config
 * 2. Description-based: Provide a natural language description (uses LLM credits)
 */

import { NextRequest, NextResponse } from "next/server";

const ORCHESTRA_URL =
  process.env.ORCHESTRA_URL || "http://localhost:8000";

/**
 * Request body structure (passthrough to Orchestra)
 */
interface CreatePlotRequest {
  // Option 1: Direct config
  plot_config?: {
    type?: string;
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
    sort_by?: string;
    sort_order?: string;
    title?: string;
    x_label?: string;
    y_label?: string;
  };

  // Option 2: Description-based (LLM inference - billed to user's account)
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

  // Basic validation before forwarding
  if (!body.project_config?.project_name) {
    return NextResponse.json(
      { error: "Missing project_config.project_name" },
      { status: 400 }
    );
  }

  if (!body.plot_config && !body.description) {
    return NextResponse.json(
      { error: "Either plot_config or description is required" },
      { status: 400 }
    );
  }

  try {
    // Forward request to Orchestra backend
    const orchestraResponse = await fetch(`${ORCHESTRA_URL}/v0/logs/plot`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    // Get response data
    const responseData = await orchestraResponse.json();

    // If Orchestra returned an error, pass it through
    if (!orchestraResponse.ok) {
      return NextResponse.json(
        { error: responseData.detail || responseData.error || "Plot creation failed" },
        { status: orchestraResponse.status }
      );
    }

    // Transform response to match expected console format
    // Orchestra returns: { url, token, plot_config, project_config, plot_metadata, user_metadata, inferred_config? }
    // Console expects: { url, token, inferred_config? }
    const consoleResponse: Record<string, unknown> = {
      url: responseData.url,
      token: responseData.token,
    };

    // Include inferred config if present
    if (responseData.inferred_config) {
      consoleResponse.inferred_config = {
        type: responseData.inferred_config.type,
        x_axis: responseData.inferred_config.x_axis,
        y_axis: responseData.inferred_config.y_axis,
        group_by: responseData.inferred_config.group_by,
        confidence: responseData.inferred_config.confidence,
        reasoning: responseData.inferred_config.reasoning,
      };
    }

    return NextResponse.json(consoleResponse, { status: 201 });
  } catch (error) {
    console.error("[plot/create] Failed to proxy to Orchestra:", error);
    return NextResponse.json(
      { error: "Failed to create plot" },
      { status: 500 }
    );
  }
}
