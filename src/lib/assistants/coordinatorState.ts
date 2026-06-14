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
  /**
   * Whether the user has resolved the opening picker (started the call
   * or chose chat). Once true the ringing picker and auto-playing intro
   * are never shown again on load — the intro is replayed on demand
   * from the onboarding pane. One-way sticky server-side.
   */
  introWatched: boolean;
}

export interface CoordinatorStatePatch {
  mode?: CoordinatorMode;
  onboardingStep?: string;
  clearOnboardingStep?: boolean;
  skipOnboardingStep?: string;
  introWatched?: boolean;
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
    introWatched: (record.introWatched ?? record.intro_watched) === true,
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
  if (patch.introWatched !== undefined) body.introWatched = patch.introWatched;

  const client = await getOrchestraUserClient(user.apiKey);
  const response = await client.patch(`/assistant/${numericId}/state`, body);
  const info = (response.data as { info?: unknown })?.info ?? response.data;
  return normalizeSnapshot(numericId, info);
}
