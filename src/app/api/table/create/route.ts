/**
 * POST /api/table/create
 *
 * Proxy endpoint to create shareable table view URLs via Orchestra backend.
 *
 * This route acts as a pass-through to the Orchestra POST /logs/table endpoint,
 * which handles:
 * - Table view creation and storage in the database
 * - Token generation
 *
 * Authentication: Requires user API key in Authorization header.
 * The API key is forwarded to Orchestra for authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest, internalError } from '../../_utils/auth';
import { camelToSnakeObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

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
 * Request body structure (passthrough to Orchestra)
 */
interface CreateTableViewRequest {
  // Table display configuration
  tableConfig?: {
    columns?: {
      visible?: string[];
      hidden?: string[];
      order?: string[];
      widths?: Record<string, number>;
    };
    rowLimit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };

  // Project configuration (required)
  projectConfig: {
    projectName: string;
    context?: string;
    filter?: string;
    fromFields?: string;
    excludeFields?: string;
    limit?: number;
    offset?: number;
    sorting?: string;
  };

  title?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  // Parse request body
  let body: CreateTableViewRequest;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  // Basic validation before forwarding
  if (!body.projectConfig?.projectName) {
    return badRequest('Missing projectConfig.projectName');
  }

  try {
    // Transform body to snake_case for Orchestra
    const snakeBody = camelToSnakeObject(body);

    // Forward request to Orchestra backend
    const orchestraResponse = await fetchWithTimeout(`${ORCHESTRA_URL}/v0/logs/table`, {
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
        { error: responseData.detail || responseData.error || 'Table view creation failed' },
        { status: orchestraResponse.status }
      );
    }

    // Return simplified response for console
    return NextResponse.json(
      {
        url: responseData.url,
        token: responseData.token,
      },
      { status: 201 }
    );
  } catch (error) {
    // Handle timeout errors specifically
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[table/create] Request timeout');
      return NextResponse.json({ error: 'Request timed out. Please try again.' }, { status: 504 });
    }

    console.error('[table/create] Failed to proxy to Orchestra:', error);
    return internalError('Failed to create table view');
  }
}
