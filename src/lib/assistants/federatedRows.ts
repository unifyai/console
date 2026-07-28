import { rootContext, rootKey, type ContextRoot } from '@/lib/assistants/scope';

/** One federated read of `{root}/{table}` across every scoped root, tagging
 *  each row with the root it came from.
 *
 *  Exchange and contact ids are root-local, so callers that join across roots
 *  must key on `rootKey` alongside the id. */
export async function fetchRowsAcrossRoots<T>(args: {
  scopedRoots: readonly ContextRoot[];
  ownerId: string;
  assistantId: string;
  table: string;
  limit: number;
  sortField?: string;
}): Promise<Array<T & { rootKey: string }>> {
  try {
    const res = await fetch('/api/logs/federated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: 'Assistants',
        contexts: args.scopedRoots.map((root) => ({
          context: rootContext(root, args.ownerId, args.assistantId, args.table),
          source: rootKey(root),
        })),
        sorting: args.sortField ? [{ field: args.sortField, direction: 'descending' }] : [],
        limit: args.limit,
      }),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.logs ?? []).map((log: { entries?: Record<string, unknown> }) => {
      const entries = { ...(log.entries ?? {}) };
      const source = String(entries._federatedSource ?? 'personal');
      delete entries._federatedSource;
      delete entries._federatedContext;
      return { ...entries, rootKey: source } as T & { rootKey: string };
    });
  } catch {
    return [];
  }
}
