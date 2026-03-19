import { regenerateUserKey } from '@/lib/user/key';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { invalidateApiKeyCache } from '@/app/api/_utils/api-key-cache';

/**
 * Regenerates the API key for the current user or active workspace.
 *
 * @returns {Response} A JSON response with the new API key.
 */
export async function GET(Request: NextRequest) {
  const userID = Request.nextUrl.searchParams.get('UserID');
  const organizationID = Request.nextUrl.searchParams.get('OrganizationID');

  if (!userID) {
    return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400 });
  }

  // If OrganizationID is provided, it will regenerate the org key
  const key = await regenerateUserKey(userID, organizationID || undefined);

  // Evict the cached API key so subsequent requests pick up the new key
  // instead of serving the old (now-invalid) one.
  const token = await getToken({ req: Request, secret: process.env.JWT_SECRET });
  if (token?.email && typeof token.email === 'string') {
    invalidateApiKeyCache(token.email);
  }

  return new Response(JSON.stringify({ key }), { status: 200 });
}
