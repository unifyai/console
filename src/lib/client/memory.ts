/**
 * Client-side API functions for the Memory tab.
 *
 * Fetches Contacts, Transcripts, Knowledge, and Tasks from /api/logs
 * using session cookie auth. These are GET-only functions meant to be
 * called from client components (bypasses server action serialization
 * queue for parallelism, same pattern as useContactIdPrefetch).
 */

import type {
  MemoryContext,
  MemoryContextData,
  MemoryRow,
  KnowledgeRow,
  FunctionRow,
} from '@/types/assistants/memory';
import { camelToSnake } from '@/utils/casing';

const PAGE_SIZE = 50;

function parseLogsResponse<T extends MemoryRow>(data: any): MemoryContextData<T> {
  const logs: any[] = data?.logs ?? [];
  const count: number = data?.count ?? logs.length;

  const fields = new Set<string>();
  const rows = logs.map((log: any) => {
    const entries = log.entries ?? {};
    Object.keys(entries).forEach((k) => fields.add(k));
    return entries as T;
  });

  return { rows, count, fields: Array.from(fields) };
}

/**
 * Build an Orchestra-compatible sorting JSON string from a camelCase
 * field name and direction. Orchestra expects snake_case field names.
 */
export function buildSortingParam(field: string, direction: 'asc' | 'desc'): string {
  const snakeField = camelToSnake(field);
  return JSON.stringify({ [snakeField]: direction === 'asc' ? 'ascending' : 'descending' });
}

export async function fetchMemoryContext<T extends MemoryRow = MemoryRow>(
  ownerId: string,
  assistantId: string,
  context: MemoryContext | string,
  options?: {
    limit?: number;
    offset?: number;
    filterExpr?: string;
    sorting?: string;
  }
): Promise<MemoryContextData<T>> {
  const empty: MemoryContextData<T> = { rows: [], count: 0, fields: [] };

  try {
    const params = new URLSearchParams({
      projectName: 'Assistants',
      context: `${ownerId}/${assistantId}/${context}`,
      limit: String(options?.limit ?? PAGE_SIZE),
    });

    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.filterExpr) params.set('filterExpr', options.filterExpr);
    if (options?.sorting) params.set('sorting', options.sorting);

    const res = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });

    if (!res.ok) return empty;

    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) return empty;

    const data = await res.json();
    return parseLogsResponse<T>(data);
  } catch {
    return empty;
  }
}

/**
 * Generic fetcher for contexts that use sub-contexts (e.g. Knowledge/Products,
 * Functions/Compositional). Discovers sub-contexts via the contexts API and
 * merges rows from all tables, tagging each row with a `_table` field.
 */
async function fetchSubContextTables<T extends MemoryRow>(
  ownerId: string,
  assistantId: string,
  parentContext: string
): Promise<MemoryContextData<T>> {
  const empty: MemoryContextData<T> = { rows: [], count: 0, fields: [] };

  try {
    const prefix = `${ownerId}/${assistantId}/${parentContext}`;
    const ctxRes = await fetch(`/api/context/Assistants`, { cache: 'no-store' });

    if (!ctxRes.ok) return empty;

    const allContexts: string[] = await ctxRes.json();
    if (!Array.isArray(allContexts)) return empty;

    const subContexts = allContexts.filter((c) => c.startsWith(prefix + '/') && c !== prefix);

    if (subContexts.length === 0) return empty;

    const results = await Promise.all(
      subContexts.map(async (fullCtx) => {
        const tableName = fullCtx.slice(prefix.length + 1);
        const params = new URLSearchParams({
          projectName: 'Assistants',
          context: fullCtx,
          limit: String(PAGE_SIZE),
        });

        const res = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return null;

        const data = await res.json();
        const parsed = parseLogsResponse<T>(data);
        return {
          ...parsed,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          rows: parsed.rows.map((row) => ({ _table: tableName, ...row }) as T),
        };
      })
    );

    const allRows: T[] = [];
    const allFields = new Set<string>();
    allFields.add('_table');
    let totalCount = 0;

    for (const result of results) {
      if (!result) continue;
      allRows.push(...result.rows);
      totalCount += result.count;
      result.fields.forEach((f) => allFields.add(f));
    }

    return { rows: allRows, count: totalCount, fields: Array.from(allFields) };
  } catch {
    return empty;
  }
}

export function fetchKnowledgeTables(
  ownerId: string,
  assistantId: string
): Promise<MemoryContextData<KnowledgeRow>> {
  return fetchSubContextTables<KnowledgeRow>(ownerId, assistantId, 'Knowledge');
}

export function fetchFunctionsTables(
  ownerId: string,
  assistantId: string
): Promise<MemoryContextData<FunctionRow>> {
  return fetchSubContextTables<FunctionRow>(ownerId, assistantId, 'Functions');
}
