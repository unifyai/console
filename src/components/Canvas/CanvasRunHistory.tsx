'use client';

/**
 * A canvas's run history, drawn in console chrome.
 *
 * This is deliberately not a kit component the actor opts into. Run metadata is the
 * sharpest thing a prompt-injected canvas could misrepresent: it could omit the
 * history entirely, restyle it, or show one success beside a control that failed
 * nine times. Rendering it here means it is always present, identical on every
 * surface, and sourced from the stored rows rather than from anything the canvas
 * said about itself — the same reasoning that puts the confirmation dialog outside
 * the frame.
 *
 * It shows the **actual arguments** each run was submitted with, for the same reason
 * the confirmation dialog does: that is what lets someone notice after the fact that
 * "notify the team" emailed two hundred people.
 */

import * as React from 'react';
import { History } from 'lucide-react';

import { Button } from '@/components/UI/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { cn } from '@/lib/utils';

/** One past run, as `/api/canvas/[token]/runs` returns it. */
export interface CanvasRun {
  invocationId: number;
  actionName: string;
  status: string;
  args: Record<string, unknown>;
  error: string | null;
  requestedByUserId: string | null;
  createdAt: string | null;
  finishedAt: string | null;
}

/** How many entries of a long argument list to show before summarising the rest. */
const MAX_LISTED = 8;

function statusTone(status: string): string {
  if (status === 'succeeded') return 'text-success';
  if (status === 'failed' || status === 'cancelled') return 'text-destructive';
  return 'text-muted-foreground';
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

/** How long the run took, when both ends are known. */
function formatDuration(run: CanvasRun): string | null {
  if (!run.createdAt || !run.finishedAt) return null;
  const started = new Date(run.createdAt).getTime();
  const finished = new Date(run.finishedAt).getTime();
  if (Number.isNaN(started) || Number.isNaN(finished) || finished < started) return null;
  const seconds = Math.round((finished - started) / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function ArgumentValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    const shown = value.slice(0, MAX_LISTED);
    return (
      <span>
        {shown.map((entry) => String(entry)).join(', ')}
        {value.length > shown.length ? (
          <span className="text-muted-foreground">{` and ${value.length - shown.length} more`}</span>
        ) : null}
        <span className="text-muted-foreground">{` (${value.length})`}</span>
      </span>
    );
  }
  if (typeof value === 'boolean') return <span>{value ? 'yes' : 'no'}</span>;
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>;
  if (typeof value === 'object') return <code className="text-body">{JSON.stringify(value)}</code>;
  const text = String(value);
  return <span>{text.length > 200 ? `${text.slice(0, 200)}…` : text}</span>;
}

function RunRow({ run }: { run: CanvasRun }) {
  const duration = formatDuration(run);
  const args = Object.entries(run.args);

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-title truncate text-foreground">{run.actionName || 'Action'}</span>
        <span className={cn('text-caption shrink-0', statusTone(run.status))}>{run.status}</span>
      </div>

      <div className="text-caption flex flex-wrap gap-x-3 text-muted-foreground">
        <span>{formatWhen(run.createdAt)}</span>
        {duration ? <span>took {duration}</span> : null}
        {/* Auto-counted ids are 0-based, so run 0 is a real run and must render. */}
        <span>run #{run.invocationId}</span>
      </div>

      {args.length ? (
        <dl className="flex flex-col gap-1">
          {args.map(([name, value]) => (
            <div key={name} className="text-body grid grid-cols-[7rem_1fr] gap-2">
              <dt className="truncate text-muted-foreground">{name}</dt>
              <dd className="break-words">
                <ArgumentValue value={value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-caption text-muted-foreground">No input.</p>
      )}

      {run.error ? <p className="text-body text-destructive">{run.error}</p> : null}
    </li>
  );
}

export interface CanvasRunHistoryProps {
  token: string;
  /**
   * Changes whenever a run is started or settles, so an open panel reflects it
   * without the viewer reopening it.
   */
  revision?: number | string;
  className?: string;
}

export function CanvasRunHistory({ token, revision = 0, className }: CanvasRunHistoryProps) {
  const [open, setOpen] = React.useState(false);
  const [runs, setRuns] = React.useState<CanvasRun[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Fetched only while the panel is open. A canvas nobody asks about should not be
  // reading its own history on every mount.
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`/api/canvas/${encodeURIComponent(token)}/runs`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('This history could not be loaded.');
        const body = (await response.json()) as { runs?: CanvasRun[] };
        setRuns(body.runs ?? []);
        setError(null);
      } catch {
        if (!controller.signal.aborted) setError('This history could not be loaded.');
      }
    })();

    return () => controller.abort();
  }, [open, token, revision]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn('gap-1.5', className)}
      >
        <History className="h-3.5 w-3.5" />
        Runs
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Action runs</DialogTitle>
            <DialogDescription>
              Every action this canvas has run, with the arguments it was given.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p className="text-body text-muted-foreground">{error}</p>
          ) : runs === null ? (
            <p className="text-body text-muted-foreground">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="text-body text-muted-foreground">
              Nothing has been run from this canvas yet.
            </p>
          ) : (
            <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
              {runs.map((run) => (
                <RunRow key={run.invocationId} run={run} />
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
