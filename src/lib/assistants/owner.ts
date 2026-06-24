import { getUserByID } from '@/lib/user/user';

const ownerApiKeyCache = new Map<string, { apiKey: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolves the API key for an assistant's owner.
 *
 * When a non-owner org member interacts with an assistant via the Console,
 * operations that touch the Assistants project (secrets, tasks, transcripts,
 * etc.) must authenticate as the owner so that reads and writes land in the
 * same Orchestra project namespace the Unity runtime uses.
 *
 * Uses the admin API (`getUserByID`) and caches results for 5 minutes.
 */
export async function resolveOwnerApiKey(ownerId: string): Promise<string> {
  const cached = ownerApiKeyCache.get(ownerId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.apiKey;
  }

  const owner = await getUserByID(ownerId);
  if (!owner?.apiKey) {
    throw new Error(`Could not resolve API key for assistant owner ${ownerId}`);
  }

  ownerApiKeyCache.set(ownerId, {
    apiKey: owner.apiKey,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return owner.apiKey;
}

/**
 * Resolves the API key for an assistant owner, taking organization context
 * into account.
 *
 * If the assistant belongs to an organization, returns the org API key
 * (from the owner's organization memberships) so writes land in the org's
 * project namespace. Falls back to the owner's personal key.
 */
export async function resolveOwnerApiKeyForAssistant(
  ownerId: string,
  organizationId: number | null
): Promise<string> {
  const cached = ownerApiKeyCache.get(`${ownerId}:${organizationId ?? 'personal'}`);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.apiKey;
  }

  const owner = await getUserByID(ownerId);
  if (!owner) {
    throw new Error(`Could not resolve owner user ${ownerId}`);
  }

  let apiKey = owner.apiKey;
  if (organizationId != null && owner.organizations?.length) {
    const org = owner.organizations.find((o) => o.id === organizationId);
    if (org) {
      apiKey = org.apiKey;
    }
  }

  ownerApiKeyCache.set(`${ownerId}:${organizationId ?? 'personal'}`, {
    apiKey,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return apiKey;
}
