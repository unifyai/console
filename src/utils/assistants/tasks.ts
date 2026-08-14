/**
 * Column definitions and formatting utilities for the Tasks tab.
 *
 * Extracted from brain.ts to give Tasks its own dedicated tab
 * with task-specific rendering, status badges, and detail sections.
 */

import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import { truncate, isPresent, formatTimestamp } from '@/utils/assistants/brain';
import type {
  TaskBrainView,
  TaskRow,
  TaskScheduleRow,
  TaskTriggerRow,
  TaskRepeatPatternRow,
  TaskRunRow,
} from '@/types/assistants/brain';
import type { DetailSection, DetailSectionItem } from '@/utils/assistants/brain';

const BADGE_BASE_CLASS =
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-[0.01em]';
const BADGE_FALLBACK_CLASS = 'border-border/70 bg-muted/70 text-foreground';
export const TASK_LIVE_DOT_CLASS =
  'animate-pulse motion-reduce:animate-none bg-[color:var(--status-success)] shadow-[0_0_0_3px_var(--status-success-bg)]';

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
  ['active', 'Active'],
  ['running', 'Running'],
  ['completed', 'Completed'],
  ['failed', 'Failed'],
  ['cancelled', 'Cancelled'],
  ['pending', 'Pending'],
  ['triggerable', 'Ready'],
  ['manual', 'On demand'],
]);

const TASK_STATUS_DESCRIPTIONS = new Map<string, string>([
  ['scheduled', 'Is armed and will start automatically at its next occurrence.'],
  ['triggerable', 'Is armed and waiting for a matching event to happen.'],
  ['ready', 'Is armed and waiting for a matching event to happen.'],
  ['running', 'Has a run in flight right now.'],
  ['completed', 'Was a one-off and has already run.'],
  ['disarmed', 'Is paused and will not start until it is re-armed.'],
]);

const TASK_WAITING_TONE =
  'border-[color:var(--status-success)]/25 bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]';
const TASK_LIVE_TONE =
  'border-[color:var(--status-success)]/35 bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]';
const TASK_SUCCESS_TONE =
  'border-[color:var(--status-success)]/25 bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]';
const TASK_ATTENTION_TONE =
  'border-[color:var(--status-warning)]/25 bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning)]';
const TASK_FAILURE_TONE =
  'border-[color:var(--status-danger)]/25 bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger)]';
const TASK_INACTIVE_TONE =
  'border-border bg-[color:var(--status-neutral-bg)] text-muted-foreground';

const TASK_STATUS_TONES: Record<string, string> = {
  scheduled: TASK_WAITING_TONE,
  triggerable: TASK_WAITING_TONE,
  ready: TASK_WAITING_TONE,
  disarmed: TASK_INACTIVE_TONE,
  running: TASK_LIVE_TONE,
  completed: TASK_SUCCESS_TONE,
  failed: TASK_FAILURE_TONE,
  cancelled: TASK_INACTIVE_TONE,
};

const STACKED_PRIMARY_TEXT_CLASS = 'truncate font-medium text-foreground';
const STACKED_SECONDARY_TEXT_CLASS = 'truncate text-[11px] text-muted-foreground';
const STACKED_TERTIARY_TEXT_CLASS = 'truncate text-[11px] text-muted-foreground/80';

const WEEKDAY_LABELS = new Map<string, string>([
  ['MO', 'Mon'],
  ['TU', 'Tue'],
  ['WE', 'Wed'],
  ['TH', 'Thu'],
  ['FR', 'Fri'],
  ['SA', 'Sat'],
  ['SU', 'Sun'],
]);

type TaskStartMode = 'scheduled' | 'triggered' | 'offline' | 'on_demand';

// ── Helpers ──────────────────────────────────────────────────────────

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

/**
 * Whether anything starts this task by the clock.
 *
 * `schedule` holds a single start time, so a task that recurs states its
 * cadence in `repeat` and has no start time to hold: a weekly briefing
 * carries repeat patterns and no schedule at all. Reading `schedule` alone
 * made every such definition look like it had no timing.
 */
function hasStandingSchedule(row: TaskRow): boolean {
  return hasTaskSchedule(row) || readTaskRepeatPatterns(row).length > 0;
}

