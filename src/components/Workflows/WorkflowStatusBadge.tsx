'use client';

import { AlertTriangle, CheckCircle2, Loader2, Plug } from 'lucide-react';
import { Badge } from '@/components/UI/badge';
import { cn } from '@/lib/utils';
import type { WorkflowCardState } from '@/types/workflows';

/**
 * Mirrors IntegrationStatusBadge so the two shelves read as one system.
 *
 * Note the deliberate tone choice: `pending_requirements` is WARNING, never ERROR.
 * Installing before connecting is the correct, safe outcome — the jobs are planted
 * and disarmed. Only `partial` (something actually failed to land) is red.
 */
const STATE_LABEL: Record<WorkflowCardState, string> = {
  available: 'Available',
  ['pending_requirements']: 'Needs connection',
  ['provisioning']: 'Setting up',
  active: 'Active',
  partial: 'Partial',
  uninstalling: 'Removing',
};

const STATE_TONE: Record<WorkflowCardState, string> = {
  available: 'text-muted-foreground bg-muted/40',
  ['pending_requirements']:
    'text-[color:var(--status-warning)] bg-[color:var(--status-warning-bg)]',
  ['provisioning']: 'text-[color:var(--status-info)] bg-[color:var(--status-info-bg)]',
  active: 'text-[color:var(--status-success)] bg-[color:var(--status-success-bg)]',
  partial: 'text-destructive bg-[color:var(--status-danger-bg)]',
  uninstalling: 'text-muted-foreground bg-muted/40',
};

function StateIcon({ state }: { state: WorkflowCardState }) {
  if (state === 'active') return <CheckCircle2 className="h-3 w-3" />;
  if (state === 'pending_requirements') return <Plug className="h-3 w-3" />;
  if (state === 'provisioning' || state === 'uninstalling')
    return <Loader2 className="h-3 w-3 animate-spin" />;
  if (state === 'partial') return <AlertTriangle className="h-3 w-3" />;
  // Available is the absence of state — a bare word, not a glyph. A "+"
  // here read as a click-to-add control, which the chip is not.
  return null;
}

export function workflowStateLabel(state: WorkflowCardState): string {
  return STATE_LABEL[state];
}

export function WorkflowStatusBadge({
  state,
  className,
}: {
  state: WorkflowCardState;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 rounded-full border-transparent text-[10px] uppercase tracking-wide',
        STATE_TONE[state],
        className
      )}
      data-testid={`workflow-status-${state}`}
    >
      <StateIcon state={state} />
      {STATE_LABEL[state]}
    </Badge>
  );
}

/** Team installs have a wider blast radius — they must look different everywhere. */
export function WorkflowDestinationBadge({
  teamName,
  memberCount,
}: {
  teamName: string;
  memberCount?: number;
}) {
  return (
    <Badge
      variant="outline"
      className="gap-1 rounded-full border-transparent bg-[color-mix(in_srgb,var(--role-purple)_13%,transparent)] text-[10px] uppercase tracking-wide text-[color:var(--role-purple)]"
      data-testid="workflow-destination-team"
    >
      {teamName}
      {memberCount ? ` · ${memberCount}` : null}
    </Badge>
  );
}

export function WorkflowUpdateBadge({ version }: { version: string }) {
  return (
    <Badge
      variant="outline"
      className="gap-1 rounded-full border-transparent bg-[color:var(--status-info-bg)] text-[10px] uppercase tracking-wide text-[color:var(--status-info)]"
      data-testid="workflow-update-available"
    >
      v{version} available
    </Badge>
  );
}
