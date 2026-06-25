/**
 * View-model mapping for the Brain → Functions view.
 *
 * Field inventory is the `Function` pydantic model in the unity repo
 * (`function_manager/types/function.py`). The `/api/logs` route runs the body
 * through `createOrchestraClient`, which deep-converts snake→camel, so `entries`
 * reach this mapper in camelCase. `readField(snake, camel)` resolves the camel
 * key at runtime and keeps the snake key as a harmless fallback.
 */

import type { FunctionRow } from '@/types/assistants/brain';

export interface FunctionSkill {
  functionId: number | null;
  name: string;
  language: string;
  argspec: string;
  docstring: string;
  implementation: string | null;
  dependsOn: string[];
  guidanceIds: number[];
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

export function mapFunctionRow(row: FunctionRow): FunctionSkill {
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
    precondition:
      (readField(raw, 'precondition', 'precondition') as Record<string, unknown>) ?? null,
    isPrimitive: typeof isPrimitiveField === 'boolean' ? isPrimitiveField : table === 'Primitives',
    verify: readField(raw, 'verify', 'verify') !== false,
  };
}

/** Short, signature-style summary for a function card. */
export function shortSignature(skill: FunctionSkill): string {
  const bare = skill.name.includes('.') ? (skill.name.split('.').pop() ?? skill.name) : skill.name;
  const args = skill.argspec.replace(/^\(self, ?/, '(');
  return `${bare}${args}`;
}

export function filterFunctions(
  skills: FunctionSkill[],
  query: string,
  kind: FunctionKindFilter
): FunctionSkill[] {
  const q = query.trim().toLowerCase();
  return skills.filter((skill) => {
    if (kind === 'Learned' && skill.isPrimitive) return false;
    if (kind === 'Primitives' && !skill.isPrimitive) return false;
    if (!q) return true;
    return (skill.name + ' ' + skill.docstring).toLowerCase().includes(q);
  });
}
