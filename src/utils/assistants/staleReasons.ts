/**
 * View-model mapping for structured link-debt records (`stale_reasons`).
 *
 * Mirrors Unity's `common/stale_reason.py` StaleReason model.
 */

import type { StaleReason } from '@/types/assistants/brain';

function readField(row: Record<string, unknown>, snake: string, camel: string): unknown {
  const camelValue = row[camel];
  if (camelValue !== undefined && camelValue !== null) return camelValue;
  return row[snake];
}

function asOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = typeof value === 'string' ? value.trim() : String(value).trim();
  return s.length > 0 ? s : null;
}

function asOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function mapStaleReason(raw: unknown): StaleReason | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const kind = asOptionalString(readField(row, 'kind', 'kind'));
  const depKind = asOptionalString(readField(row, 'dep_kind', 'depKind'));
  const message = asOptionalString(readField(row, 'message', 'message'));
  if (kind !== 'missing_dependency' || !depKind || !message) return null;
  return {
    kind,
    depKind,
    id: asOptionalNumber(readField(row, 'id', 'id')),
    name: asOptionalString(readField(row, 'name', 'name')),
    path: asOptionalString(readField(row, 'path', 'path')),
    context: asOptionalString(readField(row, 'context', 'context')),
    message,
  };
}

export function mapStaleReasons(value: unknown): StaleReason[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapStaleReason).filter((reason): reason is StaleReason => reason !== null);
}

/** Short label for a stale-reason warning chip. */
export function formatStaleReasonLabel(reason: StaleReason): string {
  if (reason.message) return reason.message;
  const dep = reason.depKind.replace(/_/g, ' ');
  if (reason.name) return `missing ${dep}: ${reason.name}`;
  if (reason.path) return `missing ${dep}: ${reason.path}`;
  if (reason.context) return `missing ${dep}: ${reason.context}`;
  if (reason.id != null) return `missing ${dep} #${reason.id}`;
  return `missing ${dep}`;
}