function resolveTaskStartMode(row: TaskRow): TaskStartMode {
  if (isOfflineTask(row)) return 'offline';
  if (hasTaskTrigger(row)) return 'triggered';
  if (hasStandingSchedule(row)) return 'scheduled';
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
      if (hasStandingSchedule(row)) return 'Runs in the background on a schedule';
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

// ── Display cells ────────────────────────────────────────────────────

function displayCell(
  label: React.ReactNode,
  toneClass: string,
  dotClassName?: string,
  dotTestId?: string,
  tooltipText?: string
): React.ReactNode {
  const children: React.ReactNode[] = [];
  if (dotClassName) {
    children.push(
      React.createElement('span', {
        key: 'dot',
        className: cn('h-1.5 w-1.5 rounded-full', dotClassName),
        'data-testid': dotTestId,
      })
    );
  }
  children.push(React.createElement('span', { key: 'label' }, label));
  const badge = React.createElement(
    'span',
    {
      className: cn(BADGE_BASE_CLASS, toneClass, tooltipText && 'cursor-help'),
    },
    children
  );
  if (!tooltipText) return badge;
  const TooltipProviderComponent = TooltipProvider as React.JSXElementConstructor<
    React.PropsWithChildren<{ delayDuration?: number }>
  >;
  return React.createElement(
    TooltipProviderComponent,
    { delayDuration: 100 },
    React.createElement(
      Tooltip,
      null,
      React.createElement(TooltipTrigger, { asChild: true }, badge),
      React.createElement(
        TooltipContent,
        { side: 'top', className: 'max-w-xs p-2 text-caption' },
        tooltipText
      )
    )
  );
}

function badgeTone(
  value: string,
  tones: Record<string, string>,
  fallback = BADGE_FALLBACK_CLASS
): string {
  return tones[value.toLowerCase()] ?? fallback;
}

function describeTaskStatus(value: string): string | undefined {
  return TASK_STATUS_DESCRIPTIONS.get(value.toLowerCase());
}

export function taskStatusBadge(
  value: unknown,
  opts?: {
    showRunningDot?: boolean;
    dotTestId?: string;
  }
): React.ReactNode {
  if (!isPresent(value)) return '—';
  const raw = String(value);
  const isRunning = Boolean(opts?.showRunningDot) && raw.toLowerCase() === 'running';
  return displayCell(
    humanizeTaskLabel(raw),
    badgeTone(raw, TASK_STATUS_TONES),
    isRunning ? TASK_LIVE_DOT_CLASS : undefined,
    isRunning ? opts?.dotTestId : undefined,
    describeTaskStatus(raw)
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
  return React.createElement('div', { className: 'min-w-0 space-y-0.5 leading-4' }, children);
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

// ── Column identity / start / timing helpers ─────────────────────────

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
  const lastRunAt = typeof row.lastRunAt === 'string' ? row.lastRunAt : null;
  const lastOutcome = typeof row.lastRunOutcome === 'string' ? row.lastRunOutcome : null;
  return stackedCell({
    primary: dueAt ? `Next due ${formatTimestamp(dueAt)}` : 'No run scheduled',
    // The one thing this column was never able to say. `nextDueAt` and
    // `lastRunAt` are both joined from the execution ledger before the row
    // gets here; the definition carries neither.
    secondary: lastRunAt
      ? `Last ${humanizeTaskLabel(lastOutcome ?? 'completed').toLowerCase()} ${formatTimestamp(lastRunAt)}`
      : 'Never run',
    tertiary: row.updatedAt ? `Updated ${formatTimestamp(row.updatedAt)}` : undefined,
  });
}

function formatRunSourcePrimary(row: TaskRunRow): string {
  const wake = String(row.wake ?? row.sourceType ?? '').toLowerCase();
  switch (wake) {
    case 'scheduled':
      return 'On schedule';
    case 'triggered':
      return row.sourceMedium
        ? `Triggered by ${humanizeTaskLabel(row.sourceMedium)}`
        : 'Triggered by an event';
    case 'explicit':
      return 'Started on demand';
    default:
      return humanizeTaskLabel(row.wake ?? row.sourceType);
  }
}

function formatRunSourceSecondary(row: TaskRunRow): string | undefined {
  const contact = isPresent(row.sourceContactDisplayName)
    ? String(row.sourceContactDisplayName)
    : null;
  const medium = isPresent(row.sourceMedium) ? humanizeTaskLabel(row.sourceMedium) : null;
  const wake = String(row.wake ?? row.sourceType ?? '').toLowerCase();

  if (wake === 'triggered') return contact ?? undefined;
  if (wake === 'scheduled') {
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

// ── Column definitions ───────────────────────────────────────────────

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
  // `lifecycle`, not `status`. The definition schema dropped `status`
  // deliberately — every concurrent run wrote it and the last writer won — so
  // this read an absent field, typechecking only through the row's index
  // signature, and rendered an em dash for every task ever since. Lifecycle
  // is joined from the run ledger before rows reach the table.
  accessorCell<TaskRow>('lifecycle', 'Status', (_row, value) => taskStatusBadge(value), 120),
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
  accessorCell<TaskRunRow>(
    'state',
    'State',
    (_row, value) =>
      taskStatusBadge(value, {
        showRunningDot: true,
        dotTestId: 'brain-running-state-indicator',
      }),
    120
  ),
  accessorCell<TaskRunRow>('wake', 'Why It Started', (row) => formatRunSourceCell(row), 260),
  accessorCell<TaskRunRow>('startedAt', 'Timing', (row) => formatRunTimingCell(row), 260),
];

export function getColumnsForTaskView(view: TaskBrainView, _fields?: string[]) {
  switch (view) {
    case 'Tasks':
      return TASK_COLUMNS;
    case 'Activity':
      return TASK_RUN_COLUMNS;
  }
}

// ── Detail sections ──────────────────────────────────────────────────

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
    isPresent(row.wake) ||
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
      ['wake', 'How it started', formatRunSourcePrimary(taskRunRow)],
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
      [
        'lifecycle',
        'Status',
        isPresent(row.lifecycle) ? humanizeTaskLabel(row.lifecycle) : undefined,
      ],
      [
        'priority',
        'Priority',
        isPresent(row.priority) ? humanizeTaskLabel(row.priority) : undefined,
      ],
    ]);
    addSection('Type', [
      ['taskStartMode', 'Type', formatTaskStartLabel(taskRow)],
      ['taskRecurrence', 'Recurrence', formatTaskRecurrenceSummary(taskRow)],
      ['taskCadence', 'Cadence', formatTaskRecurrenceCadence(taskRow)],
      ['taskStartDetail', 'Behavior', formatTaskStartDetail(taskRow)],
      ['triggerMedium', 'Channel', triggerMedium ? humanizeTaskLabel(triggerMedium) : undefined],
      [
        'offline',
        'Execution',
        isOfflineTask(taskRow)
          ? 'Runs in the background'
          : isPresent(row.entrypoint)
            ? 'Runs a saved function'
            : undefined,
      ],
      ['nextDue', 'Next due', readTaskDueAt(taskRow)],
    ]);
    addSection('Timing', [
      [
        'deadline',
        'Deadline',
        isPresent(row.deadline) ? formatTimestamp(String(row.deadline)) : undefined,
      ],
      ['createdAt', 'Created at', row.createdAt],
      ['updatedAt', 'Updated at', row.updatedAt],
    ]);
    addSection('Outcome', [['info', 'Summary', row.info]]);
  }

  return sections;
}

