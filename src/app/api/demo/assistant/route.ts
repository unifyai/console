/**
 * API route for demo assistants
 *
 * POST /api/demo/assistant - Create a demo assistant
 * GET /api/demo/assistant - List demo assistants
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL;

export async function POST(request: NextRequest) {
  try {
    const apiKey = await getApiKeyFromRequest(request);
    if (!apiKey) {
      return unauthorized();
    }

    const body = await request.json();
    const snakeBody = camelToSnakeObject(body);

    const response = await fetch(`${ORCHESTRA_URL}/v0/demo/assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(snakeBody),
    });

    // Handle non-JSON responses (e.g., plain text error messages)
    const contentType = response.headers.get('content-type');
    let data;
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('[demo/assistant POST] Non-JSON response from Orchestra:', text);
      return NextResponse.json(
        { detail: text || 'Orchestra returned a non-JSON error' },
        { status: response.status || 500 }
      );
    }

    if (!response.ok) {
      console.error('[demo/assistant POST] Orchestra error:', data);
      return NextResponse.json(
        { detail: data.detail || 'Failed to create demo assistant' },
        { status: response.status }
      );
    }

    return NextResponse.json(snakeToCamelObject(data));
  } catch (error) {
    console.error('[demo/assistant POST] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = await getApiKeyFromRequest(request);
    if (!apiKey) {
      return unauthorized();
    }

    // Use demo_only=true to only get demo assistants
    const response = await fetch(`${ORCHESTRA_URL}/v0/assistant?demo_only=true`, {
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
      console.error('[demo/assistant GET] Non-JSON response from Orchestra:', text);
      return NextResponse.json(
        { detail: text || 'Orchestra returned a non-JSON error' },
        { status: response.status || 500 }
      );
    }

    if (!response.ok) {
      console.error('[demo/assistant GET] Orchestra error:', data);
      return NextResponse.json(
        { detail: data.detail || 'Failed to list demo assistants' },
        { status: response.status }
      );
    }

    return NextResponse.json(snakeToCamelObject(data));
  } catch (error) {
    console.error('[demo/assistant GET] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
