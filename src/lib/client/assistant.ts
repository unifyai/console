/**
 * Client-side API functions for assistant endpoints.
 *
 * These call the Next.js API routes directly via fetch(), which:
 *   - Authenticate via the session cookie (no API key in the browser)
 *   - Run in parallel (unlike server actions, which serialize on the client)
 *   - Proxy to Orchestra server-side using getApiKeyFromRequest()
 *
 * Usage: import from hooks or client components. Do NOT use in server
 * components or server actions — those should use the Orchestra client
 * or server-side libs directly.
 */

import { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import {
  canonicalizeAssistantList,
  type CoordinatorWorkspaceScope,
  resolveCanonicalWorkspaceCoordinator,
} from '@/lib/assistants/coordinatorIdentity';
import {
  clearMediaSignedUrlInFlight,
  getEarliestSignedUrlExpiryMs,
  getMediaSignedUrlInFlight,
  MEDIA_SIGNED_URL_EXPIRY_BUFFER_MS,
  normalizeMediaPathKey,
  readCachedMediaSignedUrls,
  seedMediaSignedUrls,
  setMediaSignedUrlInFlight,
} from './mediaSignedUrlCache';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

export async function fetchAssistants(
  workspace: CoordinatorWorkspaceScope,
  options: { currentUserId?: string | null } = {}
): Promise<Assistant[] | ResponseProps> {
  const isOrgContext = workspace.type === 'organization';
  const buildParams = (listAllOrg: boolean): URLSearchParams => {
    const params = new URLSearchParams();
    if (listAllOrg) params.set('list_all_org', 'true');
    return params;
  };

  try {
    let params = buildParams(isOrgContext);
    let res = await fetch(`/api/assistant?${params.toString()}`);

    // Org members without assistant:read cannot list every org assistant.
    // Fall back to the user-scoped org list.
    if (res.status === 403 && isOrgContext) {
      params = buildParams(false);
      res = await fetch(`/api/assistant?${params.toString()}`);
    }

    const data = await res.json();

    if (!res.ok) {
      return {
        detail: data?.detail || `Failed to list assistants: ${res.statusText}`,
        status: res.status,
      } as ResponseProps;
    }
    if (!Array.isArray(data)) {
      return data;
    }

    return canonicalizeAssistantList(data, {
      currentUserId: options.currentUserId ?? null,
      pinCanonicalCoordinatorFirst: isOrgContext,
      workspace,
    });
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Failed to fetch assistants' };
  }
}

export async function fetchAssistantStatus(assistantId: string): Promise<AssistantStatus | null> {
  try {
    const res = await fetch(`/api/assistant/${assistantId}/status`);
    if (!res.ok) return null;
    const data = await res.json();
    return data && 'running' in data ? (data as AssistantStatus) : null;
  } catch {
    return null;
  }
}

/**
 * Batch-fetches signed photo URLs for preset assistants.
 * Returns a map of "FirstName_Surname" → signed URL.
 */
export async function fetchPresetPhotoUrls(
  presets: { firstName: string; surname: string }[]
): Promise<Record<string, string>> {
  if (presets.length === 0) return {};
  try {
    const res = await fetch('/api/assistant/preset/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presets }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.urls ?? {};
  } catch {
    return {};
  }
}

/**
 * Batch-fetches signed URLs for arbitrary GCS media paths (photos/videos).
 * Accepts GCS URLs (gs://…) or raw object paths.
 * Returns a map of original path → signed URL.
 */
export async function fetchMediaSignedUrls(
  paths: string[],
  options?: {
    onDiagnostic?: (diagnostic: {
      pathCount: number;
      ok: boolean;
      status: number | null;
      returnedUrlCount: number;
      durationMs: number;
      cacheHitCount: number;
      fetchedCount: number;
      error?: string;
    }) => void;
  }
): Promise<Record<string, string>> {
  const uniquePaths = Array.from(
    new Set(
      paths.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
    )
  );
  if (uniquePaths.length === 0) return {};

  const startedAt = Date.now();
  const resolvedUrls = readCachedMediaSignedUrls(uniquePaths);
  const cacheHitCount = Object.keys(resolvedUrls).length;

  const unresolvedByKey = new Map<string, string[]>();
  uniquePaths.forEach((path) => {
    if (resolvedUrls[path]) return;
    const normalizedKey = normalizeMediaPathKey(path);
    if (!normalizedKey) return;
    const aliases = unresolvedByKey.get(normalizedKey);
    if (aliases) aliases.push(path);
    else unresolvedByKey.set(normalizedKey, [path]);
  });

  const networkRequestPaths: string[] = [];
  const keyByNetworkPath = new Map<string, string>();
  const deferredByKey = new Map<string, Deferred<string | null>>();
  const inFlightWaiters: Promise<void>[] = [];

  unresolvedByKey.forEach((aliases, normalizedKey) => {
    const existingInFlight = getMediaSignedUrlInFlight(normalizedKey);
    if (existingInFlight) {
      inFlightWaiters.push(
        existingInFlight.then((signedUrl) => {
          if (!signedUrl) return;
          aliases.forEach((path) => {
            resolvedUrls[path] = signedUrl;
          });
        })
      );
      return;
    }

    const deferred = createDeferred<string | null>();
    deferredByKey.set(normalizedKey, deferred);
    setMediaSignedUrlInFlight(normalizedKey, deferred.promise);

    const networkPath = aliases[0];
    networkRequestPaths.push(networkPath);
    keyByNetworkPath.set(networkPath, normalizedKey);
  });

  let status: number | null = null;
  let fetchedCount = 0;
  let errorMessage: string | undefined;
  let ok = true;

  try {
    if (networkRequestPaths.length > 0) {
      const res = await fetch('/api/assistant/media/batch-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: networkRequestPaths }),
      });
      status = res.status;

      if (!res.ok) {
        ok = false;
        errorMessage = 'non_ok_response';
      } else {
        const data = await res.json();
        const fetchedUrls = (data.urls ?? {}) as Record<string, string>;
        seedMediaSignedUrls(fetchedUrls);

        networkRequestPaths.forEach((networkPath) => {
          const normalizedKey = keyByNetworkPath.get(networkPath);
          if (!normalizedKey) return;

          const resolvedSignedUrl = fetchedUrls[networkPath] ?? null;
          const aliases = unresolvedByKey.get(normalizedKey) ?? [];
          const deferred = deferredByKey.get(normalizedKey);

          if (resolvedSignedUrl) {
            fetchedCount += 1;
            aliases.forEach((path) => {
              resolvedUrls[path] = resolvedSignedUrl;
            });
          }

          deferred?.resolve(resolvedSignedUrl);
          clearMediaSignedUrlInFlight(normalizedKey);
        });
      }
    }

    if (!ok) {
      deferredByKey.forEach((deferred, normalizedKey) => {
        deferred.resolve(null);
        clearMediaSignedUrlInFlight(normalizedKey);
      });
    }

    await Promise.all(inFlightWaiters);

    options?.onDiagnostic?.({
      pathCount: paths.length,
      ok,
      status,
      returnedUrlCount: Object.keys(resolvedUrls).length,
      durationMs: Date.now() - startedAt,
      cacheHitCount,
      fetchedCount,
      ...(errorMessage ? { error: errorMessage } : {}),
    });

    return resolvedUrls;
  } catch (error) {
    deferredByKey.forEach((deferred, normalizedKey) => {
      deferred.resolve(null);
      clearMediaSignedUrlInFlight(normalizedKey);
    });

    await Promise.all(inFlightWaiters);

    options?.onDiagnostic?.({
      pathCount: paths.length,
      ok: false,
      status,
      returnedUrlCount: Object.keys(resolvedUrls).length,
      durationMs: Date.now() - startedAt,
      cacheHitCount,
      fetchedCount,
      error: error instanceof Error ? error.message : 'unknown_error',
    });

    return resolvedUrls;
  }
}

export {
  getEarliestSignedUrlExpiryMs,
  MEDIA_SIGNED_URL_EXPIRY_BUFFER_MS,
  resolveCanonicalWorkspaceCoordinator,
  readCachedMediaSignedUrls,
  seedMediaSignedUrls,
};
