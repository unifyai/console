/**
 * Client-side paginated fetchers for the Functions tab.
 *
 * Uses `/api/logs` with a public-field whitelist (no embedding payloads) and
 * `/api/logs/count` for stable totals per Compositional / Primitives context.
 */

import type { Assistant } from '@/types/assistants/assistant';
import type { FunctionRow } from '@/types/assistants/brain';
import { buildSearchFilterExpr } from '@/lib/client/brain';
import { rootContext, type ContextRoot } from '@/lib/assistants/scope';
import type { FunctionKindFilter } from '@/utils/assistants/functions';

export const FUNCTIONS_PAGE_SIZE = 50;

export const FUNCTION_PUBLIC_FIELDS = [
  'function_id',
  'name',
  'language',
  'argspec',
  'docstring',
  'implementation',
  'depends_on',
  'guidance_ids',
  'precondition',
  'is_primitive',
  'verify',
].join('&');

const FUNCTION_COUNT_KEY = JSON.stringify(['name']);

const FUNCTION_SEARCH_FIELDS = ['name', 'docstring'];

export function functionSubContextsForKind(kind: FunctionKindFilter): string[] {
  switch (kind) {
    case 'Learned':
      return ['Compositional'];
    case 'Primitives':
      return ['Primitives'];
    default:
      return ['Compositional', 'Primitives'];
  }
}

function functionContextPath(
  assistant: Assistant,
  subContext: string,
  root: ContextRoot = { kind: 'personal' }
): string {
  return rootContext(root, assistant.userId, String(assistant.agentId), `Functions/${subContext}`);
}

function parseFunctionLogs(
  data: unknown,
  subContext: string
): { rows: FunctionRow[]; count: number } {
  const payload = data as { logs?: Array<{ entries?: Record<string, unknown> }>; count?: number };
  const logs = payload?.logs ?? [];
  const rows = logs.map((log) => ({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _table: subContext,
    ...(log.entries ?? {}),
  })) as unknown as FunctionRow[];
  const count = typeof payload?.count === 'number' ? payload.count : rows.length;
  return { rows, count };
}

function extractMetricCount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!value || typeof value !== 'object') return null;
  for (const nested of Object.values(value as Record<string, unknown>)) {
    const found = extractMetricCount(nested);
    if (found !== null) return found;
  }
  return null;
}

export function buildFunctionSearchFilterExpr(query: string): string {
  return buildSearchFilterExpr(query, FUNCTION_SEARCH_FIELDS);
}

export async function listFunctionsPage(args: {
  assistant: Assistant;
  subContext: string;
  limit?: number;
  offset?: number;
  filterExpr?: string;
  root?: ContextRoot;
}): Promise<{ rows: FunctionRow[]; count: number; hasMore: boolean }> {
  const limit = args.limit ?? FUNCTIONS_PAGE_SIZE;
  const offset = args.offset ?? 0;
  const params = new URLSearchParams({
    projectName: 'Assistants',
    context: functionContextPath(args.assistant, args.subContext, args.root),
    limit: String(limit),
    offset: String(offset),
    fromFields: FUNCTION_PUBLIC_FIELDS,
    sorting: JSON.stringify({ name: 'ascending' }),
  });
  if (args.filterExpr) params.set('filterExpr', args.filterExpr);

  const response = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) {
    return { rows: [], count: 0, hasMore: false };
  }
  const data = await response.json();
  const parsed = parseFunctionLogs(data, args.subContext);
  return {
    ...parsed,
    // Match Integrations: a full page implies more rows may exist. Do not rely
    // on inline `count` alone — with fromFields Orchestra can return a page-sized
    // count even when the metric total is higher.
    hasMore: parsed.rows.length >= limit,
  };
}

export async function getFunctionsSubContextCount(args: {
  assistant: Assistant;
  subContext: string;
  filterExpr?: string;
  root?: ContextRoot;
}): Promise<number | null> {
  const params = new URLSearchParams({
    projectName: 'Assistants',
    context: functionContextPath(args.assistant, args.subContext, args.root),
    key: FUNCTION_COUNT_KEY,
  });
  if (args.filterExpr) params.set('filterExpr', args.filterExpr);

  const response = await fetch(`/api/logs/count?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  return extractMetricCount(parsed);
}

export async function resolveFunctionsCatalogTotal(args: {
  assistant: Assistant;
  kind: FunctionKindFilter;
  filterExpr?: string;
  root?: ContextRoot;
}): Promise<number> {
  const subContexts = functionSubContextsForKind(args.kind);
  if (args.filterExpr) {
    const pages = await Promise.all(
      subContexts.map((subContext) =>
        listFunctionsPage({
          assistant: args.assistant,
          subContext,
          limit: 1,
          offset: 0,
          filterExpr: args.filterExpr,
          root: args.root,
        })
      )
    );
    return pages.reduce((sum, page) => sum + page.count, 0);
  }

  const counts = await Promise.all(
    subContexts.map((subContext) =>
      getFunctionsSubContextCount({
        assistant: args.assistant,
        subContext,
        root: args.root,
      }).catch(() => null)
    )
  );
  const resolved = counts.reduce<number>((sum, count) => sum + (count ?? 0), 0);
  if (resolved > 0) return resolved;

  const pages = await Promise.all(
    subContexts.map((subContext) =>
      listFunctionsPage({
        assistant: args.assistant,
        subContext,
        limit: FUNCTIONS_PAGE_SIZE,
        offset: 0,
        root: args.root,
      })
    )
  );
  return pages.reduce((sum, page) => sum + page.count, 0);
}
