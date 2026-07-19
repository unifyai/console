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
 * 1. Direct config: Provide explicit plotConfig
 * 2. Description-based: Provide a natural language description (uses LLM credits)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest, internalError } from '../../_utils/auth';
import { camelToSnakeObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';

/**
 * Request body structure (passthrough to Orchestra)
 */
interface CreatePlotRequest {
  // Option 1: Direct config
  plotConfig?: {
    type?: string;
    xAxis: string;
    yAxis?: string;
    groupBy?: string;
    aggregate?: string;
    scaleX?: string;
    scaleY?: string;
    metric?: string;
    binCount?: number;
    showRegression?: boolean;
    colors?: Record<string, string>;
    sortBy?: string;
    sortOrder?: string;
    title?: string;
    xLabel?: string;
    yLabel?: string;
  };

  // Option 2: Description-based (LLM inference - billed to user's account)
  description?: string;

  // Project configuration (required for both modes)
  projectConfig: {
    projectName: string;
    context?: string;
    columnContext?: string;
    filter?: string;
    fromIds?: string;
    excludeIds?: string;
    fromFields?: string;
    excludeFields?: string;
    limit?: number;
    offset?: number;
    groupBy?: string[];
    groupLimit?: number;
    groupOffset?: number;
    groupDepth?: number;
    groupsOnly?: boolean;
    nestedGroups?: boolean;
    sorting?: string;
    groupSorting?: string;
    valueLimit?: number;
    randomize?: boolean;
    seed?: string;
  };

  title?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  // Parse request body
  let body: CreatePlotRequest;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  // Basic validation before forwarding
  if (!body.projectConfig?.projectName) {
    return badRequest('Missing projectConfig.projectName');
  }

  if (!body.plotConfig && !body.description) {
    return badRequest('Either plotConfig or description is required');
  }

  try {
    // Transform body to snake_case for Orchestra
    const snakeBody = camelToSnakeObject(body);

    // Forward request to Orchestra backend
    const orchestraResponse = await fetch(`${ORCHESTRA_URL}/v0/logs/plot`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(snakeBody),
    });

    // Get response data
    const responseData = await orchestraResponse.json();

    // If Orchestra returned an error, pass it through
    if (!orchestraResponse.ok) {
      return NextResponse.json(
        { error: responseData.detail || responseData.error || 'Plot creation failed' },
        { status: orchestraResponse.status }
      );
    }

    // Transform response to match expected console format
    // Orchestra returns: { url, token, plotConfig, projectConfig, plot_metadata, user_metadata, inferred_config? }
    // Console expects: { url, token, inferred_config? }
    const consoleResponse: Record<string, unknown> = {
      url: responseData.url,
      token: responseData.token,
    };

    // Include inferred config if present
    if (responseData.inferred_config) {
      consoleResponse.inferred_config = {
        type: responseData.inferred_config.type,
        xAxis: responseData.inferred_config.xAxis,
        yAxis: responseData.inferred_config.yAxis,
        groupBy: responseData.inferred_config.groupBy,
        confidence: responseData.inferred_config.confidence,
        reasoning: responseData.inferred_config.reasoning,
      };
    }

    return NextResponse.json(consoleResponse, { status: 201 });
  } catch (error) {
    console.error('[plot/create] Failed to proxy to Orchestra:', error);
    return internalError('Failed to create plot');
  }
}
