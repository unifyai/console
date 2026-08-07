'use client';

import * as React from 'react';
import { Check, Info, Sparkles } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/UI/sheet';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';

type NewTaskType = 'Recurring' | 'Scheduled' | 'Triggered' | 'Continuous';

const TYPE_OPTIONS: Array<{ type: NewTaskType; hint: string }> = [
  { type: 'Recurring', hint: 'Runs again and again on a fixed cadence.' },
  { type: 'Scheduled', hint: 'Runs once at a specific future time.' },
  { type: 'Triggered', hint: 'Runs whenever a matching event arrives.' },
  { type: 'Continuous', hint: 'Stays live in the background and reacts to changes.' },
];

interface NewTaskDrawerProps {
  open: boolean;
  onClose: () => void;
  /**
   * Persists the task. When omitted, the drawer surfaces a generic toast
   * and closes — the form stays visible so the surface matches the design,
   * but nothing is written (mock / read-only contexts).
   */
  onCreate?: (draft: { name: string; description: string; type: NewTaskType }) => void;
}

export function NewTaskDrawer({ open, onClose, onCreate }: NewTaskDrawerProps) {
  const [type, setType] = React.useState<NewTaskType>('Recurring');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setType('Recurring');
      setName('');
      setDescription('');
    }
  }, [open]);

  const showSchedule = type === 'Scheduled' || type === 'Recurring';

  const handleCreate = () => {
    onCreate?.({ name: name.trim(), description: description.trim(), type });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex flex-col" data-testid="new-task-drawer">
        <SheetHeader className="shrink-0">
          <SheetDescription className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent-soft-foreground">
            New task
          </SheetDescription>
          <SheetTitle>Create a task</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-task-name" className="text-title">
              Name
            </label>
            <input
              id="new-task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Morning inbox digest"
              className="h-9 w-full rounded-md border bg-card px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              data-testid="new-task-name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-task-desc" className="text-title">
              What should it do?
            </label>
            <textarea
              id="new-task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the workflow in plain English — your teammate turns it into runnable steps."
              className="w-full resize-none rounded-md border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              data-testid="new-task-description"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-title">Type</span>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map(({ type: option, hint }) => {
                const active = option === type;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setType(option)}
                    className={cn(
                      'flex flex-col gap-1.5 rounded-xl border bg-card p-3 text-left transition-colors',
                      active ? 'border-primary bg-accent-soft' : 'hover:border-ring'
                    )}
                    data-testid={`new-task-type-${option.toLowerCase()}`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-caption font-semibold text-foreground">{option}</span>
                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                    </span>
                    <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {showSchedule && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-title">{type === 'Recurring' ? 'Cadence' : 'Run at'}</span>
                <div className="text-body-muted flex h-9 items-center rounded-md border bg-card px-3">
                  {type === 'Recurring' ? 'Every 30 minutes' : 'Tomorrow, 08:00'}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-title">Timezone</span>
                <div className="text-body-muted flex h-9 items-center rounded-md border bg-card px-3">
                  UTC
                </div>
              </div>
            </div>
          )}

          {type === 'Triggered' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-title">Trigger</span>
              <div className="text-body-muted flex h-9 items-center rounded-md border bg-card px-3">
                Stripe: payout.paid
              </div>
            </div>
          )}

          {type === 'Continuous' && (
            <div className="bg-muted/40 text-caption flex items-start gap-2 rounded-lg border p-3 text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                A continuous task runs in the background and reacts to changes as they happen.
              </span>
            </div>
          )}
        </div>

        <SheetFooter className="mt-4 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="new-task-cancel">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!name.trim()}
            data-testid="new-task-create"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Create task
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
