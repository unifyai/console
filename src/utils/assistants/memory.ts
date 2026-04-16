/**
 * Column definitions and formatting utilities for the Memory tab tables.
 *
 * Each context (Contacts, Transcripts, Knowledge, Tasks) defines a set of
 * visible columns with display labels and optional value formatters.
 */

import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
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

const BADGE_BASE_CLASS =
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium';
const BADGE_FALLBACK_CLASS =
  'border-border/70 bg-muted/70 text-foreground dark:border-border/70 dark:bg-muted/40 dark:text-foreground';

const HUMANIZED_TASK_LABELS = new Map<string, string>([
  ['sms_message', 'SMS message'],
  ['unify_message', 'Unify message'],
  ['whatsapp', 'WhatsApp'],
  ['phone_call', 'Phone call'],
  ['live', 'Live'],
  ['offline', 'Offline'],
  ['scheduled', 'Scheduled'],
  ['triggered', 'Triggered'],
  ['explicit', 'Explicit'],
  ['queue', 'Queued'],
  ['running', 'Running'],
  ['completed', 'Completed'],
  ['failed', 'Failed'],
  ['cancelled', 'Cancelled'],
  ['pending', 'Pending'],
  ['triggerable', 'Ready'],
  ['manual', 'Manual'],
]);

const TASK_STATUS_TONES: Record<string, string> = {
  pending:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/45 dark:bg-amber-500/15 dark:text-amber-200',
  scheduled:
    'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/45 dark:bg-sky-500/15 dark:text-sky-200',
  running:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-200',
  completed:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/45 dark:bg-emerald-500/15 dark:text-emerald-200',
  failed:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-500/45 dark:bg-red-500/15 dark:text-red-200',
  cancelled:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/45 dark:bg-slate-500/15 dark:text-slate-200',
  triggerable:
    'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/45 dark:bg-violet-500/15 dark:text-violet-200',
};

const TASK_KIND_TONES: Record<string, string> = {
  scheduled:
    'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/45 dark:bg-sky-500/15 dark:text-sky-200',
  triggered:
    'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/45 dark:bg-violet-500/15 dark:text-violet-200',
};

const TASK_MODE_TONES: Record<string, string> = {
  live: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/45 dark:bg-emerald-500/15 dark:text-emerald-200',
  offline:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/45 dark:bg-amber-500/15 dark:text-amber-200',
};

const TASK_SOURCE_TONES: Record<string, string> = {
  scheduled:
    'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/45 dark:bg-sky-500/15 dark:text-sky-200',
  triggered:
    'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/45 dark:bg-violet-500/15 dark:text-violet-200',
  explicit:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/45 dark:bg-slate-500/15 dark:text-slate-200',
  queue:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/45 dark:bg-slate-500/15 dark:text-slate-200',
};

