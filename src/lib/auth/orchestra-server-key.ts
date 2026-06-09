import { isSelfHost } from '@/lib/environment/environment';
import { getCurrentUser } from '@/lib/user/user';

/**
 * Orchestra API key for server-side routes that are not tied to a user session
 * in hosted mode (liveview startup_events, client diagnostics).
 *
 * Self-host uses the signed-in user's key instead of SHARED_UNIFY_KEY from env.
 */
export async function resolveOrchestraApiKeyForServerOps(): Promise<string | null> {
  if (isSelfHost()) {
    const user = await getCurrentUser();
    if (user?.apiKey) {
      return user.apiKey;
    }
  }
  const shared = process.env.SHARED_UNIFY_KEY?.trim();
  return shared || null;
}
