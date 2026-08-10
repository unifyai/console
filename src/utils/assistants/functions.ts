/**
 * View-model mapping for the Brain → Functions view.
 *
 * Field inventory is the `Function` pydantic model in the unity repo
 * (`function_manager/types/function.py`). The `/api/logs` route runs the body
 * through `createOrchestraClient`, which deep-converts snake→camel, so `entries`
 * reach this mapper in camelCase. `readField(snake, camel)` resolves the camel
 * key at runtime and keeps the snake key as a harmless fallback.
 */

import type { FunctionRow, StaleReason } from '@/types/assistants/brain';
import { mapStaleReasons } from '@/utils/assistants/staleReasons';

export interface FunctionEntry {
  functionId: number | null;
  name: string;
  language: string;
  argspec: string;
  docstring: string;
  implementation: string | null;
  dependsOn: string[];
  guidanceIds: number[];
  staleReasons: StaleReason[];
  precondition: Record<string, unknown> | null;
  isPrimitive: boolean;
  verify: boolean;
}

export type FunctionKindFilter = 'All' | 'Learned' | 'Primitives';

function readField(row: Record<string, unknown>, snake: string, camel: string): unknown {
  const snakeValue = row[snake];
  if (snakeValue !== undefined && snakeValue !== null) return snakeValue;
  return row[camel];
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter((item) => item.length > 0);
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'number' ? item : Number(item)))
    .filter((item) => Number.isFinite(item));
}

export function mapFunctionRow(row: FunctionRow): FunctionEntry {
  const raw = row as Record<string, unknown>;
  const table = asString(raw._table);
  const isPrimitiveField = readField(raw, 'is_primitive', 'isPrimitive');
  const implementation = readField(raw, 'implementation', 'implementation');
  const functionIdRaw = readField(raw, 'function_id', 'functionId');
  const functionId =
    typeof functionIdRaw === 'number'
      ? functionIdRaw
      : Number.isFinite(Number(functionIdRaw))
        ? Number(functionIdRaw)
        : null;

  return {
    functionId,
    name: asString(readField(raw, 'name', 'name')),
    language: asString(readField(raw, 'language', 'language')) || 'python',
    argspec: asString(readField(raw, 'argspec', 'argspec')),
    docstring: asString(readField(raw, 'docstring', 'docstring')),
    implementation: implementation === undefined ? null : (implementation as string | null),
    dependsOn: asStringArray(readField(raw, 'depends_on', 'dependsOn')),
    guidanceIds: asNumberArray(readField(raw, 'guidance_ids', 'guidanceIds')),
    staleReasons: mapStaleReasons(readField(raw, 'stale_reasons', 'staleReasons')),
    precondition:
      (readField(raw, 'precondition', 'precondition') as Record<string, unknown>) ?? null,
    isPrimitive: typeof isPrimitiveField === 'boolean' ? isPrimitiveField : table === 'Primitives',
    verify: readField(raw, 'verify', 'verify') !== false,
  };
}

/** The function's bare (unqualified) name — last dotted segment. */
export function bareFunctionName(fn: FunctionEntry): string {
  return fn.name.includes('.') ? (fn.name.split('.').pop() ?? fn.name) : fn.name;
}

/**
 * Short, signature-style summary for a function card.
 *
 * `argspec` may already begin with the function name (e.g.
 * `update(task_id: int, ...)`) or be a bare parameter list (e.g.
 * `(self, task_id: int)`). Only prepend the name in the latter case — prefixing
 * an already-named argspec is what produced the `updateupdate(...)` duplication.
 */
export function shortSignature(fn: FunctionEntry): string {
  const args = fn.argspec.replace(/^\(self,\s*/, '(').replace(/^\(self\)/, '()');
  return args.trimStart().startsWith('(') ? `${bareFunctionName(fn)}${args}` : args;
}

export function filterFunctions(
  functions: FunctionEntry[],
  query: string,
  kind: FunctionKindFilter
): FunctionEntry[] {
  const q = query.trim().toLowerCase();
  return functions.filter((fn) => {
    if (!fn.name.trim()) return false;
    if (kind === 'Learned' && fn.isPrimitive) return false;
    if (kind === 'Primitives' && !fn.isPrimitive) return false;
    if (!q) return true;
    return (fn.name + ' ' + fn.docstring).toLowerCase().includes(q);
  });
}

function functionEntryKey(fn: FunctionEntry, table?: string): string {
  return `${table ?? 'unknown'}:${fn.functionId ?? fn.name}`;
}

/** Maps log rows to view-model functions, dropping blank names and duplicate keys. */
export function normalizeFunctionEntries(rows: FunctionRow[]): FunctionEntry[] {
  const seen = new Set<string>();
  const functions: FunctionEntry[] = [];

  for (const row of rows) {
    const fn = mapFunctionRow(row);
    if (!fn.name.trim()) continue;
    const table = asString((row as Record<string, unknown>)._table);
    const key = functionEntryKey(fn, table);
    if (seen.has(key)) continue;
    seen.add(key);
    functions.push(fn);
  }

  return functions;
}
