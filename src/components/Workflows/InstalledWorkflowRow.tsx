'use client';

import { AlertTriangle, Pause, Play, Plug, RefreshCw } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import { WorkflowTileIcon } from './WorkflowTileIcon';
import {
  WorkflowDestinationBadge,
  WorkflowStatusBadge,
  WorkflowUpdateBadge,
} from './WorkflowStatusBadge';
import { WorkflowAppIcon } from './WorkflowAppIcon';
import {
  workflowRequestCopy,
  type WorkflowRequestState,
} from '@/hooks/Workflows/useWorkflowCatalog';
import {
  hasUpdate,
  requirementIsConnectable,
  requirementNeedsWorkspace,
  unmetRequirements,
  type WorkflowGalleryItem,
} from '@/types/workflows';

/**
 * The returning-user surface. Deliberately a full-width row, not a card:
 * a user has 2–5 of these and comes back to ask "is it working, what runs next,
 * what needs me?" — which needs runtime detail and one inline action, not a pitch.
 *
 * Sort the list attention-first: partial → pending_requirements → provisioning → active.
 */
export function InstalledWorkflowRow({
  item,
  canMutate = true,
  onOpen,
  onConnect,
  onConnectWorkspace,
  onToggleSetup,
  onRetry,
  request,
}: {
  item: WorkflowGalleryItem;
  canMutate?: boolean;
  /** A recorded change the assistant is carrying out for this workflow. */
  request?: WorkflowRequestState;
  onOpen: (item: WorkflowGalleryItem) => void;
  onConnect: (canonicalSlug: string) => void;
  onConnectWorkspace?: () => void;
  onToggleSetup: (slug: string) => void;
  onRetry: (slug: string) => void;
}) {
  const { workflow, installation } = item;
  if (!installation) return null;
  const missing = unmetRequirements(workflow);
  const held = installation.status === 'pending_requirements';
  const partial = installation.status === 'partial';
  const nextTask = installation.tasks[0];
  // Only a route with a connect view of its own is fixed inline.
  const connectable = missing.find(requirementIsConnectable);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        onOpen(item);
      }}
      className={cn(
        // Below the tablet breakpoint the action cluster drops to its own line
        // rather than squeezing the name and runtime detail.
        'grid w-full grid-cols-[auto_1fr] items-center gap-3 rounded-xl border bg-card-2 p-3.5 text-left transition',
        'lg:grid-cols-[auto_1fr_auto] lg:gap-3.5 lg:p-4',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        held &&
          'border-[color-mix(in_srgb,var(--status-warning)_32%,var(--border))] bg-[color:var(--status-warning-bg)]',
        partial &&
          'border-[color-mix(in_srgb,var(--status-danger)_28%,var(--border))] bg-[color:var(--status-danger-bg)]'
      )}
      data-testid={`installed-workflow-${workflow.slug}`}
    >
      <WorkflowTileIcon iconId={workflow.iconId} category={workflow.category} />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">
            {workflow.name}
          </span>
          <WorkflowStatusBadge state={installation.status} />
          {installation.destination.kind === 'team' && (
            <WorkflowDestinationBadge
              teamName={installation.destination.teamName}
              memberCount={installation.destination.memberCount}
            />
          )}
          {hasUpdate(item) && <WorkflowUpdateBadge version={workflow.version} />}
        </div>

        {request && request.status !== 'succeeded' ? (
          // A change the assistant is carrying out outranks the derived
          // runtime line: until it settles, the row below it may not be true.
          <p
            className={cn(
              'text-caption mt-1 leading-relaxed',
              request.status === 'failed' && 'text-destructive'
            )}
            data-testid={`installed-workflow-request-${workflow.slug}`}
          >
            {workflowRequestCopy(request)}
          </p>
        ) : installation.status === 'provisioning' && installation.setup ? (
          <>
            <p className="text-caption mt-1">
              {installation.setup.label} —{' '}
              <span className="font-medium text-foreground">{installation.setup.detail}</span>
            </p>
            <div className="mt-2 flex items-center gap-2.5">
              <span className="h-1.5 w-full max-w-[340px] overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-[color:var(--status-info)] transition-[width] duration-500"
                  style={{ width: `${installation.setup.percent}%` }}
                />
              </span>
              <span className="text-caption whitespace-nowrap font-mono">
                {installation.setup.percent}% · {installation.setup.etaLabel}
              </span>
            </div>
          </>
        ) : (
          <p className="text-caption mt-1 leading-relaxed">
            {held && (
              <>
                <Plug className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
                Jobs planted and held until{' '}
                <span className="font-medium text-foreground">
                  {missing.map((requirement) => requirement.displayName).join(' & ')}
                </span>{' '}
                {missing.length > 1 ? 'are' : 'is'} connected
              </>
            )}
            {canMutate && partial && (
              <>
                <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />
                {installation.failures?.length} of the items it plants failed — the rest is running
              </>
            )}
            {installation.status === 'active' && nextTask && (
              <>
                <span className="font-medium text-foreground">{nextTask.name}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                next {nextTask.nextRunLabel}
                <span className="mx-2 text-muted-foreground">·</span>
                {nextTask.lastRunLabel}
              </>
            )}
          </p>
        )}
      </div>

      <div
        className="col-span-2 flex shrink-0 flex-wrap items-center gap-2 lg:col-span-1 lg:justify-end"
        onClick={(event) => event.stopPropagation()}
      >
        {held && connectable && (
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={() =>
              requirementNeedsWorkspace(connectable)
                ? onConnectWorkspace?.()
                : onConnect(connectable.canonicalSlug)
            }
          >
            <WorkflowAppIcon requirement={connectable} size="xs" />
            Connect {connectable.displayName}
          </Button>
        )}
        {canMutate && installation.status === 'provisioning' && installation.setup && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={() => onToggleSetup(workflow.slug)}
          >
            {installation.setup.paused ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
            {installation.setup.paused ? 'Resume' : 'Pause'}
          </Button>
        )}
        {canMutate && partial && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={() => onRetry(workflow.slug)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs"
          onClick={() => onOpen(item)}
        >
          Manage
        </Button>
      </div>
    </div>
  );
}
