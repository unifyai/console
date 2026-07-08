/**
 * Client-side API functions for the Brain tab.
 *
 * Fetches Contacts, Transcripts, Knowledge, and Tasks from /api/logs
 * using session cookie auth. These are GET-only functions meant to be
 * called from client components (bypasses server action serialization
 * queue for parallelism, same pattern as useContactIdPrefetch).
 */

import type {
  BrainContext,
  BrainContextData,
  BrainRow,
  KnowledgeRow,
  FunctionRow,
} from '@/types/assistants/brain';
import type { Assistant } from '@/types/assistants/assistant';
import { camelToSnake, snakeToCamel } from '@/utils/casing';
import { mergeRootRows } from '@/lib/client/read_across_roots';
import { rootContext, roots, type ContextRoot } from '@/lib/assistants/scope';
import { transcriptMergeDedupeKey } from '@/lib/assistants/transcriptDedupe';

const PAGE_SIZE = 50;

function parseLogsResponse<T extends BrainRow>(data: any): BrainContextData<T> {
  const logs: any[] = data?.logs ?? [];
  const count: number = data?.count ?? logs.length;

  const fields = new Set<string>();
  const rows = logs.map((log: any) => {
    const entries = log.entries ?? {};
    Object.keys(entries).forEach((k) => fields.add(k));
    const ts = typeof log.ts === 'string' ? log.ts : null;
    return { ...entries, ...(ts ? { ts } : {}) } as T;
  });

  return { rows, count, fields: Array.from(fields) };
}

function parseSortingParam(
  sorting?: string
): { field: string; direction: 'ascending' | 'descending' } | null {
  if (!sorting) return null;
  try {
    const parsed = JSON.parse(sorting) as Record<string, 'ascending' | 'descending'>;
    const [entry] = Object.entries(parsed);
    if (!entry) return null;
    const [field, direction] = entry;
    return { field: snakeToCamel(field), direction };
  } catch {
    return null;
  }
}

function sortValueForField(row: BrainRow, field: string): string | number | Date | null {
  const value = (row as Record<string, unknown>)[field];
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (value instanceof Date) return value;
  return null;
}

/**
 * Build an Orchestra-compatible sorting JSON string from a camelCase
 * field name and direction. Orchestra expects snake_case field names.
 */
export function buildSortingParam(field: string, direction: 'asc' | 'desc'): string {
  const snakeField = camelToSnake(field);
  return JSON.stringify({ [snakeField]: direction === 'asc' ? 'ascending' : 'descending' });
}

/**
 * Build an Orchestra filter expression for a text search across all known
 * fields. Uses `"value" in str(field)` per field joined with `or`,
 * matching the Interfaces common filter pattern.
 */
export function buildSearchFilterExpr(query: string, fields: string[]): string {
  const escaped = query.replace(/"/g, '\\"');
  const value = `"${escaped}"`;
  if (fields.length === 0) return `${value} in str(entries)`;
  const snakeFields = fields.filter((f) => !f.startsWith('_')).map(camelToSnake);
  return snakeFields.map((f) => `${value} in str(${f})`).join(' or ');
}

function readableRootsFor(
  assistant: Assistant,
  options?: {
    root?: ContextRoot | null;
    readAcrossRoots?: boolean;
  }
): readonly ContextRoot[] {
  if (options?.root !== undefined && options.root !== null) {
    return [options.root];
  }
  if (options?.readAcrossRoots === false) {
    return [{ kind: 'personal' }];
  }
  return roots(assistant);
}

export async function fetchBrainContext<T extends BrainRow = BrainRow>(
  assistant: Assistant,
  context: BrainContext | string,
  options?: {
    limit?: number;
    offset?: number;
    filterExpr?: string;
    sorting?: string;
    readAcrossRoots?: boolean;
    root?: ContextRoot | null;
  }
): Promise<BrainContextData<T>> {
  const empty: BrainContextData<T> = { rows: [], count: 0, fields: [] };

  try {
    const readableRoots = readableRootsFor(assistant, options);

    if (readableRoots.length === 1) {
      const [root] = readableRoots;
      const requestedLimit = options?.limit ?? PAGE_SIZE;
      const requestedOffset = options?.offset ?? 0;
      const params = new URLSearchParams({
        projectName: 'Assistants',
        context: rootContext(root, assistant.userId, assistant.agentId, context),
        limit: String(requestedLimit),
      });

      if (requestedOffset) params.set('offset', String(requestedOffset));
      if (options?.filterExpr) params.set('filterExpr', options.filterExpr);
      if (options?.sorting) params.set('sorting', options.sorting);

      const res = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });

      if (!res.ok) return empty;

      const contentType = res.headers.get('content-type');
      if (!contentType?.includes('application/json')) return empty;

      const data = await res.json();
      const parsed = parseLogsResponse<T>(data);
      const hasMore = requestedOffset + parsed.rows.length < parsed.count;
      return { ...parsed, hasMore };
    }

    const requestedLimit = options?.limit ?? PAGE_SIZE;
    const requestedOffset = options?.offset ?? 0;
    const rootLimit = requestedLimit + requestedOffset + 1;
    const rootResults = await Promise.all(
      readableRoots.map(async (root): Promise<BrainContextData<T>> => {
        const params = new URLSearchParams({
          projectName: 'Assistants',
          context: rootContext(root, assistant.userId, assistant.agentId, context),
          limit: String(rootLimit),
        });

        if (options?.filterExpr) params.set('filterExpr', options.filterExpr);
        if (options?.sorting) params.set('sorting', options.sorting);

        const res = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });

        if (!res.ok) return empty;

        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) return empty;

        const data = await res.json();
        return parseLogsResponse<T>(data);
      })
    );

    const fields = new Set<string>();
    const rows: T[] = [];
    let count = 0;
    for (const result of rootResults) {
      rows.push(...result.rows);
      count += result.count;
      result.fields.forEach((field) => fields.add(field));
    }
    const sorting = parseSortingParam(options?.sorting) ?? {
      field: 'timestamp',
      direction: 'descending' as const,
    };
    const mergedRows = mergeRootRows(rows, {
      limit: requestedLimit + 1,
      offset: requestedOffset,
      direction: sorting?.direction,
      sortValue: (row) => sortValueForField(row, sorting.field),
      dedupeKey:
        context === 'Transcripts'
          ? (row) => transcriptMergeDedupeKey(row as Record<string, unknown>)
          : undefined,
    });
    const hasMore = mergedRows.length > requestedLimit;
    const pageRows = mergedRows.slice(0, requestedLimit);
    const dedupedCount =
      requestedOffset + pageRows.length + (hasMore && context === 'Transcripts' ? 1 : 0);
    return {
      rows: pageRows,
      count: context === 'Transcripts' ? dedupedCount : count,
      fields: Array.from(fields),
      hasMore,
    };
  } catch {
    return empty;
  }
}