// ── Task card / run-history formatting (expandable Tasks view) ────────

export interface TaskCardField {
  label: string;
  value: string;
  mono?: boolean;
}

/** The human-facing "Type" label for a task (Scheduled / Triggered / …). */
export function getTaskTypeLabel(row: TaskRow): string {
  return formatTaskStartLabel(row);
}

/** Lifecycles that read as not-armed for the All/Active/Paused filter. */
const PAUSED_TASK_STATUSES = new Set(['disarmed', 'completed']);

export function isPausedTaskStatus(status: unknown): boolean {
  if (!isPresent(status)) return false;
  return PAUSED_TASK_STATUSES.has(String(status).trim().toLowerCase());
}

/** The open scheduled head's due time, if the runs include one. */
function scheduledHeadFor(runs: TaskRunRow[] | undefined): string | null {
  if (!runs?.length) return null;
  const heads = runs
    .filter((run) => run.state === 'scheduled' && typeof run.scheduledFor === 'string')
    .map((run) => run.scheduledFor as string)
    .sort();
  return heads[0] ?? null;
}

/** Six labelled fields shown in the open task card's left column. */
export function getTaskCardFields(row: TaskRow, runs?: TaskRunRow[]): TaskCardField[] {
  const record = asRecord(row);
  const triggerMedium = readTaskTriggerMedium(row);
  const trigger = triggerMedium
    ? humanizeTaskLabel(triggerMedium)
    : resolveTaskStartMode(row) === 'triggered'
      ? 'On event'
      : '—';

  // Cadence is always derived from the task's repeat patterns / recurring
  // trigger — the scheduler model has no flat cadence column.
  const cadence = formatTaskRecurrenceCadence(row) ?? '—';

  const startCandidate =
    readFirstPresentValue(readTaskSchedule(row), ['startAt', 'start_at']) ?? row.createdAt;
  // A repeat-only series has no start time on its definition: the next run
  // lives on the projected open execution, so read the head when the
  // definition itself names nothing.
  const nextDue = readTaskDueAt(row) ?? scheduledHeadFor(runs);
  const priorityValue = readFirstPresentValue(record, ['priority']);

  return [
    { label: 'Type', value: getTaskTypeLabel(row) },
    { label: 'Trigger', value: trigger },
    { label: 'Cadence', value: cadence },
    {
      label: 'Start',
      value: isPresent(startCandidate) ? formatTimestamp(String(startCandidate)) : '—',
      mono: true,
    },
    { label: 'Next run', value: nextDue ? formatTimestamp(nextDue) : '—', mono: true },
    {
      label: 'Priority',
      value: isPresent(priorityValue) ? humanizeTaskLabel(priorityValue) : '—',
    },
  ];
}

