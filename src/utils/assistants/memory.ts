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
  TaskScheduleRow,
  TaskTriggerRow,
  TaskRepeatPatternRow,
  TaskRunRow,
  GuidanceRow,
  FunctionRow,
} from '@/types/assistants/memory';

const BADGE_BASE_CLASS =
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-[0.01em]';
const BADGE_FALLBACK_CLASS =
  'border-border/70 bg-muted/70 text-foreground dark:border-slate-400/40 dark:bg-slate-400/15 dark:text-slate-50';

const HUMANIZED_TASK_LABELS = new Map<string, string>([
  ['sms_message', 'SMS message'],
  ['unify_message', 'Unify message'],
  ['whatsapp', 'WhatsApp'],
  ['phone_call', 'Phone call'],
  ['live', 'Live'],
  ['offline', 'Offline'],
  ['scheduled', 'Scheduled'],
  ['triggered', 'Triggered'],
  ['explicit', 'On demand'],
  ['queue', 'Queued'],
  ['running', 'Running'],
  ['completed', 'Completed'],
  ['failed', 'Failed'],
  ['cancelled', 'Cancelled'],
  ['pending', 'Pending'],
  ['triggerable', 'Ready'],
  ['manual', 'On demand'],
]);

const TASK_STATUS_TONES: Record<string, string> = {
  pending:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/55 dark:bg-amber-400/20 dark:text-amber-50',
  scheduled:
    'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/55 dark:bg-sky-400/20 dark:text-sky-50',
  running:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/55 dark:bg-emerald-400/20 dark:text-emerald-50',
  completed:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/55 dark:bg-emerald-400/20 dark:text-emerald-50',
  failed:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-400/55 dark:bg-red-400/20 dark:text-red-50',
  cancelled:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/45 dark:bg-slate-400/18 dark:text-slate-50',
  triggerable:
    'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-400/55 dark:bg-violet-400/20 dark:text-violet-50',
};

const STACKED_PRIMARY_TEXT_CLASS = 'truncate font-medium text-foreground';
const STACKED_SECONDARY_TEXT_CLASS =
  'line-clamp-2 whitespace-normal text-[11px] text-muted-foreground dark:text-slate-300';
const STACKED_TERTIARY_TEXT_CLASS = 'text-[11px] text-muted-foreground/80 dark:text-slate-400';

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

type TaskStartMode = 'scheduled' | 'triggered' | 'offline' | 'on_demand';

