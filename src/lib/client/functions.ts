/**
 * Client-side paginated fetchers for the Functions tab.
 *
 * Uses `/api/logs/federated`, which reads every in-scope context (personal
 * and team roots × Compositional/Primitives) in one round trip and returns a
 * single name-ordered window with an exact total — one cursor, no client-side
 * cross-context merge.
 */

import type { Assistant } from '@/types/assistants/assistant';
import type { FunctionRow } from '@/types/assistants/brain';
import { buildSearchFilterExpr } from '@/lib/client/brain';
import { rootContext, rootKey, type ContextRoot } from '@/lib/assistants/scope';
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
];

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

export function buildFunctionSearchFilterExpr(query: string): string {
  return buildSearchFilterExpr(query, FUNCTION_SEARCH_FIELDS);
}

export interface FunctionsFederatedPage {
  rows: FunctionRow[];
  count: number;
  hasMore: boolean;
}

/**
 * Fetch one globally name-ordered page of the functions catalog across every
 * requested root × sub-context, with an exact merged total.
 */
export async function listFunctionsFederatedPage(args: {
  assistant: Assistant;
  kind: FunctionKindFilter;
  roots: readonly ContextRoot[];
  limit?: number;
  offset?: number;
  filter?: string;
}): Promise<FunctionsFederatedPage> {
  const limit = args.limit ?? FUNCTIONS_PAGE_SIZE;
  const offset = args.offset ?? 0;
  const subContexts = functionSubContextsForKind(args.kind);

  const contexts = args.roots.flatMap((root) =>
    subContexts.map((subContext) => ({
      context: functionContextPath(args.assistant, subContext, root),
      source: `${rootKey(root)}:${subContext}`,
      fromFields: FUNCTION_PUBLIC_FIELDS,
    }))
  );

  const response = await fetch('/api/logs/federated', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName: 'Assistants',
      contexts,
      filter: args.filter,
      sorting: [{ field: 'name', direction: 'ascending' }],
      offset,
      limit,
    }),
    cache: 'no-store',
  });
  if (!response.ok) {
    return { rows: [], count: 0, hasMore: false };
  }

  const data = (await response.json()) as {
    logs?: Array<{ entries?: Record<string, unknown> }>;
    count?: number;
  };
  const logs = data?.logs ?? [];
  const rows = logs.map((log) => {
    const entries = { ...(log.entries ?? {}) };
    const source = String(entries._federatedSource ?? '');
    const subContext = source.includes(':') ? source.slice(source.indexOf(':') + 1) : source;
    delete entries._federatedSource;
    delete entries._federatedContext;
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      _table: subContext,
      ...entries,
    };
  }) as unknown as FunctionRow[];
  const count = typeof data?.count === 'number' ? data.count : rows.length;
  return { rows, count, hasMore: offset + rows.length < count };
}
