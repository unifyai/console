import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * GET /api/user/api-keys
 *
 * The user's programmatic API keys.
 *
 * Profile can no longer render `user.apiKey`: that is now the Console's
 * own session credential, which is deliberately never shown, because a key
 * the user can copy is a key a script can replay. Orchestra's `/api-keys`
 * excludes Console keys, so what comes back here is exactly the set the
 * user is meant to hold.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const client = await getOrchestraUserClient(apiKey);
    const res = await client.get('/api-keys');
    const personalKeys = (res.data?.personal_keys ?? []).map(
      (key: { id: number; name: string; key: string }) => ({
        id: key.id,
        name: key.name,
        key: key.key,
      })
    );
    return NextResponse.json({ personalKeys }, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'api_keys_failed', message: 'Failed to load API keys' };
    return NextResponse.json(data, { status });
  }
}
