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
 *
 * Also reports whether that key currently works. An account still on free
 * credits has a key, but every call it makes is refused with 402, and a
 * key that silently fails is worse than no key at all — so the two travel
 * together and Profile can say so in the same breath as showing it.
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

    // Best-effort: the keys are the point of this route, so a gate lookup
    // that fails must not blank the page. Assume access is allowed, which
    // at worst omits an explanation rather than inventing a restriction.
    let apiAccessAllowed = true;
    try {
      const gate = await client.get('/billing/access-gate');
      apiAccessAllowed = gate.data?.api_access_allowed ?? true;
    } catch {
      apiAccessAllowed = true;
    }

    return NextResponse.json({ personalKeys, apiAccessAllowed }, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'api_keys_failed', message: 'Failed to load API keys' };
    return NextResponse.json(data, { status });
  }
}
