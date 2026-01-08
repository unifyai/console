import { getQueryTags } from '@/lib/unify-api/logging/query';
import { getCurrentUser } from '@/lib/user/user';
import { NextResponse } from 'next/server';

/**
 * GET /api/logging/getQueryTags
 *
 * Retrieves all query tags associated with the current user.
 *
 * @returns A list of query tags.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const tags = await getQueryTags(user.apiKey);
  return NextResponse.json(tags);
}
