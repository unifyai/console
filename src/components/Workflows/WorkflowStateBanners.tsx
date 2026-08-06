'use client';

import { AlertTriangle, ArrowUp, Loader2, Pause, Play, Plug, Square } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { Button } from '@/components/UI/button';
import { WorkflowAppIcon } from './WorkflowAppIcon';
import {
  requirementNeedsConnection,
  type Workflow,
  type WorkflowInstallation,
  type WorkflowRequirement,
} from '@/types/workflows';

/**
 * The state language of the surface. Adapted from IntegrationConnectLoopBanners.
 *
 * The important one is "needs connection". It is NOT an error — it is the correct
 * outcome of installing before connecting. It must read as *one step remaining*,
 * with the connect action right there. Warning tone, never destructive; never the
 * word "failed"; always says explicitly that nothing will fire in the meantime.
 */

export function WorkflowUnmetRequirementsBanner({
  missing,
  onConnect,
}: {
  missing: WorkflowRequirement[];
  onConnect: (canonicalSlug: string) => void;
}) {
  if (missing.length === 0) return null;
  const names = missing.map((requirement) => requirement.displayName);
  return (
    <Alert
      className="border-[color:var(--status-warning)]/40 bg-[color:var(--status-warning-bg)]"
      data-testid="workflow-unmet-requirements"
    >
      <Plug className="h-4 w-4 text-[color:var(--status-warning)]" />
      <AlertTitle>
        {missing.length === 1
          ? "One app isn't connected yet"
          : `${missing.length} apps aren't connected yet`}
      </AlertTitle>
      <AlertDescription>
        <p>
          You can install now — everything gets planted, and its jobs stay held until{' '}
          <span className="font-medium text-foreground">{names.join(' and ')}</span>{' '}
          {missing.length > 1 ? 'are' : 'is'} connected. Nothing will fire in the meantime.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {missing.filter(requirementNeedsConnection).map((requirement) => (
            <Button
              key={requirement.canonicalSlug}
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => onConnect(requirement.canonicalSlug)}
            >
              <WorkflowAppIcon requirement={requirement} size="xs" />
              Connect {requirement.displayName}
            </Button>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function WorkflowHeldBanner({
  installation,
  missing,
  onConnect,
}: {
  installation: WorkflowInstallation;
  missing: WorkflowRequirement[];
  onConnect: (canonicalSlug: string) => void;
}) {
  const names = missing.map((requirement) => requirement.displayName);
  return (
    <Alert
      className="border-[color:var(--status-warning)]/40 bg-[color:var(--status-warning-bg)]"
      data-testid="workflow-held"
    >
      <Plug className="h-4 w-4 text-[color:var(--status-warning)]" />
      <AlertTitle>One step left — connect {names.join(' and ')}</AlertTitle>
      <AlertDescription>
        <p>
          Everything is planted. Its {installation.tasks.length} job
          {installation.tasks.length === 1 ? ' is' : 's are'} deliberately held and won&rsquo;t fire
          until the connection lands.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {missing.filter(requirementNeedsConnection).map((requirement) => (
            <Button
              key={requirement.canonicalSlug}
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => onConnect(requirement.canonicalSlug)}
            >
              <WorkflowAppIcon requirement={requirement} size="xs" />
              Connect {requirement.displayName}
            </Button>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function WorkflowSettingUpBanner({
  installation,
  onToggle,
  onStop,
  onWatch,
}: {
  installation: WorkflowInstallation;
  onToggle: (slug: string) => void;
  onStop: (slug: string) => void;
  onWatch?: () => void;
}) {
  const setup = installation.setup;
  if (!setup) return null;
  return (
    <Alert
      className="border-[color:var(--status-info)]/40 bg-[color:var(--status-info-bg)]"
      data-testid="workflow-setting-up"
    >
      <Loader2
        className={`h-4 w-4 text-[color:var(--status-info)] ${setup.paused ? '' : 'animate-spin'}`}
      />
      <AlertTitle>{setup.paused ? 'Setup paused' : setup.label}</AlertTitle>
      <AlertDescription>
        <p>
          {setup.detail} · {setup.etaLabel}. This is a one-off pass — you can steer it, and the
          recurring jobs arm as soon as it finishes.
        </p>
        <div className="mt-3 flex items-center gap-2.5">
          <span className="h-1.5 w-full max-w-[340px] overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-[color:var(--status-info)] transition-[width] duration-500"
              style={{ width: `${setup.percent}%` }}
            />
          </span>
          <span className="text-caption whitespace-nowrap font-mono">{setup.percent}%</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => onToggle(installation.slug)}
          >
            {setup.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {setup.paused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => onStop(installation.slug)}
          >
            <Square className="h-3.5 w-3.5" />
            Stop and keep what&rsquo;s done
          </Button>
          {onWatch && (
            <Button type="button" size="sm" variant="ghost" onClick={onWatch}>
              Watch in Actions
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function WorkflowPartialBanner({
  installation,
  onRetry,
}: {
  installation: WorkflowInstallation;
  onRetry: (slug: string) => void;
}) {
  const failures = installation.failures ?? [];
  return (
    <Alert
      className="border-[color:var(--status-danger)]/40 bg-[color:var(--status-danger-bg)]"
      data-testid="workflow-partial"
    >
      <AlertTriangle className="h-4 w-4 text-destructive" />
      <AlertTitle>{failures.length} items didn&rsquo;t land</AlertTitle>
      <AlertDescription>
        <p>
          The rest installed and is running. These will be retried automatically at the next run, or
          you can retry now.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
          {failures.map((failure) => (
            <li key={failure.name}>
              <span className="font-medium text-foreground">{failure.name}</span> — {failure.reason}
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Button type="button" size="sm" onClick={() => onRetry(installation.slug)}>
            Retry {failures.length === 2 ? 'both' : 'all'}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function WorkflowUpdateBanner({
  workflow,
  installation,
  onUpdate,
}: {
  workflow: Workflow;
  installation: WorkflowInstallation;
  onUpdate: (slug: string) => void;
}) {
  return (
    <Alert
      className="border-primary-tint-40 bg-accent-soft"
      data-testid="workflow-update-available-banner"
    >
      <ArrowUp className="h-4 w-4 text-[color:var(--status-success)]" />
      <AlertTitle>Update available — v{workflow.version}</AlertTitle>
      <AlertDescription>
        <p>
          You&rsquo;re on v{installation.installedVersion}. Updating replants the procedures and
          functions Unify has revised; your settings and run history are kept.
        </p>
        <div className="mt-3">
          <Button type="button" size="sm" onClick={() => onUpdate(workflow.slug)}>
            Update to v{workflow.version}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
