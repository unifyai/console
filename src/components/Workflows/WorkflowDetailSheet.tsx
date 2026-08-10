'use client';

import * as React from 'react';
import { Download, Loader2, Play, Trash2, User, Users } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/UI/sheet';
import { cn } from '@/lib/utils';
import { AssistantMarkdown } from '@/components/Pages/Assistants/Common/AssistantMarkdown';
import { WorkflowTileIcon } from './WorkflowTileIcon';
import { WorkflowDetailSkeleton } from './WorkflowCardSkeleton';
import { WorkflowRequirementList } from './WorkflowRequirementList';
import { WorkflowManifestGroups } from './WorkflowManifestGroups';
import { WorkflowArtifactView } from './WorkflowArtifactView';
import {
  WorkflowParamsForm,
  missingRequiredParams,
  type WorkflowParamValues,
} from './WorkflowParamsForm';
import {
  WorkflowDestinationBadge,
  WorkflowStatusBadge,
  WorkflowUpdateBadge,
} from './WorkflowStatusBadge';
import {
  WorkflowHeldBanner,
  WorkflowPartialBanner,
  WorkflowRequestBanner,
  WorkflowSettingUpBanner,
  WorkflowUnmetRequirementsBanner,
  WorkflowUpdateBanner,
} from './WorkflowStateBanners';
import type { WorkflowRequestState } from '@/hooks/Workflows/useWorkflowCatalog';
import {
  WORKFLOW_CATEGORY_LABEL,
  WORKFLOW_SURFACES,
  WORKFLOW_SURFACE_ORDER,
  categoryStyle,
} from './workflowCategories';
import {
  hasUpdate,
  unmetRequirements,
  workflowCardState,
  type WorkflowDestination,
  type WorkflowArtifact,
  type WorkflowGalleryItem,
  type WorkflowRequirement,
  type WorkflowSurfaceKind,
} from '@/types/workflows';

/**
 * ONE sheet for both install and manage — not a wizard.
 *
 * Install mode orders the body exactly as the trust model demands:
 *   1. what it needs (apps + capabilities, with inline connect)
 *   2. what it needs from you (settings)
 *   3. what it will set up (manifest, every recurring job with its plain schedule)
 *   4. install for whom (personal vs team — team has a wider blast radius)
 *   → Install
 *
 * Manage mode is the same body with the tenses changed, a state banner on top,
 * and Uninstall / Save settings in the footer.
 */
