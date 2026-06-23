'use server';

/**
 * Coordinator state server actions.
 *
 * The assistants page reads/writes the per-workspace Coordinator's
 * onboarding state row via these actions. They proxy directly to the
 * orchestra ``/assistant/{coordinator_id}/state`` endpoints which
 * authorize against the calling user and return the latest snapshot.
 *
 * Server Actions cannot be called directly via HTTP — they can only
 * be invoked through React's internal mechanism, which prevents
 * abuse by external scripts.
 *
 * Schema note: ``Coordinator/State`` uses the vocabulary
 * ``onboarding`` / ``working`` for ``mode``.
 */

import { getCurrentUser } from '@/lib/user/user';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

export type CoordinatorMode = 'onboarding' | 'working';

export type OnboardingStepStatus = 'done' | 'skipped' | 'available' | 'locked' | 'coming_soon';

/** A read-only suggestion chip shown under the act/schedule rows. */
export interface OnboardingChip {
  id: string;
  label: string;
}

/** Direct dependency used to explain why a step is still locked. */
export interface OnboardingStepDependency {
  id: string;
  title: string;
  status: OnboardingStepStatus;
  resolution: 'addressed' | 'completed';
  satisfied: boolean;
}

export interface OnboardingEventSpec {
  eventType: string;
  message: string;
  subtype: string;
  details: Record<string, unknown>;
}

/**
 * A checklist phase header (grouping row) with its display copy, sourced
 * from Orchestra's canonical graph. ``id`` is the stable header-row id
 * (``comms`` / ``connect`` / ``work``); ``phase`` is the label stamped on
 * each step in the phase (and the short progress-bar legend). Only phases
 * visible on this deployment arrive — ``local_only`` phases are omitted by
 * the server on hosted staging/production.
 */
export interface OnboardingPhaseInfo {
  id: string;
  phase: string;
  title: string;
  description: string;
  framing: string;
}

/**
 * One onboarding step with its server-resolved status and presentation
 * copy. ``description`` / ``estimatedTime`` / ``chips*`` are sourced from
 * the canonical graph so the checklist renders straight from this payload
 * without its own duplicated copy.
 */
export interface OnboardingStep {
  id: string;
  title: string;
  phase: string;
  status: OnboardingStepStatus;
  kind?: string;
  channel?: string | null;
  pairedReply?: string | null;
  nudgeChat?: string;
  nudgeVoice?: string;
  phaseId?: string | null;
  canSkip: boolean;
  description: string;
  estimatedTime: string;
  flowNote?: string;
  chipsChat: OnboardingChip[];
  chipsCall: OnboardingChip[];
  dependencies: OnboardingStepDependency[];
  interaction?: Record<string, unknown> | null;
  event: OnboardingEventSpec | null;
}

/** A step the Coordinator may nudge toward right now, with ready copy. */
export interface OnboardingNextTarget {
  id: string;
  title: string;
  nudgeChat: string;
  nudgeVoice: string;
  channel: string | null;
  kind?: string;
  pairedReply?: string | null;
  phase?: string;
  flowNote?: string;
  interaction?: Record<string, unknown> | null;
}

/**
 * Precomputed, depends_on-aware onboarding picture from Orchestra. The
 * single source of truth for the checklist UI and both Droid brains:
 * statuses and valid next targets are computed server-side so nothing
 * downstream re-derives ordering. Present only while actively
 * onboarding; ``null`` once complete, working, or deferred.
 */
export interface OnboardingRender {
  activeStepId: string | null;
  phases: OnboardingPhaseInfo[];
  steps: OnboardingStep[];
  nextTargets: OnboardingNextTarget[];
  skippedPhaseIds: string[];
}

export interface CoordinatorStateSnapshot {
  coordinatorId: number;
  mode: CoordinatorMode;
  /** Persisted resume step. The call-vs-chat picker is *not* persisted. */
  onboardingStep: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /**
   * Onboarding checklist steps Orchestra derives as already complete
   * from durable domain state (workspace email contact, integration
   * secrets, action history, Tasks rows). Authoritative across
   * sessions — steps completed last week surface here even though no
   * transition event fired this session. Always empty outside
   * onboarding mode, where derivation is skipped server-side.
   */
  completedStepIds: string[];
  skippedStepIds: string[];
  skippedPhaseIds: string[];
  /**
   * Whether the user has resolved the opening picker (started the call
   * or chose chat). Once true the ringing picker and auto-playing intro
   * are never shown again on load — the intro is replayed on demand
   * from the onboarding pane. One-way sticky server-side.
   */
  introWatched: boolean;
  /**
   * Global "do onboarding later" switch. When true the user has chosen
   * to start using the platform before finishing onboarding: the
   * Coordinator suppresses every onboarding nudge/opener (server-side
   * too) and the checklist collapses to a resume affordance, all
   * without touching per-step completed/skipped state. Freely
   * reversible — flipping it back resumes the flow untouched.
   */
  onboardingDeferred: boolean;
  /**
   * Server-computed onboarding rendering (steps + statuses + valid next
   * targets). ``null`` outside active onboarding (complete, working, or
   * deferred). Drives the checklist directly — the client no longer
   * computes step availability.
   */
  onboarding: OnboardingRender | null;
}

