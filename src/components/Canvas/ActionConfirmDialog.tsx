'use client';

/**
 * Confirmation for a canvas action, rendered outside the frame.
 *
 * This is the one piece of canvas UI a canvas must not be able to draw. Inside
 * the frame it could be styled to look like anything, pre-dismissed, or skipped
 * entirely — so the pause that protects an irreversible action would be under the
 * control of the thing being confirmed.
 *
 * It shows the **actual arguments** being submitted rather than a summary the
 * canvas supplied. A mislabelled button is the sharpest residual risk in the whole
 * design (the label is authored by the assistant), and rendering the real payload
 * is what lets a viewer notice that "notify the team" is about to email two
 * hundred people.
 */

import * as React from 'react';

import { Button } from '@/components/UI/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';

export interface PendingCanvasAction {
  actionName: string;
  label: string;
  /** Copy the action was declared with. */
  confirm?: string | null;
  destructive: boolean;
  args: Record<string, unknown>;
}

export interface ActionConfirmDialogProps {
  pending: PendingCanvasAction | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** How many entries of a long list to show before summarising the remainder. */
const MAX_LISTED = 12;

/**
 * Render one argument in a form a person can check.
 *
 * A long list is truncated with a count rather than scrolled, because the number
 * is the part that matters for consent — "and 188 more" is the disclosure, not the
 * individual addresses.
 */
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
  if (typeof value === 'object') {
    return <code className="text-body">{JSON.stringify(value)}</code>;
  }
  const text = String(value);
  // Long free text is clipped: the dialog is for checking a decision, not reading
  // the whole message body.
  return <span>{text.length > 300 ? `${text.slice(0, 300)}…` : text}</span>;
}

export function ActionConfirmDialog({ pending, onConfirm, onCancel }: ActionConfirmDialogProps) {
  const entries = Object.entries(pending?.args ?? {});

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{pending?.label ?? 'Confirm'}</DialogTitle>
          {pending?.confirm ? <DialogDescription>{pending.confirm}</DialogDescription> : null}
        </DialogHeader>

        {entries.length ? (
          <dl className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
            {entries.map(([name, value]) => (
              <div key={name} className="text-body grid grid-cols-[8rem_1fr] gap-2">
                <dt className="text-muted-foreground">{name}</dt>
                <dd className="break-words">
                  <ArgumentValue value={value} />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-body text-muted-foreground">This action takes no input.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={pending?.destructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            // Focus starts on Cancel, so a stray Enter dismisses rather than
            // confirms. For an irreversible action that asymmetry is the point.
            autoFocus={false}
          >
            {pending?.destructive ? 'Yes, do it' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
