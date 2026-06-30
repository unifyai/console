/**
 * In-memory cache for assistant tab data. Survives tab switches and component
 * remounts within a browser session; cleared only on manual refresh (via
 * invalidate*) or a full page reload.
 */

interface CacheEntry<T> {
  data: T;
  loadedAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function readTabDataCache<T>(key: string): T | null {
  const entry = store.get(key);
  return entry ? (entry.data as T) : null;
}

export function writeTabDataCache<T>(key: string, data: T): void {
  store.set(key, { data, loadedAt: Date.now() });
}

export function hasTabDataCache(key: string): boolean {
  return store.has(key);
}

export function invalidateTabDataCache(key: string): void {
  store.delete(key);
}

export function invalidateTabDataCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Cache key segment for a brain read scope (personal vs team root). */
export function brainRootCacheKey(root: { kind: string; teamId?: string | number } | null): string {
  if (!root || root.kind === 'personal') return 'personal';
  return `team:${root.teamId ?? 'unknown'}`;
}

export function assistantTabCachePrefix(ownerId: string, assistantId: string): string {
  return `${ownerId}:${assistantId}:`;
}