export function WorkflowDetailSheet({
  item,
  open,
  isLoading,
  canMutate = true,
  isInstalling,
  provisioningStep,
  team,
  onOpenChange,
  onConnect,
  onConnectWorkspace,
  onInstall,
  request,
  onDismissRequest,
  onSaveParams,
  onUninstall,
  onToggleSetup,
  onStopSetup,
  onRetry,
  onRunNow,
  isRunning = false,
  onUpdate,
  onNavigate,
  onPreview,
  requirementsResolving,
  preview = null,
  previewLoading,
  onPreviewBack,
  onSupplySecret,
  onWatchInActions,
}: {
  item: WorkflowGalleryItem | null;
  open: boolean;
  /** True while the workflow's own detail is still resolving. */
  isLoading?: boolean;
  /**
   * False when a mutation would only change local state. Planting content is
   * the assistant's work and the record-and-wake path is not built, so the
   * sheet says so rather than pretending an install persisted.
   */
  canMutate?: boolean;
  /** True while the optimistic provisioning list is running. */
  isInstalling?: boolean;
  /** Index into the surface list being planted, for the progress list. */
  provisioningStep?: number;
  /** The team this assistant could install into, if any. */
  team?: { id: string; name: string; memberCount: number };
  onOpenChange: (open: boolean) => void;
  /** The recorded change in flight for this workflow, when there is one. */
  request?: WorkflowRequestState;
  /** Stops showing a settled request. */
  onDismissRequest?: (slug: string) => void;
  onConnect: (canonicalSlug: string) => void;
  /** Opens the workspace manager, for a `workspace` requirement. */
  onConnectWorkspace?: () => void;
  onInstall: (values: WorkflowParamValues, destination: WorkflowDestination) => void;
  onSaveParams: (slug: string, values: WorkflowParamValues) => void;
  onUninstall: (item: WorkflowGalleryItem) => void;
  onToggleSetup: (slug: string) => void;
  onStopSetup: (slug: string) => void;
  onRetry: (slug: string) => void;
  /** Starts the workflow's job now rather than at its next occurrence. */
  onRunNow?: (slug: string) => void;
  /** True while that job is being started. */
  isRunning?: boolean;
  onUpdate: (slug: string) => void;
  /** Opens the rail section where a planted surface lives. */
  onNavigate?: (kind: WorkflowSurfaceKind) => void;
  /** True until the integrations catalogue has answered for requirements. */
  requirementsResolving?: boolean;
  /** Previews one manifest item by swapping this drawer to it. */
  onPreview?: (kind: WorkflowSurfaceKind, name: string) => void;
  /** The artifact being previewed; when set, the drawer shows it instead. */
  preview?: WorkflowArtifact | null;
  /** True while the previewed artifact's body is still arriving. */
  previewLoading?: boolean;
  /** Returns from a preview to the workflow itself. */
  onPreviewBack?: () => void;
  /** Opens wherever secrets are entered, for the secret-gated routes. */
  onSupplySecret?: (requirement: WorkflowRequirement) => void;
  onWatchInActions?: () => void;
}) {
  const workflow = item?.workflow;
  const installation = item?.installation;
  const installMode = !installation;

  const defaults = React.useMemo<WorkflowParamValues>(() => {
    if (!workflow) return {};
    const next: WorkflowParamValues = {};
    for (const param of workflow.paramsSchema) {
      next[param.name] =
        installation?.params[param.name] ??
        (param.type === 'select'
          ? (param.options?.[0] ?? '')
          : param.type === 'boolean'
            ? false
            : '');
    }
    return next;
  }, [workflow, installation]);

  const [values, setValues] = React.useState<WorkflowParamValues>(defaults);
  const [destinationKind, setDestinationKind] = React.useState<'personal' | 'team'>('personal');
  const [dirty, setDirty] = React.useState(false);
  // Which way the pane last moved, so returning slides back rather than
  // repeating the forward motion. Reading is a place you go and come back from.
  const [wentForward, setWentForward] = React.useState(true);
  React.useEffect(() => {
    if (preview) setWentForward(true);
  }, [preview]);

  React.useEffect(() => {
    setValues(defaults);
    setDirty(false);
    setDestinationKind('personal');
  }, [defaults]);

  if (!item || !workflow) return null;

  const missing = unmetRequirements(workflow);
  const missingParams = missingRequiredParams(workflow.paramsSchema, values);
  const plantedKinds = WORKFLOW_SURFACE_ORDER.filter(
    (kind) => (workflow.sets[kind]?.length ?? 0) > 0
  );
  const recurringCount = workflow.sets.tasks?.length ?? 0;

  const handleChange = (name: string, value: string | number | boolean) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setDirty(true);
  };

  const banner = () => {
    // A recorded change outranks every derived state: while one is in flight
    // or has failed, what the assistant is doing with it is the only honest
    // thing to say about this workflow.
    if (request) {
      return (
        <WorkflowRequestBanner request={request} onRetry={onRetry} onDismiss={onDismissRequest} />
      );
    }
    if (isInstalling) return null;
    if (installMode) {
      return (
        <WorkflowUnmetRequirementsBanner
          missing={missing}
          onConnect={onConnect}
          onConnectWorkspace={onConnectWorkspace}
        />
      );
    }
    if (installation.status === 'pending_requirements') {
      return (
        <WorkflowHeldBanner
          installation={installation}
          missing={missing}
          onConnect={onConnect}
          onConnectWorkspace={onConnectWorkspace}
        />
      );
    }
    if (installation.status === 'provisioning') {
      return (
        <WorkflowSettingUpBanner
          installation={installation}
          onToggle={onToggleSetup}
          onStop={onStopSetup}
          onWatch={onWatchInActions}
        />
      );
    }
    if (installation.status === 'partial') {
      return <WorkflowPartialBanner installation={installation} onRetry={onRetry} />;
    }
    if (hasUpdate(item)) {
      return (
        <WorkflowUpdateBanner workflow={workflow} installation={installation} onUpdate={onUpdate} />
      );
    }
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 overflow-hidden p-0"
        style={categoryStyle(workflow.category)}
        data-testid={`workflow-sheet-${workflow.slug}`}
      >
        {preview ? (
          <div
            key="preview"
            className="flex h-full min-h-0 flex-col duration-200 animate-in slide-in-from-right-8"
          >
            {/* The preview pane replaces the header, and with it the only
                SheetTitle — which Radix requires on every dialog. Named
                for what is actually on screen rather than hidden empty. */}
            <SheetTitle className="sr-only">{preview.name}</SheetTitle>
            <WorkflowArtifactView
              artifact={preview}
              isLoading={previewLoading}
              onBack={() => {
                setWentForward(false);
                onPreviewBack?.();
              }}
              onNavigate={onNavigate}
            />
          </div>
        ) : (
          <div
            key="detail"
            className={cn(
              'flex h-full min-h-0 flex-col duration-200 animate-in',
              wentForward ? 'fade-in' : 'slide-in-from-left-8'
            )}
          >
            <header className="flex items-start gap-3 border-b p-5 pr-12">
              <WorkflowTileIcon iconId={workflow.iconId} category={workflow.category} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <span
                    className="h-1.5 w-1.5 rounded-[2px] bg-[color:var(--wf-cat)]"
                    aria-hidden="true"
                  />
                  {WORKFLOW_CATEGORY_LABEL[workflow.category]} · curated by Unify
                </p>
                <SheetTitle className="text-doc-title mt-1">{workflow.name}</SheetTitle>
                <SheetDescription className="text-body-muted mt-1">
                  {workflow.description}
                </SheetDescription>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <WorkflowStatusBadge state={workflowCardState(item)} />
                  <Badge
                    variant="outline"
                    className="rounded-full font-mono text-[10.5px] text-muted-foreground"
                  >
                    v{installation?.installedVersion ?? workflow.version}
                  </Badge>
                  {hasUpdate(item) && <WorkflowUpdateBadge version={workflow.version} />}
                  {installation?.destination.kind === 'team' && (
                    <WorkflowDestinationBadge
                      teamName={installation.destination.teamName}
                      memberCount={installation.destination.memberCount}
                    />
                  )}
                  {installation?.destination.kind === 'personal' && (
                    <Badge
                      variant="outline"
                      className="rounded-full text-[10.5px] text-muted-foreground"
                    >
                      Personal install
                    </Badge>
                  )}
                </div>
              </div>
            </header>

            <ScrollArea
              className="min-h-0 flex-1"
              viewportClassName="min-w-0 overflow-x-hidden [&>div]:!block"
            >
              <div className="flex flex-col gap-5 p-4 sm:p-5">
                {isLoading ? (
                  <WorkflowDetailSkeleton />
                ) : isInstalling ? (
                  <ProvisioningProgress
                    kinds={plantedKinds}
                    step={provisioningStep ?? 0}
                    counts={Object.fromEntries(
                      plantedKinds.map((kind) => [kind, workflow.sets[kind]?.length ?? 0])
                    )}
                    destinationLabel={
                      destinationKind === 'team' && team ? team.name : 'your assistant'
                    }
                    workflowName={workflow.name}
                  />
                ) : (
                  <>
                    {banner()}

                    {workflow.about && (
                      <Section title="About">
                        <AssistantMarkdown>{workflow.about}</AssistantMarkdown>
                      </Section>
                    )}

                    <Section
                      title="What it needs"
                      hint={`${workflow.requirements.length} app${workflow.requirements.length === 1 ? '' : 's'}${
                        workflow.capabilities.length
                          ? ` · ${workflow.capabilities.length} capability`
                          : ''
                      }`}
                    >
                      <WorkflowRequirementList
                        workflow={workflow}
                        isResolving={requirementsResolving}
                        onConnect={onConnect}
                        onConnectWorkspace={onConnectWorkspace}
                        onSupplySecret={onSupplySecret}
                      />
                    </Section>

                    <Section
                      title={installMode ? 'What it needs from you' : 'Settings'}
                      hint={
                        installMode ? 'set once, editable later' : 'changes apply to the next run'
                      }
                    >
                      <WorkflowParamsForm
                        params={workflow.paramsSchema}
                        values={values}
                        onChange={handleChange}
                      />
                    </Section>

                    <Section
                      title={installMode ? 'What it will set up' : 'What it set up'}
                      hint="tap any item to read it"
                    >
                      <WorkflowManifestGroups
                        workflow={workflow}
                        installation={installation}
                        onNavigate={onNavigate}
                        onPreview={onPreview}
                      />
                    </Section>

                    {installMode && team && (
                      <Section title="Install for">
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <DestinationCard
                            selected={destinationKind === 'personal'}
                            icon={<User className="h-4 w-4" />}
                            title="Just me"
                            detail="Only your assistant is changed."
                            onSelect={() => setDestinationKind('personal')}
                          />
                          <DestinationCard
                            selected={destinationKind === 'team'}
                            icon={<Users className="h-4 w-4" />}
                            title={team.name}
                            detail={`Plants into the shared assistant — ${team.memberCount} people see it and its jobs act for the team.`}
                            onSelect={() => setDestinationKind('team')}
                          />
                        </div>
                      </Section>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

            {!isInstalling && !isLoading && (
              <footer className="flex flex-wrap items-center gap-2 border-t p-3.5">
                {installMode ? (
                  <>
                    <span className="text-caption flex-1">
                      {!canMutate
                        ? 'Installing from Console is coming — ask your teammate in chat to install this.'
                        : missingParams.length
                          ? `Fill ${missingParams.map((param) => param.label.toLowerCase()).join(', ')} to install`
                          : `${recurringCount} job${recurringCount === 1 ? '' : 's'} will be created`}
                    </span>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="gap-1.5"
                      disabled={missingParams.length > 0 || !canMutate || requirementsResolving}
                      onClick={() =>
                        onInstall(
                          values,
                          destinationKind === 'team' && team
                            ? {
                                kind: 'team',
                                teamId: team.id,
                                teamName: team.name,
                                memberCount: team.memberCount,
                              }
                            : { kind: 'personal' }
                        )
                      }
                      data-testid={`workflow-install-${workflow.slug}`}
                    >
                      <Download className="h-4 w-4" />
                      {missing.length ? 'Install anyway' : 'Install'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="warningOutline"
                      className="gap-1.5"
                      disabled={!canMutate}
                      onClick={() => onUninstall(item)}
                      data-testid={`workflow-uninstall-${workflow.slug}`}
                    >
                      <Trash2 className="h-4 w-4" />
                      Uninstall
                    </Button>
                    <span className="flex-1" />
                    {!canMutate && (
                      <span className="text-caption">Changes from Console are coming soon</span>
                    )}
                    {canMutate && dirty && <span className="text-caption">Unsaved settings</span>}
                    {/* Only for an armed installation: a held one's jobs are
                        disarmed on purpose, and a run started against an app
                        nobody has connected fails halfway through its work. */}
                    {canMutate && onRunNow && installation.status === 'active' && (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-1.5"
                        disabled={isRunning || installation.tasks.length === 0}
                        onClick={() => onRunNow(workflow.slug)}
                        data-testid={`workflow-sheet-run-now-${workflow.slug}`}
                      >
                        {isRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Run now
                      </Button>
                    )}
                    <Button
                      type="button"
                      disabled={!dirty || !canMutate}
                      onClick={() => {
                        onSaveParams(workflow.slug, values);
                        setDirty(false);
                      }}
                    >
                      Save settings
                    </Button>
                  </>
                )}
              </footer>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      {/* Title and hint are pushed apart and underlined rather than set side by
          side: at the same baseline with a small gap, a mono uppercase label ran
          straight into its sentence-case annotation and read as one phrase
          ("WHAT IT NEEDS 1 app"). The rule also makes each section a block. */}
      <div className="mb-3 flex items-baseline justify-between gap-4 border-b pb-1.5">
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </h3>
        {hint && <span className="text-caption shrink-0 normal-case tracking-normal">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function DestinationCard({
  selected,
  icon,
  title,
  detail,
  onSelect,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  detail: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex items-start gap-2.5 rounded-xl border bg-card-2 p-3 text-left transition',
        selected ? 'border-primary bg-accent-soft' : 'hover:border-primary-tint-40'
      )}
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span>
        <span className="text-h3 block">{title}</span>
        <span className="text-caption mt-0.5 block">{detail}</span>
      </span>
    </button>
  );
}

/** Optimistic install progress — each surface lands in its normal place. */
function ProvisioningProgress({
  kinds,
  step,
  counts,
  destinationLabel,
  workflowName,
}: {
  kinds: WorkflowSurfaceKind[];
  step: number;
  counts: Record<string, number>;
  destinationLabel: string;
  workflowName: string;
}) {
  return (
    <>
      <div className="border-[color:var(--status-info)]/40 rounded-xl border bg-[color:var(--status-info-bg)] p-3.5">
        <p className="text-h3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-[color:var(--status-info)]" />
          Planting {workflowName} into {destinationLabel}
        </p>
        <p className="text-body-muted mt-1">
          This takes a few seconds. Each item lands in its normal place in the product.
        </p>
      </div>
      <ol className="flex flex-col gap-2.5">
        {kinds.map((kind, index) => {
          const done = index < step;
          const now = index === step;
          return (
            <li
              key={kind}
              className={cn(
                'flex items-center gap-2.5 text-sm',
                done && 'text-muted-foreground',
                now && 'font-medium text-foreground',
                !done && !now && 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                  done && 'border-primary bg-primary text-primary-foreground',
                  now && 'border-[color:var(--status-info)] text-[color:var(--status-info)]'
                )}
              >
                {now ? <Loader2 className="h-3 w-3 animate-spin" /> : done ? '✓' : null}
              </span>
              {done ? 'Planted' : now ? 'Planting' : 'Waiting'} {counts[kind]}{' '}
              {WORKFLOW_SURFACES[kind].label.toLowerCase()}
            </li>
          );
        })}
      </ol>
    </>
  );
}
