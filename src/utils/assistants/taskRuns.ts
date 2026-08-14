/**
 * What a task has actually done, derived from its execution rows.
 *
 * Task definitions carry authored intent only — a schedule, a trigger, an
 * armed flag — by explicit backend design: run state lives on
 * `Tasks/Executions` so that concurrent runs cannot fight over one shared
 * row. Every "when did this last run / when does it run next / did it work"
 * field a view wants therefore has to be joined, and reading it off the
 * definition returns undefined however reasonable the field name looks.
 *
 * Both the Tasks tab and the Workflows tab were doing exactly that, against
 * different invented names, which is why one showed `—` for every status and
 * the other read `Never run` for a workflow that had run all week.
 */

import type { TaskRow, TaskRunRow } from '@/types/assistants/brain';

/** Execution states that mean the run is over, in the ledger's vocabulary. */
const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled']);

export interface TaskRunSummary {
  /** The next occurrence still ahead, when one is armed. */
  nextRunAt: string | null;
  /** When the most recent finished run ended. */
  lastRunAt: string | null;
  /** How that run ended: `completed`, `failed`, `cancelled`. */
  lastRunOutcome: string | null;
  /** Why it failed, when it did. */
  lastRunError: string | null;
  /** What the task is doing now, in the same words the backend derives. */
  lifecycle: string | null;
}

const EMPTY: TaskRunSummary = {
  nextRunAt: null,
  lastRunAt: null,
  lastRunOutcome: null,
  lastRunError: null,
  lifecycle: null,
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** The moment a run belongs to: its due time, or when it actually began. */
function runMoment(run: TaskRunRow): string | null {
  return asString(run.completedAt) ?? asString(run.startedAt) ?? asString(run.scheduledFor);
}

/**
 * Bucket execution rows by the task they belong to.
 *
 * The executions context is global to the assistant, so every view that wants
 * per-task facts starts here.
 */
export function groupRunsByTask(runs: TaskRunRow[]): Map<number, TaskRunRow[]> {
  const byTask = new Map<number, TaskRunRow[]>();
  for (const run of runs) {
    if (typeof run.taskId !== 'number') continue;
    const bucket = byTask.get(run.taskId);
    if (bucket) bucket.push(run);
    else byTask.set(run.taskId, [run]);
  }
  return byTask;
}

/**
 * Reduce one task's runs to the facts a row wants to show.
 *
 * `lifecycle` mirrors what Orchestra derives on its typed Tasks API, which
 * Console does not call: a run in flight outranks everything, because pausing
 * a task stops the next wake and does not retroactively stop one already
 * going.
 */
export function summariseTaskRuns(
  runs: TaskRunRow[] | undefined,
  options?: { enabled?: boolean | null }
): TaskRunSummary {
  if (!runs?.length) {
    return { ...EMPTY, lifecycle: options?.enabled === false ? 'disarmed' : null };
  }

  const scheduled = runs
    .filter((run) => asString(run.state) === 'scheduled' && asString(run.scheduledFor))
    .sort((a, b) => String(a.scheduledFor).localeCompare(String(b.scheduledFor)));

  const finished = runs
    .filter((run) => TERMINAL_STATES.has(String(run.state ?? '')))
    .sort((a, b) => String(runMoment(b) ?? '').localeCompare(String(runMoment(a) ?? '')));

  const running = runs.some((run) => asString(run.state) === 'running');
  const latest = finished[0];

  return {
    nextRunAt: scheduled.length ? String(scheduled[0].scheduledFor) : null,
    lastRunAt: latest ? runMoment(latest) : null,
    lastRunOutcome: latest ? asString(latest.state) : null,
    lastRunError: latest ? asString(latest.error) : null,
    lifecycle: running
      ? 'running'
      : options?.enabled === false
        ? 'disarmed'
        : scheduled.length
          ? 'scheduled'
          : null,
  };
}

/**
 * Attach a task's run facts to its row so a column can render them.
 *
 * Written onto the row rather than threaded through every cell because the
 * table renders from `TaskRow` accessors, and the alternative is passing a
 * lookup into each one.
 */
export function withRunSummary(row: TaskRow, runs: TaskRunRow[] | undefined): TaskRow {
  const summary = summariseTaskRuns(runs, { enabled: row.enabled });
  return {
    ...row,
    lifecycle: summary.lifecycle ?? row.lifecycle,
    nextDueAt: summary.nextRunAt ?? row.nextDueAt,
    lastRunAt: summary.lastRunAt,
    lastRunOutcome: summary.lastRunOutcome,
    lastRunError: summary.lastRunError,
  };
}
