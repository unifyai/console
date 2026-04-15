/**
 * Column definitions and formatting utilities for the Memory tab tables.
 *
 * Each context (Contacts, Transcripts, Knowledge, Tasks) defines a set of
 * visible columns with display labels and optional value formatters.
 */

import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  MemoryContext,
  TaskMemoryView,
  ContactRow,
  TranscriptRow,
  KnowledgeRow,
  TaskRow,
  TaskActivationRow,
  TaskRunRow,
  GuidanceRow,
  FunctionRow,
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

function badgeTone(
  value: string,
  tones: Record<string, string>,
  fallback = 'bg-muted text-muted-foreground'
): string {
  return tones[value.toLowerCase()] ?? fallback;
}

function badgeCell(
  value: unknown,
  tones: Record<string, string>,
  fallback = 'bg-muted text-muted-foreground'
) {
  if (value === null || value === undefined || value === '') return '—';
  const label = String(value);
  return React.createElement(
    'span',
    {
      className: [
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        badgeTone(label, tones, fallback),
      ].join(' '),
    },
    label
  );
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

export const TASK_ACTIVATION_COLUMNS: ColumnDef<TaskActivationRow>[] = [
  col<TaskActivationRow>('taskId', 'Task'),
  col<TaskActivationRow>('activationKind', 'Kind', {
    formatter: (value) =>
      badgeCell(value, {
        scheduled: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
        triggered: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
      }),
  }),
  col<TaskActivationRow>('executionMode', 'Mode', {
    formatter: (value) =>
      badgeCell(value, {
        live: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
        offline: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
      }),
  }),
  col<TaskActivationRow>('status', 'Status'),
  col<TaskActivationRow>('taskName', 'Task'),
  col<TaskActivationRow>('nextDueAt', 'Next Due', { formatter: formatTimestamp }),
  col<TaskActivationRow>('triggerMedium', 'Trigger'),
  col<TaskActivationRow>('lastMaterializedAt', 'Updated', { formatter: formatTimestamp }),
];

export const TASK_RUN_COLUMNS: ColumnDef<TaskRunRow>[] = [
  col<TaskRunRow>('taskId', 'Task'),
  col<TaskRunRow>('state', 'State', {
    formatter: (value) =>
      badgeCell(value, {
        running: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
        completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
        failed: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
        cancelled: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
      }),
  }),
  col<TaskRunRow>('executionMode', 'Mode', {
    formatter: (value) =>
      badgeCell(value, {
        live: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
        offline: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
      }),
  }),
  col<TaskRunRow>('sourceType', 'Source', {
    formatter: (value) =>
      badgeCell(value, {
        scheduled: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
        triggered: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
        explicit: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
        queue: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
      }),
  }),
  col<TaskRunRow>('scheduledFor', 'Scheduled', { formatter: formatTimestamp }),
  col<TaskRunRow>('sourceMedium', 'Medium'),
  col<TaskRunRow>('startedAt', 'Started', { formatter: formatTimestamp }),
  col<TaskRunRow>('completedAt', 'Completed', { formatter: formatTimestamp }),
];

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

/**
 * Builds dynamic columns for Knowledge rows (schema varies per assistant).
 * Uses the discovered field names from the API response.
 */
export function buildKnowledgeColumns(fields: string[]): ColumnDef<KnowledgeRow>[] {
  if (fields.length === 0) return [];
  return fields
    .filter((f) => !f.startsWith('_'))
    .map((field) => col<KnowledgeRow>(field as string & keyof KnowledgeRow, field));
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
    case 'Guidance':
      return GUIDANCE_COLUMNS;
    case 'Functions':
      return buildKnowledgeColumns(fields ?? []);
  }
}

export function getColumnsForTaskView(view: TaskMemoryView, _fields?: string[]) {
  switch (view) {
    case 'Definitions':
      return TASK_COLUMNS;
    case 'Activations':
      return TASK_ACTIVATION_COLUMNS;
    case 'Runs':
      return TASK_RUN_COLUMNS;
  }
}

export const MEMORY_CONTEXT_LABELS: Record<MemoryContext, string> = {
  Contacts: 'Contacts',
  Transcripts: 'Transcripts',
  Knowledge: 'Knowledge',
  Tasks: 'Tasks',
  Guidance: 'Guidance',
  Functions: 'Functions',
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