function truncate(value: unknown, max = 120): string {
  if (value === null || value === undefined) return '—';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function humanizeTaskLabel(value: unknown): string {
  if (!isPresent(value)) return '—';
  const raw = String(value).trim();
  const mapped = HUMANIZED_TASK_LABELS.get(raw.toLowerCase());
  if (mapped) return mapped;
  return toTitleCase(raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim());
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

function accessorCell<T>(
  accessorKey: string & keyof T,
  header: string,
  render: (row: T, value: unknown) => React.ReactNode,
  minWidth?: number
): ColumnDef<T> {
  return {
    accessorKey,
    header,
    cell: ({ row, getValue }) => render(row.original, getValue()),
    size: minWidth,
  };
}

function displayCell(
  label: React.ReactNode,
  toneClass: string,
  dotClassName?: string
): React.ReactNode {
  const children: React.ReactNode[] = [];
  if (dotClassName) {
    children.push(
      React.createElement('span', {
        key: 'dot',
        className: cn('h-1.5 w-1.5 rounded-full', dotClassName),
      })
    );
  }
  children.push(React.createElement('span', { key: 'label' }, label));
  return React.createElement(
    'span',
    {
      className: cn(BADGE_BASE_CLASS, toneClass),
    },
    children
  );
}

function badgeTone(
  value: string,
  tones: Record<string, string>,
  fallback = BADGE_FALLBACK_CLASS
): string {
  return tones[value.toLowerCase()] ?? fallback;
}

function badgeCell(value: unknown, tones: Record<string, string>, fallback = BADGE_FALLBACK_CLASS) {
  if (!isPresent(value)) return '—';
  const raw = String(value);
  return displayCell(humanizeTaskLabel(raw), badgeTone(raw, tones, fallback));
}

function taskStateBadge(value: unknown): React.ReactNode {
  if (!isPresent(value)) return '—';
  const raw = String(value);
  return displayCell(
    humanizeTaskLabel(raw),
    badgeTone(raw, TASK_STATUS_TONES),
    raw.toLowerCase() === 'running' ? 'animate-pulse bg-emerald-500/90' : undefined
  );
}

function textLine(key: string, text: React.ReactNode, className: string): React.ReactNode {
  return React.createElement('div', { key, className }, text);
}

function stackedCell({
  primary,
  secondary,
  tertiary,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  tertiary?: React.ReactNode;
}): React.ReactNode {
  const children: React.ReactNode[] = [
    textLine('primary', primary, 'truncate font-medium text-foreground'),
  ];
  if (isPresent(secondary)) {
    children.push(
      textLine(
        'secondary',
        secondary,
        'line-clamp-2 whitespace-normal text-[11px] text-muted-foreground'
      )
    );
  }
  if (isPresent(tertiary)) {
    children.push(textLine('tertiary', tertiary, 'text-[11px] text-muted-foreground/80'));
  }
  return React.createElement(
    'div',
    { className: 'min-w-0 space-y-1 whitespace-normal leading-5' },
    children
  );
}

function taskIdentityTitle(
  title: string | null | undefined,
  taskId: number | null | undefined
): string {
  const normalizedTitle = isPresent(title) ? String(title) : null;
  if (normalizedTitle) return normalizedTitle;
  return taskId !== null && taskId !== undefined ? `Task ${taskId}` : 'Untitled task';
}

function taskIdentityCell({
  title,
  description,
  taskId,
  tertiary,
}: {
  title: string | null | undefined;
  description: string | null | undefined;
  taskId: number | null | undefined;
  tertiary?: React.ReactNode;
}): React.ReactNode {
  return stackedCell({
    primary: taskIdentityTitle(title, taskId),
    secondary: isPresent(description) ? truncate(description, 120) : undefined,
    tertiary: tertiary ?? (taskId !== null && taskId !== undefined ? `Task #${taskId}` : undefined),
  });
}

function formatTaskStartContext(row: TaskRow): React.ReactNode {
  const triggerLabel = humanizeTaskLabel(row.triggerType);
  const detail = row.nextDueAt
    ? `Next due ${formatTimestamp(row.nextDueAt)}`
    : isPresent(row.entrypoint)
      ? `Entrypoint ${truncate(row.entrypoint, 48)}`
      : undefined;
  return stackedCell({
    primary: triggerLabel,
    secondary: detail,
    tertiary:
      row.priority !== null && row.priority !== undefined ? `Priority ${row.priority}` : undefined,
  });
}

function formatTaskTimingCell(row: TaskRow): React.ReactNode {
  return stackedCell({
    primary: row.nextDueAt ? `Next due ${formatTimestamp(row.nextDueAt)}` : 'No due time set',
    secondary: row.createdAt ? `Created ${formatTimestamp(row.createdAt)}` : undefined,
    tertiary: row.updatedAt ? `Updated ${formatTimestamp(row.updatedAt)}` : undefined,
  });
}

function formatActivationContextCell(row: TaskActivationRow): React.ReactNode {
  return stackedCell({
    primary: badgeCell(row.activationKind, TASK_KIND_TONES),
    secondary:
      row.activationKind === 'scheduled' && row.nextDueAt
        ? `Due ${formatTimestamp(row.nextDueAt)}`
        : row.triggerMedium
          ? `Triggered by ${humanizeTaskLabel(row.triggerMedium)}`
          : row.status
            ? `Activation is ${humanizeTaskLabel(row.status)}`
            : undefined,
    tertiary: row.activationKey ? `Key ${row.activationKey}` : undefined,
  });
}

function formatActivationTimingCell(row: TaskActivationRow): React.ReactNode {
  return stackedCell({
    primary: row.nextDueAt ? `Next due ${formatTimestamp(row.nextDueAt)}` : 'Waiting for a trigger',
    secondary: row.lastMaterializedAt
      ? `Projected ${formatTimestamp(row.lastMaterializedAt)}`
      : undefined,
  });
}

function formatRunSourceSecondary(row: TaskRunRow): string | undefined {
  const contact = isPresent(row.sourceContactDisplayName)
    ? String(row.sourceContactDisplayName)
    : isPresent(row.sourceContactId)
      ? `Contact ${row.sourceContactId}`
      : null;
  const medium = isPresent(row.sourceMedium) ? humanizeTaskLabel(row.sourceMedium) : null;
  if (contact && medium) return `${contact} via ${medium}`;
  if (contact) return contact;
  if (medium) return medium;
  if (row.scheduledFor) return `Due ${formatTimestamp(row.scheduledFor)}`;
  return undefined;
}

function formatRunSourceCell(row: TaskRunRow): React.ReactNode {
  return stackedCell({
    primary: badgeCell(row.sourceType, TASK_SOURCE_TONES),
    secondary: formatRunSourceSecondary(row),
    tertiary: row.sourceRef ? `Ref ${truncate(row.sourceRef, 48)}` : undefined,
  });
}

function formatRunTimingCell(row: TaskRunRow): React.ReactNode {
  const primary =
    row.state === 'completed' && row.completedAt
      ? `Completed ${formatTimestamp(row.completedAt)}`
      : row.startedAt
        ? `Started ${formatTimestamp(row.startedAt)}`
        : row.scheduledFor
          ? `Scheduled ${formatTimestamp(row.scheduledFor)}`
          : 'Waiting to start';
  const secondary =
    row.startedAt && row.scheduledFor && row.startedAt !== row.scheduledFor
      ? `Scheduled ${formatTimestamp(row.scheduledFor)}`
      : row.completedAt && row.startedAt
        ? `Started ${formatTimestamp(row.startedAt)}`
        : undefined;
  return stackedCell({
    primary,
    secondary,
    tertiary: row.jobName ? `Job ${row.jobName}` : undefined,
  });
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
    if ((colDef as { accessorKey?: string }).accessorKey !== 'senderId') return colDef;
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
  accessorCell<TaskRow>(
    'name',
    'Task',
    (row, value) =>
      taskIdentityCell({
        title: typeof value === 'string' ? value : null,
        description: row.description,
        taskId: row.taskId,
      }),
    280
  ),
  accessorCell<TaskRow>(
    'status',
    'Status',
    (_row, value) => badgeCell(value, TASK_STATUS_TONES),
    120
  ),
  accessorCell<TaskRow>('triggerType', 'How It Starts', (row) => formatTaskStartContext(row), 220),
  accessorCell<TaskRow>('nextDueAt', 'Timing', (row) => formatTaskTimingCell(row), 220),
];

export const TASK_ACTIVATION_COLUMNS: ColumnDef<TaskActivationRow>[] = [
  accessorCell<TaskActivationRow>(
    'taskName',
    'Task',
    (row, value) =>
      taskIdentityCell({
        title: typeof value === 'string' ? value : null,
        description: row.taskDescription,
        taskId: row.taskId,
      }),
    280
  ),
  accessorCell<TaskActivationRow>(
    'status',
    'Activation',
    (_row, value) => badgeCell(value, TASK_STATUS_TONES),
    130
  ),
  accessorCell<TaskActivationRow>(
    'activationKind',
    'Trigger',
    (row) => formatActivationContextCell(row),
    220
  ),
  accessorCell<TaskActivationRow>(
    'executionMode',
    'Mode',
    (_row, value) => badgeCell(value, TASK_MODE_TONES),
    120
  ),
  accessorCell<TaskActivationRow>(
    'lastMaterializedAt',
    'Timing',
    (row) => formatActivationTimingCell(row),
    220
  ),
];

export const TASK_RUN_COLUMNS: ColumnDef<TaskRunRow>[] = [
  accessorCell<TaskRunRow>(
    'taskName',
    'Task',
    (row, value) =>
      taskIdentityCell({
        title: typeof value === 'string' ? value : null,
        description: row.taskDescription,
        taskId: row.taskId,
        tertiary: row.runId !== null && row.runId !== undefined ? `Run #${row.runId}` : undefined,
      }),
    280
  ),
  accessorCell<TaskRunRow>('state', 'State', (_row, value) => taskStateBadge(value), 120),
  accessorCell<TaskRunRow>('sourceType', 'Source', (row) => formatRunSourceCell(row), 240),
  accessorCell<TaskRunRow>('startedAt', 'Timing', (row) => formatRunTimingCell(row), 240),
  accessorCell<TaskRunRow>(
    'executionMode',
    'Mode',
    (_row, value) => badgeCell(value, TASK_MODE_TONES),
    120
  ),
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

function detailItem(items: DetailSectionItem[], key: string, label: string, value: unknown): void {
  if (!isPresent(value)) return;
  items.push({ key, label, value });
}

function detailSection(title: string, items: DetailSectionItem[]): DetailSection | null {
  if (items.length === 0) return null;
  return { title, items };
}

function isTaskRunRow(row: Record<string, unknown>): boolean {
  return isPresent(row.runKey) || isPresent(row.runId);
}

function isTaskActivationRow(row: Record<string, unknown>): boolean {
  return isPresent(row.activationKey);
}

export function buildTaskDetailSections(row: Record<string, unknown>): DetailSection[] {
  const sections: DetailSection[] = [];
  const usedKeys = new Set<string>();
  const addSection = (title: string, definitions: Array<[string, string, unknown]>) => {
    const items: DetailSectionItem[] = [];
    definitions.forEach(([key, label, value]) => {
      if (!isPresent(value)) return;
      usedKeys.add(key);
      detailItem(items, key, label, value);
    });
    const section = detailSection(title, items);
    if (section) sections.push(section);
  };

  if (isTaskRunRow(row)) {
    const contactDisplay = isPresent(row.sourceContactDisplayName)
      ? isPresent(row.sourceContactId)
        ? `${row.sourceContactDisplayName} (contact ${row.sourceContactId})`
        : row.sourceContactDisplayName
      : row.sourceContactId;
    addSection('Task', [
      ['taskName', 'Task', row.taskName],
      ['taskDescription', 'Description', row.taskDescription],
      ['state', 'State', humanizeTaskLabel(row.state)],
      ['executionMode', 'Mode', humanizeTaskLabel(row.executionMode)],
    ]);
    addSection('Source', [
      ['sourceType', 'Source', humanizeTaskLabel(row.sourceType)],
      ['sourceMedium', 'Medium', humanizeTaskLabel(row.sourceMedium)],
      ['sourceContactDisplayName', 'Contact', contactDisplay],
      ['sourceRef', 'Reference', row.sourceRef],
    ]);
    addSection('Timing', [
      ['scheduledFor', 'Scheduled for', row.scheduledFor],
      ['startedAt', 'Started at', row.startedAt],
      ['completedAt', 'Completed at', row.completedAt],
    ]);
    addSection('Identifiers & Debug', [
      ['taskId', 'Task ID', row.taskId],
      ['runId', 'Run ID', row.runId],
      ['runKey', 'Run key', row.runKey],
      ['sourceTaskLogId', 'Source task log ID', row.sourceTaskLogId],
      ['activationRevision', 'Activation revision', row.activationRevision],
      ['assistantId', 'Assistant ID', row.assistantId],
      ['jobName', 'Job name', row.jobName],
      ['resultSummary', 'Result summary', row.resultSummary],
      ['error', 'Error', row.error],
    ]);
  } else if (isTaskActivationRow(row)) {
    addSection('Task', [
      ['taskName', 'Task', row.taskName],
      ['taskDescription', 'Description', row.taskDescription],
      ['status', 'Activation state', humanizeTaskLabel(row.status)],
      ['executionMode', 'Mode', humanizeTaskLabel(row.executionMode)],
    ]);
    addSection('Trigger', [
      ['activationKind', 'Activation kind', humanizeTaskLabel(row.activationKind)],
      ['triggerMedium', 'Trigger medium', humanizeTaskLabel(row.triggerMedium)],
      ['triggerFromContactIds', 'Allowed contacts', row.triggerFromContactIds],
      ['triggerOmitContactIds', 'Excluded contacts', row.triggerOmitContactIds],
      ['interrupt', 'Can interrupt', row.interrupt],
      ['triggerRecurring', 'Recurring trigger', row.triggerRecurring],
      ['entrypoint', 'Entrypoint', row.entrypoint],
    ]);
    addSection('Timing', [
      ['nextDueAt', 'Next due', row.nextDueAt],
      ['lastMaterializedAt', 'Projected at', row.lastMaterializedAt],
      ['sourceTaskUpdatedAt', 'Source task updated', row.sourceTaskUpdatedAt],
    ]);
    addSection('Identifiers & Debug', [
      ['taskId', 'Task ID', row.taskId],
      ['activationKey', 'Activation key', row.activationKey],
      ['activationRevision', 'Activation revision', row.activationRevision],
      ['sourceTaskLogId', 'Source task log ID', row.sourceTaskLogId],
      ['assistantId', 'Assistant ID', row.assistantId],
      ['instanceId', 'Instance ID', row.instanceId],
    ]);
  } else {
    addSection('Task', [
      ['name', 'Task', row.name],
      ['description', 'Description', row.description],
      ['status', 'Status', humanizeTaskLabel(row.status)],
      ['priority', 'Priority', row.priority],
    ]);
    addSection('Configuration', [
      ['triggerType', 'How it starts', humanizeTaskLabel(row.triggerType)],
      ['entrypoint', 'Entrypoint', row.entrypoint],
      ['instanceId', 'Instance ID', row.instanceId],
      ['offline', 'Offline execution', row.offline],
    ]);
    addSection('Timing', [
      ['nextDueAt', 'Next due', row.nextDueAt],
      ['createdAt', 'Created at', row.createdAt],
      ['updatedAt', 'Updated at', row.updatedAt],
    ]);
    addSection('Identifiers & Debug', [['taskId', 'Task ID', row.taskId]]);
  }

  const additional: DetailSectionItem[] = Object.entries(row)
    .filter(([key, value]) => !key.startsWith('_') && !usedKeys.has(key) && isPresent(value))
    .map(([key, value]) => ({
      key,
      label: key,
      value,
    }));
  const additionalSection = detailSection('Additional metadata', additional);
  if (additionalSection) sections.push(additionalSection);

  return sections;
}

export function formatDetailValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (TIMESTAMP_KEYS.has(key) && typeof value === 'string') return formatTimestamp(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map((v) => JSON.stringify(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
