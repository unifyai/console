import { isSelfHost } from '@/lib/environment/environment';
import { getCurrentUser } from '@/lib/user/user';

/**
 * Orchestra API key for server-side routes that are not tied to a user session
 * in hosted mode (liveview startup_events, client diagnostics).
 *
 * Hosted mode uses ``ORCHESTRA_ADMIN_KEY`` so fleet audit reads hit the
 * platform ``AssistantJobs`` system project as ``__system__`` — never a
 * purgeable Workspace user key.
 *
 * Self-host uses the signed-in user's key (or local owner key) as today.
 */
export async function resolveOrchestraApiKeyForServerOps(): Promise<string | null> {
  if (isSelfHost()) {
    const user = await getCurrentUser();
    if (user?.apiKey) {
      return user.apiKey;
    }
  }
  const adminKey = process.env.ORCHESTRA_ADMIN_KEY?.trim();
  return adminKey || null;
}