/**
 * Generic fetcher for contexts that use sub-contexts (e.g. Knowledge/Products,
 * Functions/Compositional). Discovers sub-contexts via the contexts API and
 * merges rows from all tables, tagging each row with a `_table` field.
 */
async function fetchSubContextTables<T extends BrainRow>(
  assistant: Assistant,
  parentContext: string,
  root?: ContextRoot | null
): Promise<BrainContextData<T>> {
  const empty: BrainContextData<T> = { rows: [], count: 0, fields: [] };

  try {
    const ctxRes = await fetch(`/api/context/Assistants`, { cache: 'no-store' });

    if (!ctxRes.ok) return empty;

    const raw: unknown = await ctxRes.json();

    // Orchestra returns contexts as { name, description }[] — extract names.
    let allContextNames: string[];
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object' && raw[0] !== null) {
      allContextNames = raw.map((c: any) => c.name as string).filter(Boolean);
    } else if (Array.isArray(raw)) {
      allContextNames = raw as string[];
    } else {
      return empty;
    }

    const readableRoots = readableRootsFor(assistant, { root });
    const prefixes = readableRoots.map((readRoot) =>
      rootContext(readRoot, assistant.userId, assistant.agentId, parentContext)
    );
    const subContexts = allContextNames.filter((contextName) =>
      prefixes.some((prefix) => contextName.startsWith(prefix + '/') && contextName !== prefix)
    );

    if (subContexts.length === 0) return empty;

    const results = await Promise.all(
      subContexts.map(async (fullCtx) => {
        const prefix = prefixes.find((candidate) => fullCtx.startsWith(candidate + '/'));
        if (!prefix) return null;
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

    for (const result of results) {
      if (!result) continue;
      allRows.push(...result.rows);
      result.fields.forEach((f) => allFields.add(f));
    }

    const dedupedRows: T[] = [];
    const seen = new Set<string>();
    for (const row of allRows) {
      const raw = row as Record<string, unknown>;
      const table = String(raw._table ?? '');
      const id = raw.functionId ?? raw.function_id ?? raw.name ?? '';
      const key = `${table}:${String(id)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedupedRows.push(row);
    }

    return { rows: dedupedRows, count: dedupedRows.length, fields: Array.from(allFields) };
  } catch {
    return empty;
  }
}

export function fetchKnowledgeTables(
  assistant: Assistant,
  root?: ContextRoot | null
): Promise<BrainContextData<KnowledgeRow>> {
  return fetchSubContextTables<KnowledgeRow>(assistant, 'Knowledge', root);
}

export function fetchFunctionsTables(
  assistant: Assistant,
  root?: ContextRoot | null
): Promise<BrainContextData<FunctionRow>> {
  return fetchSubContextTables<FunctionRow>(assistant, 'Functions', root);
}
