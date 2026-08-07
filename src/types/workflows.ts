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
 * `available` is the absence of an installation. `partial` means the install
 * landed unevenly — some surfaces failed and will be retried; the rest runs.
 *
 * `active` and `partial` are the only values the WorkflowManager stores; the
 * rest are derived client-side.
 */
export type WorkflowInstallStatus =
  | 'pending_requirements'
  | 'provisioning'
  | 'active'
  | 'partial'
  | 'uninstalling';
export type WorkflowCardState = WorkflowInstallStatus | 'available';

/** Capability the teammate itself must have, beyond a connected app. */
export type WorkflowCapability = 'computer' | 'filesystem';

/**
 * Which authority answered a requirement's connection check. An app
 * reachable more than one way needs only one route to be satisfied — a live
 * connection outranks a missing secret.
 *
 * The route decides the *fix*, and offering the wrong one is worse than
 * offering none: OAuth does nothing for an app gated on a secret.
 */
export type WorkflowRequirementRoute =
  /** Provider-backed catalog app — satisfied by a live connection row. */
  | 'connection'
  /** Native integration package — satisfied by the package's own secrets. */
  | 'native_package'
  /** BYOD OAuth (Google Workspace, Microsoft 365) — satisfied by a named secret. */
  | 'secret'
  /**
   * The user's Workspace — not an integration at all. Not in the gallery, not
   * a package, and connected in the onboarding and profile flows, so its
   * affordance belongs to those rather than to the integrations gallery.
   */
  | 'workspace'
  /** Nothing to check (built-in capabilities like web browsing); reads as met. */
  | 'undeclared'
  /**
   * The slug could not be matched to a gallery app — the integrations
   * catalogue has not loaded, or the bundle names a slug outside the
   * gallery's id space. Unknown is not met and not unmet: it renders as
   * "couldn't verify", never as a green check, and never holds jobs.
   */
  | 'unresolved';

export interface WorkflowRequirement {
  /**
   * Provider app slug — lowercase, the same id space as `canonicalSlug` in
   * the integrations gallery. An OAuth alias that is valid upstream but
   * absent from the gallery (`google_workspace` rather than `gmail`) renders
   * a chip with no logo and no working action, so unresolvable slugs are
   * reported loudly in development.
   */
  canonicalSlug: string;
  displayName: string;
  /** Vendor mark served by the live catalog feed. */
  iconUrl?: string | null;
  /** Client-side vendor mark (react-icons), mirroring IntegrationProviderConfig. */
  iconComponent?: React.ComponentType<{ className?: string }>;
  via: WorkflowRequirementRoute;
  connected: boolean;
  /** e.g. "haris@unify.ai" — shown when connected. */
  accountLabel?: string;
  /** Secret names still to supply. Only meaningful for the secret-gated routes. */
  missingSecrets?: string[];
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
  /**
   * Recurring tasks only — human schedule, e.g. "Every weekday at 9:00am,
   * your timezone". Display copy: never branch on it.
   */
  schedule?: string;
  /**
   * True for the one-shot provisioning job (a mailbox backfill, a CRM
   * import) that drives the provisioning state. A stable flag rather than a
   * `schedule.startsWith('once')` match, because the schedule is prose the
   * catalog rewords freely and a missed match would silently arm a
   * backfill as if it were recurring.
   */
  runsOnce?: boolean;
}

/** What a workflow sets up, grouped by the surface it lands on. */
export type WorkflowManifest = Partial<Record<WorkflowSurfaceKind, WorkflowManifestItem[]>>;

export interface Workflow {
  slug: string;
  name: string;
  category: WorkflowCategory;
  /** One line, house voice. */
  description: string;
  /**
   * Long-form markdown for someone deciding whether to install: what the
   * workflow does, when it runs, what arrives, how its settings shape it.
   * The description is the card; this is the page.
   */
  about: string;
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
  /** Present only while status === 'partial'. */
  failures?: WorkflowFailure[];
  tasks: WorkflowTaskRuntime[];
  /** Planted objects with their real hrefs, merged over Workflow.sets for display. */
  planted?: WorkflowManifest;
}

/**
 * One artifact a workflow would plant, published beside the catalogue so
 * the drawer can preview it before anything is installed. The body is the
 * artifact's readable substance: a procedure's or claim's text, a task's
 * brief, a function's docstring.
 */
export interface WorkflowArtifact {
  contentKey: string;
  slug: string;
  kind: WorkflowSurfaceKind;
  name: string;
  body: string;
  schedule?: string;
  meta: Record<string, unknown>;
}

export interface WorkflowGalleryItem {
  workflow: Workflow;
  installation?: WorkflowInstallation;
}

export function workflowCardState(item: WorkflowGalleryItem): WorkflowCardState {
  return item.installation ? item.installation.status : 'available';
}

/**
 * Requirements still standing between the workflow and its jobs firing.
 * `undeclared` has nothing to check and `unresolved` could not be checked;
 * neither counts as unmet — the assistant derives the real held state, and
 * holding a job on a check the client could not even run helps nobody.
 */
export function unmetRequirements(workflow: Workflow): WorkflowRequirement[] {
  return workflow.requirements.filter(
    (requirement) =>
      requirement.via !== 'undeclared' && requirement.via !== 'unresolved' && !requirement.connected
  );
}

/** Unmet and fixed by the gallery's OAuth/API-key connect handshake. */
export function requirementNeedsConnection(requirement: WorkflowRequirement): boolean {
  return requirement.via === 'connection' && !requirement.connected;
}

/** Unmet and fixed by supplying a secret — never by an OAuth click. */
export function requirementNeedsSecret(requirement: WorkflowRequirement): boolean {
  return (
    (requirement.via === 'native_package' ||
      requirement.via === 'secret' ||
      requirement.via === 'workspace') &&
    !requirement.connected
  );
}

/** Requirements the user can resolve by connecting an app in the gallery. */
export function connectableRequirements(workflow: Workflow): WorkflowRequirement[] {
  return workflow.requirements.filter(requirementNeedsConnection);
}

/** Requirements waiting on secrets, with the secret names to name in copy. */
export function secretGatedRequirements(workflow: Workflow): WorkflowRequirement[] {
  return workflow.requirements.filter(requirementNeedsSecret);
}

export function hasUpdate(item: WorkflowGalleryItem): boolean {
  return !!item.installation && item.installation.installedVersion !== item.workflow.version;
}

/** Recurring jobs only — the one-shot provisioning job drives its own state. */
export function recurringTasks(workflow: Workflow): WorkflowManifestItem[] {
  return (workflow.sets.tasks ?? []).filter((task) => !task.runsOnce);
}

export function provisioningTask(workflow: Workflow): WorkflowManifestItem | undefined {
  return (workflow.sets.tasks ?? []).find((task) => task.runsOnce);
}
