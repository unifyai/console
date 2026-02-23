import { getQueryTags } from '@/lib/unify-api/logging/query';
import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';

/**
 * GET /api/logging/getQueryTags
 *
 * Retrieves all query tags associated with the current user.
 *
 * @returns A list of query tags.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const tags = await getQueryTags(apiKey);
    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching query tags:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch query tags',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
