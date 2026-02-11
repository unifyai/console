/**
 * API route for listing demo assistant metadata
 *
 * GET /api/demo/assistant/meta - List all demo metadata for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL;

export async function GET(request: NextRequest) {
  try {
    const apiKey = await getApiKeyFromRequest(request);
    if (!apiKey) {
      return unauthorized();
    }

    const response = await fetch(`${ORCHESTRA_URL}/v0/demo/assistant/meta/list`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    let data;
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('[demo/assistant/meta GET] Non-JSON response from Orchestra:', text);
      return NextResponse.json(
        { detail: text || 'Orchestra returned a non-JSON error' },
        { status: response.status || 500 }
      );
    }

    if (!response.ok) {
      console.error('[demo/assistant/meta GET] Orchestra error:', data);
      return NextResponse.json(
        { detail: data.detail || 'Failed to list demo metadata' },
        { status: response.status }
      );
    }

    // Orchestra wraps response in InfoResponse { info: [...] }
    // Extract the array and convert each item to camelCase
    const infoArray = data.info || data;
    const camelData = Array.isArray(infoArray)
      ? infoArray.map((item: Record<string, unknown>) => snakeToCamelObject(item))
      : infoArray;

    return NextResponse.json(camelData);
  } catch (error) {
    console.error('[demo/assistant/meta GET] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
