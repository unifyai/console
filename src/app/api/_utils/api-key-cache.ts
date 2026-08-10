/**
 * In-memory cache for resolved API keys.
 *
 * Eliminates redundant getCurrentUser() → Orchestra roundtrips in API route
 * handlers. The first request for a given (email, workspaceId) pair pays the
 * full cost; subsequent requests within the TTL window resolve instantly.
 *
 * The cache is populated as a side-effect of getCurrentUser() (via
 * populateApiKeyCache) and consumed by getApiKeyFromRequest() (via
 * resolveApiKeyFromCache).
 *
 * Security: the cache lives entirely server-side in the Node.js process.
 * No API keys are exposed to the client.
 */

import { isUnifyStaffMember } from '@/lib/auth/unify-staff';
import type { UserOrganization } from '@/types/user';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CachedUserKeys {
  personalApiKey: string;
  personalWorkspaceDisabled: boolean;
  organizations: Array<{
    id: number;
    name: string;
    apiKey: string;
  }>;
  fetchedAt: number;
}

// ---------------------------------------------------------------------------
// Cache store
// ---------------------------------------------------------------------------

const cache = new Map<string, CachedUserKeys>();

/** How long a cache entry is considered fresh (ms). */
export const CACHE_TTL_MS = 60_000; // 60 seconds

/** Max entries before triggering a cleanup sweep. */
const MAX_CACHE_SIZE = 500;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Store the user's API key data in the cache after a successful
 * getCurrentUser() call.
 *
 * Call this BEFORE workspace resolution mutates `user.apiKey`, so the
 * cache stores the original personal key + all org keys.
 */
export function populateApiKeyCache(
  email: string,
  personalApiKey: string,
  organizations: UserOrganization[] | undefined,
  personalWorkspaceDisabled = false
): void {
  cache.set(email, {
    personalApiKey,
    personalWorkspaceDisabled,
    organizations: (organizations ?? []).map((org) => ({
      id: org.id,
      name: org.name,
      apiKey: org.apiKey,
    })),
    fetchedAt: Date.now(),
  });

  if (cache.size > MAX_CACHE_SIZE) {
    evictStaleEntries();
  }
}

/**
 * Try to resolve the workspace-appropriate API key from the cache.
 *
 * @returns The resolved API key, or `null` on cache miss / stale entry.
 */
export function resolveApiKeyFromCache(
  email: string,
  workspaceId: string | undefined,
  headerApiKey: string | null
): string | null {
  const entry = cache.get(email);
  if (!entry) return null;

  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(email);
    return null;
  }

  return resolveWorkspaceApiKey(email, entry, workspaceId, headerApiKey);
}

/**
 * Resolve the user's personal API key from cache without applying workspace
 * locks. Used by server routes that must act on the user's personal
 * coordinator identity even while an org workspace is active.
 */
export function resolvePersonalApiKeyFromCache(email: string): string | null {
  const entry = cache.get(email);
  if (!entry) return null;

  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(email);
    return null;
  }

  if (entry.personalWorkspaceDisabled) return null;

  return entry.personalApiKey;
}

/**
 * Invalidate all cached entries for a given email.
 * Call after key regeneration or org membership changes.
 */
export function invalidateApiKeyCache(email: string): void {
  cache.delete(email);
}

/**
 * Clear the entire cache. Useful in tests.
 */
export function clearApiKeyCache(): void {
  cache.clear();
}

/**
 * Returns the current cache size. Useful for tests.
 */
export function getApiKeyCacheSize(): number {
  return cache.size;
}

// ---------------------------------------------------------------------------
// Workspace resolution (mirrors getCurrentUser logic in user.ts)
// ---------------------------------------------------------------------------

function resolveWorkspaceApiKey(
  email: string,
  entry: CachedUserKeys,
  workspaceId: string | undefined,
  headerApiKey: string | null
): string {
  // Priority 1: Header API Key (for API calls / tests)
  if (headerApiKey) {
    if (!entry.personalWorkspaceDisabled && entry.personalApiKey === headerApiKey) {
      return headerApiKey;
    }
    const matchedOrg = entry.organizations.find((org) => org.apiKey === headerApiKey);
    if (matchedOrg) {
      return matchedOrg.apiKey;
    }
  }

  // Priority 2: Cookie workspace — resolve but don't return yet.
  // Priority 3 (org lock) can override this for non-Unify members.
  let resolvedKey =
    entry.personalWorkspaceDisabled && entry.organizations[0]
      ? entry.organizations[0].apiKey
      : entry.personalApiKey;
  if (workspaceId && workspaceId !== 'personal') {
    const org = entry.organizations.find((o) => o.id.toString() === workspaceId);
    if (org) {
      resolvedKey = org.apiKey;
    }
  }

  // Priority 3: Non-Unify org members are always locked to their first org,
  // regardless of cookie value. This mirrors getCurrentUser() where the lock
  // runs unconditionally after Priority 2, overriding any earlier resolution.
  const lockedKey = applyOrgLock(email, entry, headerApiKey);
  if (lockedKey) return lockedKey;

  return resolvedKey;
}

/**
 * Non-Unify org members are locked to their first org's workspace.
 * Returns the forced org apiKey, or null if no lock applies.
 */
function applyOrgLock(
  email: string,
  entry: CachedUserKeys,
  headerApiKey: string | null
): string | null {
  if (headerApiKey) return null;
  const isUnifyMember = isUnifyStaffMember(email, entry.organizations);
  if (!isUnifyMember && entry.organizations.length > 0) {
    return entry.organizations[0].apiKey;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function evictStaleEntries(): void {
  const now = Date.now();
  cache.forEach((value, key) => {
    if (now - value.fetchedAt > CACHE_TTL_MS) {
      cache.delete(key);
    }
  });
}
