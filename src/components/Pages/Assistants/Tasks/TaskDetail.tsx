'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRunHistoryCells, taskStatusBadge, type TaskCardField } from '@/utils/assistants/tasks';
import type { TaskRunRow } from '@/types/assistants/brain';

/**
 * The parts of a task's row that describe the task itself.
 *
 * Extracted from TasksPane so the Workflows drawer can preview a bundled task
 * with the same fields, labels and cadence line the Tasks tab shows — rather
 * than a second, thinner rendering of the same thing that drifts from it. Tasks
 * have no detail sheet of their own, so this *is* the view.
 *
 * Everything is presentational: values come from `getTaskCardFields` and
 * `getRunHistoryCells`, which already answer `—` for whatever is absent. That
 * matters for a pre-install preview, where there is genuinely no next run, no
 * armed state and no history.
 */

const RUN_COLUMNS = 'grid-cols-[1.1fr_1.1fr_1.2fr_1.2fr_0.7fr]';

/** The cadence line under a task's name. */
export function TaskMetaLine({
  cadence,
  nextRun,
  priority,
}: {
  cadence: string;
  nextRun: string;
  priority: string;
}) {
  return (
    <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
      <Clock className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {cadence} · next {nextRun} · {priority} priority
      </span>
    </div>
  );
}

/** TYPE / TRIGGER / CADENCE / START / NEXT RUN / PRIORITY. */
export function TaskFields({ fields, className }: { fields: TaskCardField[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-2.5', className)} data-testid="task-fields">
      {fields.map((field) => (
        <div key={field.label} className="flex flex-col gap-0.5">
          <dt className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
            {field.label}
          </dt>
          <dd
            className={cn(
              'text-[12.5px] font-semibold text-foreground',
              field.mono && 'font-mono font-medium'
            )}
          >
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A task's run history.
 *
 * `onRunClick` is optional so a preview can render the same table inert: before
 * an install there is nothing to inspect, and rows that look clickable but are
 * not is worse than rows that plainly are not.
 */
export function TaskRunHistory({
  runs,
  onRunClick,
}: {
  runs: TaskRunRow[];
  onRunClick?: (run: TaskRunRow) => void;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-overline">Run history · {runs.length}</span>
        {runs.length > 0 && onRunClick && (
          <span className="text-muted-foreground/70 text-[11px]">click a run to inspect</span>
        )}
      </div>
      {runs.length === 0 ? (
        <p className="text-caption text-muted-foreground">No runs recorded yet.</p>
      ) : (
        <div className="flex flex-col">
          <div className={cn(RUN_COLUMNS, 'text-overline grid gap-2.5 border-b pb-2')}>
            <span>State</span>
            <span>Why it started</span>
            <span>Started</span>
            <span>Finished</span>
            <span>Duration</span>
          </div>
          {runs.map((run, idx) => {
            const cells = getRunHistoryCells(run);
            const body = (
              <>
                <span>{taskStatusBadge(run.state, { showRunningDot: true })}</span>
                <span className="truncate text-muted-foreground">{cells.whyLabel}</span>
                <span className="truncate font-mono text-[11px]">{cells.startedLabel}</span>
                <span className="truncate font-mono text-[11px]">{cells.finishedLabel}</span>
                <span className="font-mono text-[11px]">{cells.durationLabel}</span>
              </>
            );
            const rowClass = cn(
              RUN_COLUMNS,
              'grid items-center gap-2.5 border-b py-2 text-left text-xs last:border-b-0'
            );
            return onRunClick ? (
              <button
                key={idx}
                type="button"
                onClick={() => onRunClick(run)}
                className={cn(rowClass, 'hover:bg-muted/40')}
                data-testid="task-run-row"
              >
                {body}
              </button>
            ) : (
              <div key={idx} className={rowClass} data-testid="task-run-row">
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
