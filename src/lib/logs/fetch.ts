import type { LogFieldsResponseProps } from '@/types/interfaces/logs';
import { countFromLogsResponse, orchestraLogsToGridRows } from './grouping';
import type { LogGridRow, LogQueryResult, LogQuerySpec } from './types';

function stripPrivateFields(entries: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (!key.startsWith('_')) out[key] = value;
  }
  return out;
}

export function publicFieldsFromResponse(data: unknown): LogFieldsResponseProps {
  if (!data || typeof data !== 'object') return {};
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).filter(
      ([key]) => key !== '__contextNotFound' && !key.startsWith('_')
    )
  ) as LogFieldsResponseProps;
}

/** Fetch field schema for a context via Console proxy. */
export async function fetchLogFields(
  projectName: string,
  context: string,
  signal?: AbortSignal
): Promise<LogFieldsResponseProps> {
  const params = new URLSearchParams({ projectName, context });
  // Bust any intermediary HTTP cache after schema mutations (derived columns).
  params.set('_ts', String(Date.now()));
  const res = await fetch(`/api/logs/fields?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });
  if (!res.ok) return {};
  return publicFieldsFromResponse(await res.json());
}

/** Fetch a page of logs for a LogQuerySpec via Console proxy. */
export async function fetchLogs(
  spec: LogQuerySpec,
  signal?: AbortSignal
): Promise<{ rows: LogGridRow[]; count: number }> {
  const grouped = !!spec.groupBy?.length;
  const params = new URLSearchParams({
    projectName: spec.projectName,
    context: spec.context,
  });
  if (spec.filterExpr) params.set('filterExpr', spec.filterExpr);
  if (spec.sorting) params.set('sorting', spec.sorting);
  if (spec.columnContext) params.set('columnContext', spec.columnContext);

  if (grouped) {
    for (const g of spec.groupBy!) params.append('groupBy', g);
    params.set('groupLimit', String(spec.limit));
    params.set('groupOffset', String(spec.offset));
    params.set('groupDepth', '0');
  } else {
    params.set('limit', String(spec.limit));
    params.set('offset', String(spec.offset));
  }

  const res = await fetch(`/api/logs?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to load logs (${res.status})`);
  }
  const data = await res.json();
  const rawLogs = data.logs ?? [];

  if (grouped || (rawLogs && !Array.isArray(rawLogs))) {
    return {
      rows: orchestraLogsToGridRows(rawLogs),
      count: countFromLogsResponse(data),
    };
  }

  const rows: LogGridRow[] = (Array.isArray(rawLogs) ? rawLogs : []).map(
    (log: { id?: number; entries?: Record<string, unknown> }) => ({
      logId: log.id ?? 0,
      entries: stripPrivateFields(log.entries ?? {}),
      raw: log as unknown as LogGridRow['raw'],
    })
  );
  return { rows, count: data.count ?? rows.length };
}

/** Fields + first page in parallel. */
export async function fetchLogsWithFields(
  spec: LogQuerySpec,
  signal?: AbortSignal
): Promise<LogQueryResult> {
  const [fields, page] = await Promise.all([
    fetchLogFields(spec.projectName, spec.context, signal),
    fetchLogs(spec, signal),
  ]);
  return { fields, rows: page.rows, count: page.count };
}

/**
 * Create a derived column via Console proxy (same Orchestra endpoint as Interfaces).
 * Client-side; uses session cookie auth through `/api/logs/derived`.
 */
export async function createDerivedColumn(args: {
  projectName: string;
  context: string;
  key: string;
  equation: string;
  /**
   * Table alias used inside `{alias:col}` equations and referencedLogs keys.
   * Must be lowercase so camelToSnakeObject on the Console→Orchestra boundary
   * does not rewrite it (e.g. `People` → `_people`).
   */
  tableName?: string;
}): Promise<{ ok: boolean; detail?: string }> {
  // Lowercase alias: PascalCase keys are mangled by camelToSnake (`People` → `_people`).
  const tableName = (args.tableName ?? 't').toLowerCase();
  const res = await fetch('/api/logs/derived', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName: args.projectName,
      context: args.context,
      key: args.key,
      equation: args.equation,
      derived: true,
      referencedLogs: {
        [tableName]: {
          projectName: args.projectName,
          context: args.context,
          filterExpr: '',
        },
      },
    }),
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const detail =
      body && typeof body === 'object' && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : undefined;
    console.error('Failed to create derived column', detail ?? res.status);
    return { ok: false, detail };
  }
  const body: unknown = await res.json().catch(() => null);
  const info =
    body && typeof body === 'object' && 'info' in body
      ? String((body as { info: unknown }).info)
      : '';
  if (info && /fail|error/i.test(info)) {
    console.error('Derived column create reported failure', info);
    return { ok: false, detail: info };
  }
  return { ok: true };
}

/**
 * Update an existing derived column equation via Console `/api/logs/derived` PUT.
 */
export async function updateDerivedColumn(args: {
  projectName: string;
  context: string;
  key: string;
  equation: string;
  tableName?: string;
}): Promise<{ ok: boolean; detail?: string }> {
  const tableName = (args.tableName ?? 't').toLowerCase();
  const res = await fetch('/api/logs/derived', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName: args.projectName,
      context: args.context,
      key: args.key,
      equation: args.equation,
      targetDerivedLogs: {
        [tableName]: {
          projectName: args.projectName,
          context: args.context,
          filterExpr: '',
        },
      },
    }),
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const detail =
      body && typeof body === 'object' && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : undefined;
    console.error('Failed to update derived column', detail ?? res.status);
    return { ok: false, detail };
  }
  const body: unknown = await res.json().catch(() => null);
  const info =
    body && typeof body === 'object' && 'info' in body
      ? String((body as { info: unknown }).info)
      : '';
  if (info && /fail|error/i.test(info)) {
    console.error('Derived column update reported failure', info);
    return { ok: false, detail: info };
  }
  return { ok: true };
}
