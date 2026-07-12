/**
 * View-model mapping for the Brain → Knowledge claim ledger.
 *
 * Field inventory is the `Knowledge` pydantic model in the unity repo
 * (`knowledge_manager/types/knowledge.py`). The `/api/logs` route runs the body
 * through `createOrchestraClient`, which deep-converts snake→camel, so `entries`
 * reach this mapper in camelCase. `readField(snake, camel)` resolves the camel
 * key at runtime and keeps the snake key as a harmless fallback.
 */

import type {
  KnowledgeClaim,
  KnowledgeKind,
  KnowledgeRow,
  KnowledgeSourceKind,
  KnowledgeSourceRef,
  KnowledgeStatus,
} from '@/types/assistants/brain';
import { mapStaleReasons } from '@/utils/assistants/staleReasons';

export const KNOWLEDGE_KINDS: readonly KnowledgeKind[] = [
  'fact',
  'policy',
  'definition',
  'decision',
  'constraint',
  'insight',
  'preference',
] as const;

export const KNOWLEDGE_STATUSES: readonly KnowledgeStatus[] = [
  'active',
  'superseded',
  'invalidated',
] as const;

export const KNOWLEDGE_SEARCH_FIELDS = ['title', 'content', 'kind', 'topics', 'status'] as const;

/** Default Orchestra filter: show active claims unless the UI overrides. */
export const KNOWLEDGE_DEFAULT_FILTER_EXPR = 'status == "active"';

function readField(row: Record<string, unknown>, snake: string, camel: string): unknown {
  const camelValue = row[camel];
  if (camelValue !== undefined && camelValue !== null) return camelValue;
  return row[snake];
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

function asOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = asString(value).trim();
  return s.length > 0 ? s : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asNumber(item)).filter((item): item is number => item !== null);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item).trim()).filter((item) => item.length > 0);
}

function asOptionalNumber(value: unknown): number | null {
  return asNumber(value);
}

function mapSourceRef(raw: unknown): KnowledgeSourceRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const kind = asString(readField(row, 'kind', 'kind')).trim();
  if (!kind) return null;
  return {
    kind: kind as KnowledgeSourceKind | string,
    note: asOptionalString(readField(row, 'note', 'note')),
    fileId: asOptionalNumber(readField(row, 'file_id', 'fileId')),
    filepath: asOptionalString(readField(row, 'filepath', 'filepath')),
    context: asOptionalString(readField(row, 'context', 'context')),
    contactId: asOptionalNumber(readField(row, 'contact_id', 'contactId')),
    url: asOptionalString(readField(row, 'url', 'url')),
    exchangeId: asOptionalNumber(readField(row, 'exchange_id', 'exchangeId')),
    knowledgeId: asOptionalNumber(readField(row, 'knowledge_id', 'knowledgeId')),
  };
}

function mapSourceRefs(value: unknown): KnowledgeSourceRef[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapSourceRef).filter((ref): ref is KnowledgeSourceRef => ref !== null);
}

/**
 * Normalize a raw Orchestra / simulation Knowledge log row into a typed claim.
 */
export function mapKnowledgeRow(row: KnowledgeRow | Record<string, unknown>): KnowledgeClaim {
  const raw = row as Record<string, unknown>;
  const knowledgeId = asNumber(readField(raw, 'knowledge_id', 'knowledgeId')) ?? -1;
  const kindRaw = asString(readField(raw, 'kind', 'kind')).trim() || 'fact';
  const statusValue = asString(readField(raw, 'status', 'status')).trim() || 'active';
  const statusRaw = statusValue === 'orphaned' ? 'active' : statusValue;
  const confidenceRaw = readField(raw, 'confidence', 'confidence');
  const confidence =
    typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
      ? confidenceRaw
      : asNumber(confidenceRaw);

  return {
    knowledgeId,
    title: asString(readField(raw, 'title', 'title')).trim() || 'Untitled',
    content: asString(readField(raw, 'content', 'content')),
    kind: kindRaw as KnowledgeKind | string,
    topics: asStringArray(readField(raw, 'topics', 'topics')),
    sourceRefs: mapSourceRefs(readField(raw, 'source_refs', 'sourceRefs')),
    confidence,
    observedAt: asOptionalString(readField(raw, 'observed_at', 'observedAt')),
    validFrom: asOptionalString(readField(raw, 'valid_from', 'validFrom')),
    validUntil: asOptionalString(readField(raw, 'valid_until', 'validUntil')),
    status: statusRaw as KnowledgeStatus | string,
    supersedesIds: asNumberArray(readField(raw, 'supersedes_ids', 'supersedesIds')),
    supersededById: asOptionalNumber(readField(raw, 'superseded_by_id', 'supersededById')),
    staleReasons: mapStaleReasons(readField(raw, 'stale_reasons', 'staleReasons')),
    isBuiltin: readField(raw, 'is_builtin', 'isBuiltin') === true,
    customKey: asOptionalString(readField(raw, 'custom_key', 'customKey')),
    customHash: asOptionalString(readField(raw, 'custom_hash', 'customHash')),
    authoringAssistantId: asOptionalNumber(
      readField(raw, 'authoring_assistant_id', 'authoringAssistantId')
    ),
    scope: asOptionalString(raw.scope),
    updatedAt: asOptionalString(readField(raw, 'updated_at', 'updatedAt')),
    createdAt: asOptionalString(readField(raw, 'created_at', 'createdAt')),
    ts: asOptionalString(raw.ts),
  };
}

/** Short label for a source_ref chip. */
export function formatSourceRefLabel(ref: KnowledgeSourceRef): string {
  if (ref.filepath) return ref.filepath;
  if (ref.url) return ref.url;
  if (ref.context) return ref.context;
  if (ref.contactId != null) return `contact #${ref.contactId}`;
  if (ref.fileId != null) return `file #${ref.fileId}`;
  if (ref.exchangeId != null) return `exchange #${ref.exchangeId}`;
  if (ref.knowledgeId != null) return `claim #${ref.knowledgeId}`;
  if (ref.note) return ref.note;
  return String(ref.kind).replace(/_/g, ' ');
}
