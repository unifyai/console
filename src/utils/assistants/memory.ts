/**
 * Column definitions and formatting utilities for the Memory tab tables.
 *
 * Each context (Contacts, Transcripts, Knowledge, Tasks) defines a set of
 * visible columns with display labels and optional value formatters.
 */

import type { ColumnDef } from '@tanstack/react-table';
import type {
  MemoryContext,
  ContactRow,
  TranscriptRow,
  KnowledgeRow,
  TaskRow,
} from '@/types/assistants/memory';

function truncate(value: unknown, max = 120): string {
  if (value === null || value === undefined) return '—';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > max ? `${str.slice(0, max)}…` : str;
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

function col<T>(
  accessorKey: string & keyof T,
  header: string,
  opts?: { formatter?: (v: unknown) => string; minWidth?: number }
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

export function buildTranscriptColumns(
  contactMap: Map<number, string>
): ColumnDef<TranscriptRow>[] {
  if (contactMap.size === 0) return TRANSCRIPT_COLUMNS;

  return TRANSCRIPT_COLUMNS.map((colDef) => {
    if ((colDef as any).accessorKey !== 'senderId') return colDef;
    return {
      ...colDef,
      cell: ({ getValue }: { getValue: () => unknown }) => {
        const id = getValue();
        if (typeof id !== 'number') return truncate(id);
        const name = contactMap.get(id);
        return name ? `${name} (${id})` : String(id);
      },
    };
  });
}

export const TASK_COLUMNS: ColumnDef<TaskRow>[] = [
  col<TaskRow>('taskId', 'ID'),
  col<TaskRow>('status', 'Status'),
  col<TaskRow>('priority', 'Priority'),
  col<TaskRow>('entrypoint', 'Entrypoint', { formatter: (v) => truncate(v, 60) }),
  col<TaskRow>('triggerType', 'Trigger'),
  col<TaskRow>('nextDueAt', 'Next Due', { formatter: formatTimestamp }),
  col<TaskRow>('createdAt', 'Created', { formatter: formatTimestamp }),
];

/**
 * Builds dynamic columns for Knowledge rows (schema varies per assistant).
 * Uses the discovered field names from the API response.
 */
export function buildKnowledgeColumns(fields: string[]): ColumnDef<KnowledgeRow>[] {
  if (fields.length === 0) return [];
  return fields.map((field) => col<KnowledgeRow>(field as string & keyof KnowledgeRow, field));
}

export function getColumnsForContext(context: MemoryContext, fields?: string[]) {
  switch (context) {
    case 'Contacts':
      return CONTACT_COLUMNS;
    case 'Transcripts':
      return TRANSCRIPT_COLUMNS;
    case 'Knowledge':
      return buildKnowledgeColumns(fields ?? []);
    case 'Tasks':
      return TASK_COLUMNS;
  }
}

export const MEMORY_CONTEXT_LABELS: Record<MemoryContext, string> = {
  Contacts: 'Contacts',
  Transcripts: 'Transcripts',
  Knowledge: 'Knowledge',
  Tasks: 'Tasks',
};

const TIMESTAMP_KEYS = new Set([
  'timestamp',
  'createdAt',
  'updatedAt',
  'nextDueAt',
  'created_at',
  'updated_at',
]);

export function formatDetailValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (TIMESTAMP_KEYS.has(key) && typeof value === 'string') return formatTimestamp(value);
  if (Array.isArray(value)) return value.map((v) => JSON.stringify(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