/** Plain-language reason a run started ("On schedule", "Triggered by …"). */
export function getRunWhyLabel(row: TaskRunRow): string {
  return formatRunSourcePrimary(row);
}

/** Wall-clock duration between a run's start and finish, e.g. "2m 3s". */
export function formatRunDuration(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined
): string {
  if (!isPresent(startedAt) || !isPresent(completedAt)) return '—';
  const start = new Date(String(startedAt)).getTime();
  const end = new Date(String(completedAt)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—';

  const totalSeconds = Math.round((end - start) / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

export interface RunHistoryCells {
  whyLabel: string;
  startedLabel: string;
  finishedLabel: string;
  durationLabel: string;
}

/** Pre-formatted cell text for one row of the run-history table. */
export function getRunHistoryCells(row: TaskRunRow): RunHistoryCells {
  return {
    whyLabel: getRunWhyLabel(row),
    startedLabel: isPresent(row.startedAt) ? formatTimestamp(String(row.startedAt)) : '—',
    finishedLabel: isPresent(row.completedAt) ? formatTimestamp(String(row.completedAt)) : '—',
    durationLabel: formatRunDuration(row.startedAt, row.completedAt),
  };
}

/** Normalized tag list for one task: trimmed, deduped, order preserved. */
export function readTaskTags(row: TaskRow): string[] {
  const raw = row.tags;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const tag = value.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/** Every tag present across `rows`, sorted, with per-tag task counts. */
export function collectTaskTags(rows: TaskRow[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of readTaskTags(row)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Tri-state per tag, cycled neutral → include → exclude → neutral. */
export type TagFilterState = 'include' | 'exclude';

/**
 * GitHub-label filter semantics: a task must carry *every* included tag and
 * *none* of the excluded ones. With no included tags, untagged tasks pass;
 * any included tag naturally hides them (they cannot carry it).
 */
export function filterTasksByTags(
  rows: TaskRow[],
  filters: ReadonlyMap<string, TagFilterState>
): TaskRow[] {
  if (filters.size === 0) return rows;
  const included = [...filters.entries()].filter(([, s]) => s === 'include').map(([t]) => t);
  const excluded = new Set(
    [...filters.entries()].filter(([, s]) => s === 'exclude').map(([t]) => t)
  );
  return rows.filter((row) => {
    const tags = new Set(readTaskTags(row));
    if (included.some((tag) => !tags.has(tag))) return false;
    for (const tag of tags) {
      if (excluded.has(tag)) return false;
    }
    return true;
  });
}
