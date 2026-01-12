/**
 * ⚠️ DEPRECATED: Orchestra removed custom endpoints functionality
 * - Orchestra commit 52d29237 (Jan 7, 2026): "removed custom endpoints and api keys"
 * - Deleted Orchestra endpoint: /v0/custom_endpoint/list
 * - These routes will return 404 from Orchestra until the functionality is restored
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, internalError } from '../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const res = await fetch(`${baseUrl}/custom_endpoint/list`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(snakeToCamelObject(data), { status: res.status });
  } catch (error) {
    return internalError('Failed to fetch custom endpoints');
  }
}
