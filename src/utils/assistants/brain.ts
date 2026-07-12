/**
 * Column definitions and formatting utilities for the Brain tab tables.
 *
 * Each non-Tasks context (Contacts, Transcripts, Knowledge, Guidance,
 * Functions) defines a set of visible columns with display labels and
 * optional value formatters.
 *
 * Task-specific columns, badges, and detail sections live in tasks.ts.
 */

import type { ColumnDef } from '@tanstack/react-table';
import type {
  BrainContext,
  ContactRow,
  TranscriptRow,
  KnowledgeRow,
  GuidanceRow,
  FunctionRow,
} from '@/types/assistants/brain';

// ── Shared primitives (also consumed by tasks.ts) ────────────────────

export function truncate(value: unknown, max = 120): string {
  if (value === null || value === undefined) return '—';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

export function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function formatTimestamp(value: unknown): string {
  if (!value || typeof value !== 'string') return '—';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

// ── Column helpers ───────────────────────────────────────────────────

function col<T>(
  accessorKey: string & keyof T,
  header: string,
  opts?: { formatter?: (v: unknown) => React.ReactNode; minWidth?: number }
): ColumnDef<T> {
  return {
    accessorKey,
    header,
    cell: ({ getValue }) => {
      const raw = getValue();
      return opts?.formatter ? opts.formatter(raw) : truncate(raw);
    },
    size: opts?.minWidth,
  };
}

// ── Column definitions ───────────────────────────────────────────────

export const CONTACT_COLUMNS: ColumnDef<ContactRow>[] = [
  col<ContactRow>('contactId', 'ID'),
  col<ContactRow>('firstName', 'First Name'),
  col<ContactRow>('surname', 'Last Name'),
  col<ContactRow>('emailAddress', 'Email'),
  col<ContactRow>('phoneNumber', 'Phone'),
  col<ContactRow>('timezone', 'Timezone'),
];

export const TRANSCRIPT_COLUMNS: ColumnDef<TranscriptRow>[] = [
  col<TranscriptRow>('messageId', 'ID'),
  col<TranscriptRow>('medium', 'Medium'),
  col<TranscriptRow>('senderId', 'Sender'),
  col<TranscriptRow>('timestamp', 'Time', { formatter: formatTimestamp }),
  col<TranscriptRow>('content', 'Content', { formatter: (v) => truncate(v, 200) }),
];

export interface TranscriptSenderLabelOptions {
  assistantContactIds?: Set<number>;
  assistantDisplayName?: string;
  selectedAssistantId?: number | null;
  assistantNamesById?: Map<number, string>;
}

function resolveAuthoringAssistantId(row: TranscriptRow): number | null {
  if (typeof row.authoringAssistantId === 'number') {
    return row.authoringAssistantId;
  }
  const snakeCaseValue = (row as unknown as Record<string, unknown>)['authoring_assistant_id'];
  return typeof snakeCaseValue === 'number' ? snakeCaseValue : null;
}

function assistantLabel(
  contactId: number,
  authoringAssistantId: number,
  options?: TranscriptSenderLabelOptions
): string {
  const authorName =
    options?.assistantNamesById?.get(authoringAssistantId) ??
    (options?.selectedAssistantId === authoringAssistantId ? options.assistantDisplayName : null);
  if (authorName) {
    return `${authorName} (${contactId})`;
  }
  return `Assistant ${authoringAssistantId} (${contactId})`;
}

export function formatTranscriptSenderLabel(
  row: TranscriptRow,
  contactMap: Map<number, string>,
  options?: TranscriptSenderLabelOptions
): string {
  const senderId = row.senderId;
  if (typeof senderId !== 'number') return truncate(senderId);
  const authoringAssistantId = resolveAuthoringAssistantId(row);

  if (options?.assistantContactIds?.has(senderId)) {
    if (authoringAssistantId !== null) {
      return assistantLabel(senderId, authoringAssistantId, options);
    }
    if (options.assistantDisplayName) {
      return `${options.assistantDisplayName} (${senderId})`;
    }
  }

  const contactName = contactMap.get(senderId);
  return contactName ? `${contactName} (${senderId})` : String(senderId);
}

export function buildTranscriptColumns(
  contactMap: Map<number, string>,
  options?: TranscriptSenderLabelOptions
): ColumnDef<TranscriptRow>[] {
  return TRANSCRIPT_COLUMNS.map((colDef) => {
    if ((colDef as { accessorKey?: string }).accessorKey !== 'senderId') return colDef;
    return {
      ...colDef,
      cell: ({ row }: { row: { original: TranscriptRow } }) => {
        return formatTranscriptSenderLabel(row.original, contactMap, options);
      },
    };
  });
}

export const GUIDANCE_COLUMNS: ColumnDef<GuidanceRow>[] = [
  col<GuidanceRow>('title', 'Title'),
  col<GuidanceRow>('content', 'Content', { formatter: (v) => truncate(v, 200) }),
];

export const FUNCTION_COLUMNS: ColumnDef<FunctionRow>[] = [
  col<FunctionRow>('name', 'Name'),
  col<FunctionRow>('language', 'Language'),
  col<FunctionRow>('argspec', 'Args', { formatter: (v) => truncate(v, 80) }),
  col<FunctionRow>('docstring', 'Description', { formatter: (v) => truncate(v, 120) }),
];

export const KNOWLEDGE_COLUMNS: ColumnDef<KnowledgeRow>[] = [
  col<KnowledgeRow>('title', 'Title'),
  col<KnowledgeRow>('kind', 'Kind'),
  col<KnowledgeRow>('status', 'Status'),
  col<KnowledgeRow>('content', 'Content', { formatter: (v) => truncate(v, 200) }),
];

/**
 * Builds dynamic columns for rows whose schema varies (e.g. Functions sub-tables).
 */
export function buildDynamicColumns(fields: string[]): ColumnDef<KnowledgeRow>[] {
  if (fields.length === 0) return [];
  return fields
    .filter((f) => !f.startsWith('_'))
    .map((field) => col<KnowledgeRow>(field as string & keyof KnowledgeRow, field));
}

/** @deprecated Prefer {@link buildDynamicColumns} or {@link KNOWLEDGE_COLUMNS}. */
export const buildKnowledgeColumns = buildDynamicColumns;

export function getColumnsForContext(context: BrainContext, fields?: string[]) {
  switch (context) {
    case 'Contacts':
      return CONTACT_COLUMNS;
    case 'Transcripts':
      return TRANSCRIPT_COLUMNS;
    case 'Knowledge':
      return KNOWLEDGE_COLUMNS;
    case 'Tasks':
      return [];
    case 'Guidance':
      return GUIDANCE_COLUMNS;
    case 'Functions':
      return buildDynamicColumns(fields ?? []);
  }
}

/**
 * Labels for the Brain tab's sub-context footer tabs.
 * Tasks is intentionally excluded — it has its own dedicated tab.
 */
export const BRAIN_CONTEXT_LABELS: Partial<Record<BrainContext, string>> = {
  Contacts: 'Contacts',
  Transcripts: 'Transcripts',
  Knowledge: 'Knowledge',
  Guidance: 'Guidance',
  Functions: 'Functions',
};

const TIMESTAMP_KEYS = new Set([
  'timestamp',
  'createdAt',
  'updatedAt',
  'nextDueAt',
  'lastMaterializedAt',
  'scheduledFor',
  'startedAt',
  'completedAt',
  'sourceTaskUpdatedAt',
  'created_at',
  'updated_at',
]);

export interface DetailSectionItem {
  key: string;
  label: string;
  value: unknown;
}

export interface DetailSection {
  title: string;
  items: DetailSectionItem[];
}

export function formatDetailValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (TIMESTAMP_KEYS.has(key) && typeof value === 'string') return formatTimestamp(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map((v) => JSON.stringify(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