export interface CoordinatorStatePatch {
  mode?: CoordinatorMode;
  onboardingStep?: string;
  clearOnboardingStep?: boolean;
  skipOnboardingStep?: string;
  unskipOnboardingStep?: string;
  resetOnboardingStep?: string;
  skipOnboardingPhase?: string;
  unskipOnboardingPhase?: string;
  introWatched?: boolean;
  onboardingDeferred?: boolean;
}

function normalizeMode(value: unknown): CoordinatorMode {
  return value === 'working' ? 'working' : 'onboarding';
}

function normalizeStep(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeStepIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

const ONBOARDING_STEP_STATUSES: ReadonlySet<string> = new Set([
  'done',
  'skipped',
  'available',
  'locked',
  'coming_soon',
]);

function normalizeChip(value: unknown): OnboardingChip | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const id = normalizeStep(r.id);
  if (!id) return null;
  return { id, label: typeof r.label === 'string' ? r.label : '' };
}

function normalizeChips(value: unknown): OnboardingChip[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeChip).filter((c): c is OnboardingChip => c !== null);
}

function normalizeOnboardingStepDependency(value: unknown): OnboardingStepDependency | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const id = normalizeStep(r.id);
  if (!id) return null;
  const status = r.status;
  return {
    id,
    title: typeof r.title === 'string' ? r.title : id,
    status:
      typeof status === 'string' && ONBOARDING_STEP_STATUSES.has(status)
        ? (status as OnboardingStepStatus)
        : 'locked',
    resolution: r.resolution === 'completed' ? 'completed' : 'addressed',
    satisfied: r.satisfied === true,
  };
}

function normalizeOnboardingStepDependencies(value: unknown): OnboardingStepDependency[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeOnboardingStepDependency)
    .filter((d): d is OnboardingStepDependency => d !== null);
}

function normalizeOnboardingEvent(value: unknown): OnboardingEventSpec | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const eventType = r.eventType ?? r.event_type;
  if (typeof eventType !== 'string' || !eventType.trim()) return null;
  const details = r.details && typeof r.details === 'object' ? r.details : {};
  return {
    eventType,
    message: typeof r.message === 'string' ? r.message : '',
    subtype: typeof r.subtype === 'string' ? r.subtype : '',
    details: details as Record<string, unknown>,
  };
}

function normalizeOnboardingPhase(value: unknown): OnboardingPhaseInfo | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const id = normalizeStep(r.id);
  if (!id) return null;
  return {
    id,
    phase: typeof r.phase === 'string' ? r.phase : '',
    title: typeof r.title === 'string' ? r.title : '',
    description: typeof r.description === 'string' ? r.description : '',
    framing: typeof r.framing === 'string' ? r.framing : '',
  };
}

function normalizeOnboardingStep(value: unknown): OnboardingStep | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const id = normalizeStep(r.id);
  if (!id) return null;
  const status = r.status;
  const estimatedTime = r.estimatedTime ?? r.estimated_time;
  return {
    id,
    title: typeof r.title === 'string' ? r.title : id,
    phase: typeof r.phase === 'string' ? r.phase : '',
    status:
      typeof status === 'string' && ONBOARDING_STEP_STATUSES.has(status)
        ? (status as OnboardingStepStatus)
        : 'locked',
    canSkip: (r.canSkip ?? r.can_skip) === true,
    description: typeof r.description === 'string' ? r.description : '',
    estimatedTime: typeof estimatedTime === 'string' ? estimatedTime : '',
    chipsChat: normalizeChips(r.chipsChat ?? r.chips_chat),
    chipsCall: normalizeChips(r.chipsCall ?? r.chips_call),
    dependencies: normalizeOnboardingStepDependencies(r.dependencies),
    event: normalizeOnboardingEvent(r.event),
  };
}

function normalizeOnboardingTarget(value: unknown): OnboardingNextTarget | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const id = normalizeStep(r.id);
  if (!id) return null;
  const channel = r.channel;
  return {
    id,
    title: typeof r.title === 'string' ? r.title : id,
    nudgeChat:
      typeof (r.nudgeChat ?? r.nudge_chat) === 'string' ? String(r.nudgeChat ?? r.nudge_chat) : '',
    nudgeVoice:
      typeof (r.nudgeVoice ?? r.nudge_voice) === 'string'
        ? String(r.nudgeVoice ?? r.nudge_voice)
        : '',
    channel: typeof channel === 'string' ? channel : null,
  };
}

