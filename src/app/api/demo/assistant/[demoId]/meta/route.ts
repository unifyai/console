/**
 * API route for demo assistant metadata
 *
 * GET /api/demo/assistant/[demoId]/meta - Get metadata for a demo assistant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ demoId: string }> }
) {
  const { demoId } = await params;
  try {
    const apiKey = await getApiKeyFromRequest(request);
    if (!apiKey) {
      return unauthorized();
    }

    const response = await fetch(`${ORCHESTRA_URL}/v0/demo/assistant/${demoId}/meta`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || 'Failed to get demo metadata' },
        { status: response.status }
      );
    }

    return NextResponse.json(snakeToCamelObject(data));
  } catch (error) {
    console.error('[demo/assistant/meta GET] Error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