const WEEKDAY_LABELS = new Map<string, string>([
  ['MO', 'Mon'],
  ['TU', 'Tue'],
  ['WE', 'Wed'],
  ['TH', 'Thu'],
  ['FR', 'Fri'],
  ['SA', 'Sat'],
  ['SU', 'Sun'],
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined || Array.isArray(value) || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

function readFirstPresentValue(record: Record<string, unknown> | null, keys: string[]): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function readTaskSchedule(row: TaskRow): TaskScheduleRow | null {
  return asRecord(row.schedule) as TaskScheduleRow | null;
}

function readTaskTrigger(row: TaskRow): TaskTriggerRow | null {
  return asRecord(row.trigger) as TaskTriggerRow | null;
}

function readTaskRepeatPatterns(row: TaskRow): TaskRepeatPatternRow[] {
  if (!Array.isArray(row.repeat)) return [];
  return row.repeat
    .map((pattern) => asRecord(pattern) as TaskRepeatPatternRow | null)
    .filter((pattern): pattern is TaskRepeatPatternRow => pattern !== null);
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  if (typeof value === 'number') return value !== 0;
  return false;
}

function isOfflineTask(row: TaskRow): boolean {
  if (typeof row.offline === 'boolean') return row.offline;
  return (
    String(row.triggerType ?? '')
      .trim()
      .toLowerCase() === 'offline'
  );
}

function hasTaskSchedule(row: TaskRow): boolean {
  const schedule = readTaskSchedule(row);
  if (schedule && Object.keys(schedule).length > 0) return true;
  return (
    String(row.triggerType ?? '')
      .trim()
      .toLowerCase() === 'scheduled'
  );
}

function hasTaskTrigger(row: TaskRow): boolean {
  const trigger = readTaskTrigger(row);
  if (trigger && Object.keys(trigger).length > 0) return true;
  return (
    String(row.triggerType ?? '')
      .trim()
      .toLowerCase() === 'triggered'
  );
}

function readTaskDueAt(row: TaskRow): string | null {
  const schedule = readTaskSchedule(row);
  const value = readFirstPresentValue(schedule, ['startAt', 'start_at']) ?? row.nextDueAt;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readTaskTriggerMedium(row: TaskRow): string | null {
  const trigger = readTaskTrigger(row);
  const value = trigger?.medium;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function isRecurringTriggeredTask(row: TaskRow): boolean {
  const trigger = readTaskTrigger(row);
  const recurring = readFirstPresentValue(trigger, ['recurring']);
  return coerceBoolean(recurring);
}

function isRecurringTask(row: TaskRow): boolean {
  return readTaskRepeatPatterns(row).length > 0 || isRecurringTriggeredTask(row);
}

function resolveTaskStartMode(row: TaskRow): TaskStartMode {
  if (isOfflineTask(row)) return 'offline';
  if (hasTaskSchedule(row)) return 'scheduled';
  if (hasTaskTrigger(row)) return 'triggered';
  return 'on_demand';
}

function formatTaskStartLabel(row: TaskRow): string {
  switch (resolveTaskStartMode(row)) {
    case 'offline':
      return 'Offline';
    case 'scheduled':
      return 'Scheduled';
    case 'triggered':
      return 'Triggered';
    case 'on_demand':
      return 'On demand';
  }
}

function supportsTaskRecurrenceCue(row: TaskRow): boolean {
  return resolveTaskStartMode(row) !== 'on_demand';
}

function readRepeatWeekdays(pattern: TaskRepeatPatternRow): string[] {
  if (!Array.isArray(pattern.weekdays)) return [];
  return pattern.weekdays.filter((weekday): weekday is string => typeof weekday === 'string');
}

function readRepeatTimeOfDay(pattern: TaskRepeatPatternRow): string | null {
  const record = asRecord(pattern);
  const value = readFirstPresentValue(record, ['timeOfDay', 'time_of_day']);
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function formatRepeatCadence(pattern: TaskRepeatPatternRow): string {
  const frequency =
    typeof pattern.frequency === 'string' ? pattern.frequency.trim().toLowerCase() : '';
  const interval =
    typeof pattern.interval === 'number' &&
    Number.isFinite(pattern.interval) &&
    pattern.interval > 0
      ? pattern.interval
      : 1;
  const weekdays = readRepeatWeekdays(pattern).map(
    (weekday) => WEEKDAY_LABELS.get(weekday.toUpperCase()) ?? weekday
  );

  let cadence: string;
  switch (frequency) {
    case 'daily':
      cadence = interval === 1 ? 'Every day' : `Every ${interval} days`;
      break;
    case 'weekly':
      if (weekdays.length > 0) {
        cadence =
          interval === 1
            ? `Every week on ${weekdays.join(', ')}`
            : `Every ${interval} weeks on ${weekdays.join(', ')}`;
      } else {
        cadence = interval === 1 ? 'Every week' : `Every ${interval} weeks`;
      }
      break;
    case 'monthly':
      cadence = interval === 1 ? 'Every month' : `Every ${interval} months`;
      break;
    case 'yearly':
      cadence = interval === 1 ? 'Every year' : `Every ${interval} years`;
      break;
    default:
      cadence = 'Repeats automatically';
  }

  const timeOfDay = readRepeatTimeOfDay(pattern);
  if (timeOfDay) cadence += ` at ${timeOfDay}`;

  if (typeof pattern.count === 'number' && Number.isFinite(pattern.count) && pattern.count > 0) {
    cadence += ` for ${pattern.count} occurrences`;
  } else if (typeof pattern.until === 'string' && pattern.until.trim().length > 0) {
    cadence += ` until ${formatTimestamp(pattern.until)}`;
  }

  return cadence;
}

function formatTaskRecurrenceSummary(row: TaskRow): string | undefined {
  if (!supportsTaskRecurrenceCue(row)) return undefined;
  return isRecurringTask(row) ? 'Recurring' : 'One-time';
}

function formatTaskRecurrenceCadence(row: TaskRow): string | undefined {
  const repeatPatterns = readTaskRepeatPatterns(row);
  if (repeatPatterns.length > 1) return 'Multiple repeat schedules';
  if (repeatPatterns.length === 1) return formatRepeatCadence(repeatPatterns[0]);
  if (isRecurringTriggeredTask(row)) return 'Repeats after each matching trigger';
  return undefined;
}

function formatTaskStartDetail(row: TaskRow): string | undefined {
  const triggerMedium = readTaskTriggerMedium(row);
  switch (resolveTaskStartMode(row)) {
    case 'offline':
      if (hasTaskSchedule(row)) return 'Runs in the background on a schedule';
      if (hasTaskTrigger(row)) {
        return triggerMedium
          ? `Runs in the background for matching ${humanizeTaskLabel(triggerMedium)} activity`
          : 'Runs in the background when the matching event happens';
      }
      return 'Runs in the background without waking the assistant';
    case 'scheduled':
      return 'Runs on a schedule';
    case 'triggered':
      return triggerMedium
        ? `Waits for matching ${humanizeTaskLabel(triggerMedium)} activity`
        : 'Waits for the matching event to happen';
    case 'on_demand':
      return 'Starts only when explicitly requested';
  }
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
  const children: React.ReactNode[] = [textLine('primary', primary, STACKED_PRIMARY_TEXT_CLASS)];
  if (isPresent(secondary)) {
    children.push(textLine('secondary', secondary, STACKED_SECONDARY_TEXT_CLASS));
  }
  if (isPresent(tertiary)) {
    children.push(textLine('tertiary', tertiary, STACKED_TERTIARY_TEXT_CLASS));
  }
  return React.createElement(
    'div',
    { className: 'min-w-0 space-y-1 whitespace-normal leading-5' },
    children
  );
}

function taskIdentityTitle(
  title: string | null | undefined,
  _taskId: number | null | undefined
): string {
  const normalizedTitle = isPresent(title) ? String(title) : null;
  if (normalizedTitle) return normalizedTitle;
  return 'Untitled task';
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
    tertiary,
  });
}

function formatTaskStartContext(row: TaskRow): React.ReactNode {
  const recurrenceSummary = formatTaskRecurrenceSummary(row);
  return stackedCell({
    primary: formatTaskStartLabel(row),
    secondary: recurrenceSummary ?? formatTaskStartDetail(row),
    tertiary: recurrenceSummary ? formatTaskStartDetail(row) : undefined,
  });
}

function formatTaskTimingCell(row: TaskRow): React.ReactNode {
  const dueAt = readTaskDueAt(row);
  return stackedCell({
    primary: dueAt ? `Next due ${formatTimestamp(dueAt)}` : 'No due time set',
    secondary: row.createdAt ? `Created ${formatTimestamp(row.createdAt)}` : undefined,
    tertiary: row.updatedAt ? `Updated ${formatTimestamp(row.updatedAt)}` : undefined,
  });
}

function formatRunSourcePrimary(row: TaskRunRow): string {
  const sourceType = String(row.sourceType ?? '').toLowerCase();
  switch (sourceType) {
    case 'scheduled':
      return 'On schedule';
    case 'triggered':
      return row.sourceMedium
        ? `Triggered by ${humanizeTaskLabel(row.sourceMedium)}`
        : 'Triggered by an event';
    case 'explicit':
      return 'Started on demand';
    case 'queue':
      return 'Started from the queue';
    default:
      return humanizeTaskLabel(row.sourceType);
  }
}

function formatRunSourceSecondary(row: TaskRunRow): string | undefined {
  const contact = isPresent(row.sourceContactDisplayName)
    ? String(row.sourceContactDisplayName)
    : null;
  const medium = isPresent(row.sourceMedium) ? humanizeTaskLabel(row.sourceMedium) : null;
  const sourceType = String(row.sourceType ?? '').toLowerCase();

  if (sourceType === 'triggered') return contact ?? undefined;
  if (sourceType === 'scheduled') {
    return (
      medium ??
      (row.scheduledFor ? `Scheduled for ${formatTimestamp(row.scheduledFor)}` : undefined)
    );
  }
  return contact ?? medium ?? undefined;
}

function formatRunSourceCell(row: TaskRunRow): React.ReactNode {
  return stackedCell({
    primary: formatRunSourcePrimary(row),
    secondary: formatRunSourceSecondary(row),
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
  accessorCell<TaskRow>('triggerType', 'Type', (row) => formatTaskStartContext(row), 240),
  accessorCell<TaskRow>('nextDueAt', 'Timing', (row) => formatTaskTimingCell(row), 220),
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
      }),
    280
  ),
  accessorCell<TaskRunRow>('state', 'State', (_row, value) => taskStateBadge(value), 120),
  accessorCell<TaskRunRow>('sourceType', 'Why It Started', (row) => formatRunSourceCell(row), 260),
  accessorCell<TaskRunRow>('startedAt', 'Timing', (row) => formatRunTimingCell(row), 260),
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
    case 'Tasks':
      return TASK_COLUMNS;
    case 'Activity':
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
  return (
    isPresent(row.runKey) ||
    isPresent(row.runId) ||
    isPresent(row.sourceType) ||
    isPresent(row.startedAt) ||
    isPresent(row.completedAt)
  );
}

export function buildTaskDetailSections(row: Record<string, unknown>): DetailSection[] {
  const sections: DetailSection[] = [];
  const addSection = (title: string, definitions: Array<[string, string, unknown]>) => {
    const items: DetailSectionItem[] = [];
    definitions.forEach(([key, label, value]) => {
      if (!isPresent(value)) return;
      detailItem(items, key, label, value);
    });
    const section = detailSection(title, items);
    if (section) sections.push(section);
  };

  if (isTaskRunRow(row)) {
    const taskRunRow = row as Record<string, unknown> & TaskRunRow;
    addSection('Task', [
      ['taskName', 'Task', row.taskName],
      ['taskDescription', 'Description', row.taskDescription],
      ['state', 'Status', isPresent(row.state) ? humanizeTaskLabel(row.state) : undefined],
    ]);
    addSection('Started by', [
      ['sourceType', 'How it started', formatRunSourcePrimary(taskRunRow)],
      ['sourceContactDisplayName', 'Contact', row.sourceContactDisplayName],
      [
        'sourceMedium',
        'Channel',
        isPresent(row.sourceMedium) ? humanizeTaskLabel(row.sourceMedium) : undefined,
      ],
    ]);
    addSection('Timing', [
      ['scheduledFor', 'Scheduled for', row.scheduledFor],
      ['startedAt', 'Started at', row.startedAt],
      ['completedAt', 'Completed at', row.completedAt],
    ]);
  } else {
    const taskRow = row as Record<string, unknown> & TaskRow;
    const triggerMedium = readTaskTriggerMedium(taskRow);
    addSection('Task', [
      ['name', 'Task', row.name],
      ['description', 'Description', row.description],
      ['status', 'Status', isPresent(row.status) ? humanizeTaskLabel(row.status) : undefined],
    ]);
    addSection('Type', [
      ['taskStartMode', 'Type', formatTaskStartLabel(taskRow)],
      ['taskRecurrence', 'Recurrence', formatTaskRecurrenceSummary(taskRow)],
      ['taskCadence', 'Cadence', formatTaskRecurrenceCadence(taskRow)],
      ['taskStartDetail', 'Behavior', formatTaskStartDetail(taskRow)],
      ['triggerMedium', 'Channel', triggerMedium ? humanizeTaskLabel(triggerMedium) : undefined],
      ['offline', 'Execution', isOfflineTask(taskRow) ? 'Runs in the background' : undefined],
      ['nextDueAt', 'Next due', readTaskDueAt(taskRow)],
    ]);
    addSection('Timing', [
      ['createdAt', 'Created at', row.createdAt],
      ['updatedAt', 'Updated at', row.updatedAt],
    ]);
  }

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