function normalizeOnboardingRender(value: unknown): OnboardingRender | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const stepsRaw = Array.isArray(r.steps) ? r.steps : [];
  const targetsRaw = Array.isArray(r.nextTargets ?? r.next_targets)
    ? ((r.nextTargets ?? r.next_targets) as unknown[])
    : [];
  const active = r.activeStepId ?? r.active_step_id;
  const phasesRaw = Array.isArray(r.phases) ? r.phases : [];
  return {
    activeStepId: typeof active === 'string' && active ? active : null,
    phases: phasesRaw
      .map(normalizeOnboardingPhase)
      .filter((p): p is OnboardingPhaseInfo => p !== null),
    steps: stepsRaw.map(normalizeOnboardingStep).filter((s): s is OnboardingStep => s !== null),
    nextTargets: targetsRaw
      .map(normalizeOnboardingTarget)
      .filter((t): t is OnboardingNextTarget => t !== null),
    skippedPhaseIds: normalizeStepIds(r.skippedPhaseIds ?? r.skipped_phase_ids),
  };
}

function normalizeSnapshot(coordinatorId: number, raw: unknown): CoordinatorStateSnapshot {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    coordinatorId,
    mode: normalizeMode(record.mode),
    onboardingStep: normalizeStep(record.onboardingStep ?? record.onboarding_step),
    startedAt: normalizeString(record.startedAt ?? record.started_at),
    endedAt: normalizeString(record.endedAt ?? record.ended_at),
    completedStepIds: normalizeStepIds(record.completedStepIds ?? record.completed_step_ids),
    skippedStepIds: normalizeStepIds(record.skippedStepIds ?? record.skipped_step_ids),
    skippedPhaseIds: normalizeStepIds(record.skippedPhaseIds ?? record.skipped_phase_ids),
    introWatched: (record.introWatched ?? record.intro_watched) === true,
    onboardingDeferred: (record.onboardingDeferred ?? record.onboarding_deferred) === true,
    onboarding: normalizeOnboardingRender(record.onboarding),
  };
}

function parseCoordinatorId(value: number | string): number {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid coordinator id: ${value}`);
  }
  return parsed;
}

/** Fetch the current Coordinator/State snapshot. */
export async function fetchCoordinatorState(
  coordinatorId: number | string
): Promise<CoordinatorStateSnapshot> {
  const user = await getCurrentUser();
  if (!user?.apiKey) {
    throw new Error('Unauthorized');
  }
  const numericId = parseCoordinatorId(coordinatorId);
  const client = await getOrchestraUserClient(user.apiKey);
  const response = await client.get(`/assistant/${numericId}/state`);
  const info = (response.data as { info?: unknown })?.info ?? response.data;
  return normalizeSnapshot(numericId, info);
}

/** Patch the Coordinator/State snapshot (mode and/or onboarding step). */
export async function updateCoordinatorState(
  coordinatorId: number | string,
  patch: CoordinatorStatePatch
): Promise<CoordinatorStateSnapshot> {
  const user = await getCurrentUser();
  if (!user?.apiKey) {
    throw new Error('Unauthorized');
  }
  const numericId = parseCoordinatorId(coordinatorId);

  const body: Record<string, unknown> = {};
  if (patch.mode !== undefined) body.mode = patch.mode;
  if (patch.onboardingStep !== undefined) body.onboardingStep = patch.onboardingStep;
  if (patch.clearOnboardingStep) body.clearOnboardingStep = true;
  if (patch.skipOnboardingStep !== undefined) body.skipOnboardingStep = patch.skipOnboardingStep;
  if (patch.unskipOnboardingStep !== undefined)
    body.unskipOnboardingStep = patch.unskipOnboardingStep;
  if (patch.resetOnboardingStep !== undefined) body.resetOnboardingStep = patch.resetOnboardingStep;
  if (patch.skipOnboardingPhase !== undefined) body.skipOnboardingPhase = patch.skipOnboardingPhase;
  if (patch.unskipOnboardingPhase !== undefined)
    body.unskipOnboardingPhase = patch.unskipOnboardingPhase;
  if (patch.introWatched !== undefined) body.introWatched = patch.introWatched;
  if (patch.onboardingDeferred !== undefined) body.onboardingDeferred = patch.onboardingDeferred;

  const client = await getOrchestraUserClient(user.apiKey);
  const response = await client.patch(`/assistant/${numericId}/state`, body);
  const info = (response.data as { info?: unknown })?.info ?? response.data;
  return normalizeSnapshot(numericId, info);
}
