import type React from 'react';

/**
 * Workflows — an off-the-shelf capability the user installs into their assistant.
 *
 * A workflow is curated in git by Unify: browse, install, configure, inspect,
 * uninstall. There is no authoring, forking or publishing. Everything a workflow
 * plants (procedures, functions, recurring tasks, knowledge, canvases, tables)
 * is an ordinary object that lives on its own page — this surface only owns
 * install state and settings.
 */

export type WorkflowCategory = 'comms' | 'growth' | 'ops' | 'build';

/** Product surfaces a workflow can plant into. Ordered as they should render. */
export type WorkflowSurfaceKind =
  | 'procedures'
  | 'functions'
  | 'tasks'
  | 'knowledge'
  | 'canvases'
  | 'tables';

/**
 * Installed-only lifecycle, in the WorkflowManager's own vocabulary.
 * `available` is the absence of an installation. `failed` means the install
 * landed unevenly — some surfaces failed and will be retried; the rest runs.
 */
export type WorkflowInstallStatus =
  | 'pending_requirements'
  | 'provisioning'
  | 'active'
  | 'failed'
  | 'uninstalling';
export type WorkflowCardState = WorkflowInstallStatus | 'available';

/** Capability the teammate itself must have, beyond a connected app. */
export type WorkflowCapability = 'computer' | 'filesystem';

export interface WorkflowRequirement {
  /** Canonical integration slug — same id space as the integrations gallery. */
  canonicalSlug: string;
  displayName: string;
  /** Vendor mark served by the live catalog feed. */
  iconUrl?: string | null;
  /** Client-side vendor mark (react-icons), mirroring IntegrationProviderConfig. */
  iconComponent?: React.ComponentType<{ className?: string }>;
  connected: boolean;
  /** e.g. "haris@unify.ai" — shown when connected. */
  accountLabel?: string;
  /** Built-in capabilities (web browsing) are always available. */
  builtin?: boolean;
}

export interface WorkflowParam {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean';
  required: boolean;
  /** One plain sentence under the field. Always present — these are consequential. */
  help: string;
  options?: string[];
  placeholder?: string;
  /** Unit rendered after a number input, e.g. "days", "%". */
  suffix?: string;
}

export interface WorkflowManifestItem {
  name: string;
  /** Deep link to where this object actually lives. Absent pre-install. */
  href?: string;
  /** Recurring tasks only — human schedule, e.g. "Every weekday at 9:00am, your timezone". */
  schedule?: string;
}

/** What a workflow sets up, grouped by the surface it lands on. */
export type WorkflowManifest = Partial<Record<WorkflowSurfaceKind, WorkflowManifestItem[]>>;

export interface Workflow {
  slug: string;
  name: string;
  category: WorkflowCategory;
  /** One line, house voice. */
  description: string;
  version: string;
  /** Key into WORKFLOW_TILE_ICONS. */
  iconId: string;
  requirements: WorkflowRequirement[];
  capabilities: WorkflowCapability[];
  paramsSchema: WorkflowParam[];
  sets: WorkflowManifest;
}

export type WorkflowRunOutcome = 'success' | 'partial' | 'failed' | 'never';

export interface WorkflowTaskRuntime {
  taskId: string;
  name: string;
  /** False while the workflow is held (needs connection) or still provisioning. */
  enabled: boolean;
  nextRunLabel: string;
  lastRunLabel: string;
  lastRunOutcome: WorkflowRunOutcome;
  href: string;
}

/** One-shot provisioning job (mailbox backfill, CRM import). Steerable. */
export interface WorkflowSetupProgress {
  label: string;
  percent: number;
  detail: string;
  etaLabel: string;
  paused: boolean;
}

export interface WorkflowFailure {
  kind: WorkflowSurfaceKind;
  name: string;
  reason: string;
}

export type WorkflowDestination =
  | { kind: 'personal' }
  | { kind: 'team'; teamId: string; teamName: string; memberCount: number };

export interface WorkflowInstallation {
  slug: string;
  status: WorkflowInstallStatus;
  /** May lag Workflow.version → update available. */
  installedVersion: string;
  destination: WorkflowDestination;
  params: Record<string, string | number | boolean>;
  installedAtLabel: string;
  /** Present only while status === 'provisioning'. */
  setup?: WorkflowSetupProgress;
  /** Present only while status === 'failed'. */
  failures?: WorkflowFailure[];
  tasks: WorkflowTaskRuntime[];
  /** Planted objects with their real hrefs, merged over Workflow.sets for display. */
  planted?: WorkflowManifest;
}

export interface WorkflowGalleryItem {
  workflow: Workflow;
  installation?: WorkflowInstallation;
}

export function workflowCardState(item: WorkflowGalleryItem): WorkflowCardState {
  return item.installation ? item.installation.status : 'available';
}

export function unmetRequirements(workflow: Workflow): WorkflowRequirement[] {
  return workflow.requirements.filter((requirement) => !requirement.connected);
}

export function hasUpdate(item: WorkflowGalleryItem): boolean {
  return !!item.installation && item.installation.installedVersion !== item.workflow.version;
}

/** Recurring jobs only — "Once, at install" entries drive the setting-up state instead. */
export function recurringTasks(workflow: Workflow): WorkflowManifestItem[] {
  return (workflow.sets.tasks ?? []).filter(
    (task) => !task.schedule?.toLowerCase().startsWith('once')
  );
}

export function provisioningTask(workflow: Workflow): WorkflowManifestItem | undefined {
  return (workflow.sets.tasks ?? []).find((task) =>
    task.schedule?.toLowerCase().startsWith('once')
  );
}
