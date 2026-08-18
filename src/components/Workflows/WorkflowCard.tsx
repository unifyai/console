'use client';

import { AlertTriangle, Clock3, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Card, CardContent } from '@/components/UI/card';
import { cn } from '@/lib/utils';
import { WorkflowAppIconStack } from './WorkflowAppIcon';
import { WorkflowTileIcon } from './WorkflowTileIcon';
import { WorkflowDestinationBadge, WorkflowStatusBadge } from './WorkflowStatusBadge';
import { WORKFLOW_CATEGORY_LABEL, categoryStyle } from './workflowCategories';
import {
  workflowRequestCopy,
  type WorkflowRequestState,
} from '@/hooks/Workflows/useWorkflowCatalog';
import {
  recurringTasks,
  requirementIsConnectable,
  requirementNeedsWorkspace,
  unmetRequirements,
  workflowCardState,
  type WorkflowGalleryItem,
} from '@/types/workflows';

/**
 * Gallery card. Anatomy, top to bottom:
 *   tile icon + required-app logos · category kicker · name · description (3 lines)
 *   · state badge (+ team badge) · footer: one-line status note + primary action.
 *
 * The whole card opens the detail sheet; the footer button is the shortcut.
 * Mirrors ProviderIntegrationCard's proportions (min-height, hairline, hover lift)
 * so Workflows and Integrations read as the same shelf.
 */
export function WorkflowCard({
  item,
  busy,
  onOpen,
  onInstall,
  onConnect,
  onConnectWorkspace,
  request,
  isResolving = false,
}: {
  item: WorkflowGalleryItem;
  busy?: boolean;
  /** True until the integrations catalogue has answered for this card's apps. */
  isResolving?: boolean;
  /** A recorded change the assistant is carrying out for this workflow. */
  request?: WorkflowRequestState;
  onOpen: (item: WorkflowGalleryItem) => void;
  onInstall: (item: WorkflowGalleryItem) => void;
  onConnect: (canonicalSlug: string) => void;
  onConnectWorkspace?: () => void;
}) {
  const { workflow, installation } = item;
  const state = workflowCardState(item);
  const missing = unmetRequirements(workflow);

  const note = () => {
    if (request && request.status !== 'succeeded') {
      return (
        <span
          className={cn('text-caption truncate', request.status === 'failed' && 'text-destructive')}
          data-testid={`workflow-card-request-${workflow.slug}`}
        >
          {workflowRequestCopy(request)}
        </span>
      );
    }
    if (!installation) {
      const count = recurringTasks(workflow).length;
      return (
        <span className="text-caption flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {count} recurring job{count === 1 ? '' : 's'}
        </span>
      );
    }
    if (installation.status === 'pending_requirements') {
      if (isResolving) {
        // Naming the apps it is waiting on states a verdict the catalogue
        // has not given yet, and the names change once it does.
        return <span className="bg-muted/50 block h-3 w-40 animate-pulse rounded" />;
      }
      return (
        <span className="text-caption truncate">
          Waiting on{' '}
          <span className="font-medium text-foreground">
            {missing.map((requirement) => requirement.displayName).join(', ')}
          </span>
        </span>
      );
    }
    if (installation.status === 'provisioning' && installation.setup) {
      return (
        <span className="text-caption flex items-center gap-1.5 truncate">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {installation.setup.percent}% — {installation.setup.label.toLowerCase()}
        </span>
      );
    }
    if (installation.status === 'partial') {
      const count = installation.failures?.length ?? 0;
      return (
        <span className="text-caption flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          {count} item{count === 1 ? '' : 's'} failed
        </span>
      );
    }
    const next = installation.tasks[0];
    return (
      <span className="text-caption flex items-center gap-1.5 truncate">
        <Clock3 className="h-3.5 w-3.5" />
        Next <span className="font-medium text-foreground">{next?.nextRunLabel}</span>
      </span>
    );
  };

  const action = () => {
    if (!installation) {
      return (
        <Button
          type="button"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onInstall(item);
          }}
          data-testid={`workflow-card-install-${workflow.slug}`}
        >
          Install
        </Button>
      );
    }
    if (installation.status === 'pending_requirements' && missing[0]) {
      // Only a route with a connect view of its own is fixed here — the
      // gallery drawer for an app, the workspace manager for a Workspace. A
      // secret-gated app needs a credential, so the card hands off to the
      // sheet rather than offering a click that would do nothing.
      const connectable = missing.find(requirementIsConnectable);
      if (!connectable) {
        return (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(item);
            }}
            data-testid={`workflow-card-secret-${workflow.slug}`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Add secrets
          </Button>
        );
      }
      return (
        <Button
          type="button"
          size="sm"
          className="hover:bg-[color:var(--status-warning)]/90 h-7 bg-[color:var(--status-warning)] px-2.5 text-xs text-primary-foreground"
          onClick={(event) => {
            event.stopPropagation();
            if (requirementNeedsWorkspace(connectable)) onConnectWorkspace?.();
            else onConnect(connectable.canonicalSlug);
          }}
          data-testid={`workflow-card-connect-${workflow.slug}`}
        >
          Connect {connectable.displayName}
        </Button>
      );
    }
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2.5 text-xs"
        onClick={(event) => {
          event.stopPropagation();
          onOpen(item);
        }}
      >
        Manage
      </Button>
    );
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      style={categoryStyle(workflow.category)}
      className={cn(
        'group relative min-h-[208px] cursor-pointer overflow-hidden shadow-sm transition',
        'hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--wf-cat)_45%,var(--border))] hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
      )}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(item);
      }}
      data-testid={`workflow-card-${workflow.slug}`}
    >
      <CardContent className="flex h-full flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2.5">
          <WorkflowTileIcon iconId={workflow.iconId} category={workflow.category} />
          <WorkflowAppIconStack requirements={workflow.requirements} isResolving={isResolving} />
        </div>

        <div>
          <div className="text-overline flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-[2px] bg-[color:var(--wf-cat)]"
              aria-hidden="true"
            />
            {WORKFLOW_CATEGORY_LABEL[workflow.category]}
          </div>
          <h3 className="mt-0.5 font-display text-[15.5px] font-semibold tracking-[-0.01em]">
            {workflow.name}
          </h3>
        </div>

        <p className="text-body-muted line-clamp-3 flex-1">{workflow.description}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          <WorkflowStatusBadge state={state} />
          {installation?.destination.kind === 'team' && (
            <WorkflowDestinationBadge teamName={installation.destination.teamName} />
          )}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 border-t pt-3">
          {note()}
          {action()}
        </div>
      </CardContent>
    </Card>
  );
}
