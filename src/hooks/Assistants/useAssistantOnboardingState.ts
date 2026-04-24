/**
 * useAssistantOnboardingState — derives the in-panel setup roadmap
 * for a single assistant.
 *
 * The roadmap lives inline in the "Onboarding" tab of the assistant
 * info side panel (not a modal, not a banner). Steps are grouped into
 * thematic accordion sections with a top-level progress bar tracking
 * atomic sub-step completion. Once every step resolves, the whole
 * Onboarding tab disappears from the panel — the panel falls back to
 * pure Contact Info and the post-hire scaffolding politely retires.
 *
 * Persistence (per assistant, in localStorage):
 *   - `resolved`: a set of step ids the user has explicitly completed
 *     or dismissed. Used for steps with no backend signal (`install`,
 *     `integrations`) and for individual rows the user dismisses with
 *     the X button. Backend-derivable steps (e.g. email set, call made)
 *     don't need an entry here — they fall out automatically when the
 *     underlying state flips.
 *   - `prefillClickedAt`: ISO timestamps recording when the user
 *     activated a chat-prefill step (Ask for email / Ask for callback).
 *     We compare against the latest user-message timestamp from chat
 *     history to detect "they actually sent the message after asking",
 *     which works across sessions since transcripts come back with
 *     their original timestamps.
 *
 * The "hide for now" recovery pill from the previous design was
 * removed — Onboarding/Contact tabs make global dismissal unnecessary.
 */

import * as React from 'react';
import type { Assistant } from '@/types/assistants/assistant';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Atomic step ids. Each step is one tick on the progress bar and one
 * row in its parent group. Channel ids deliberately reuse contact
 * type names (`email`, `phone`) so contact-manager wiring shares keys
 * without a translation table.
 */
export type OnboardingStepId =
  | 'hire'
  | 'sayHi'
  | 'voiceCall'
  | 'email'
  | 'emailAsk'
  | 'phoneOnProfile'
  | 'phone'
  | 'phoneAsk'
  | 'install'
  | 'integrations';

/**
 * Group ids — one accordion section per group. Order in this list is
 * the display order in the panel; per-group step order is fixed in
 * `GROUPS` below.
 */
export type OnboardingGroupId =
  | 'started'
  | 'breakIce'
  | 'exchangeEmails'
  | 'getOnCall'
  | 'install'
  | 'integrations';

export interface OnboardingStep {
  id: OnboardingStepId;
  /** True when the underlying state shows the step is done. */
  isConfigured: boolean;
  /** True when the user explicitly resolved/dismissed the step. */
  isResolvedManually: boolean;
  /** True when the step is finished for any reason. */
  isResolved: boolean;
  /**
   * Step that must be configured before this step is actionable.
   * `undefined` when there's no dependency OR when the prerequisite
   * is already satisfied. UI uses this to render the row in a
   * disabled state with a tooltip pointing at the missing prereq —
   * keeping the data model authoritative about ordering and the
   * presentation layer free of business rules.
   */
  prerequisiteStepId?: OnboardingStepId;
  /**
   * True when this step is informational / never counts toward
   * completion. Optional steps still render but are excluded from
   * progress totals, group `isComplete`, and tab-visibility gating.
   * Used today only by `integrations`, which is a perpetually-open
   * launcher list rather than a one-shot checkbox.
   */
  isOptional: boolean;
}

export interface OnboardingGroup {
  id: OnboardingGroupId;
  steps: OnboardingStep[];
  /** All sub-steps in the group are resolved. */
  isComplete: boolean;
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const GLOBAL_DISABLE_KEY = 'console:assistants:onboarding:disabled';

export interface OnboardingPersistedState {
  resolved?: OnboardingStepId[];
  prefillClickedAt?: Partial<Record<OnboardingStepId, string>>;
}

export const onboardingStateKey = (agentId: string | number) =>
  `console:assistants:onboarding:state:${agentId}`;

export function readOnboardingState(agentId: string | number): OnboardingPersistedState {
  try {
    const raw = window.localStorage.getItem(onboardingStateKey(agentId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OnboardingPersistedState | null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// Custom DOM event fired after every same-document write so that
// other consumers in the same tab (e.g. the cross-assistant
// summaries hook driving the list-item dot) can re-derive
// immediately. The browser's native `storage` event only fires
// across tabs/windows, so we'd otherwise have a stale dot on the
// list until the user navigated away and back.
export const ONBOARDING_STATE_CHANGE_EVENT = 'console:assistants:onboarding:state-changed';

function writeState(agentId: string | number, state: OnboardingPersistedState): void {
  try {
    window.localStorage.setItem(onboardingStateKey(agentId), JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(ONBOARDING_STATE_CHANGE_EVENT, { detail: { agentId } }));
  } catch {
    /* private mode / quota — ignore */
  }
}

function readGlobalDisabled(): boolean {
  try {
    return window.localStorage.getItem(GLOBAL_DISABLE_KEY) === 'true';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Group + step config
// ---------------------------------------------------------------------------

/**
 * Static group composition. The `install` group only renders for
 * desktop-mode assistants — see `getActiveGroups` for the filter.
 *
 * Order matters: this is the visual order in the Onboarding tab. We
 * lead with the lowest-friction group (Break the ice), then progress
 * through channel setup ordered by setup cost, then the desktop-only
 * install step (if relevant), and finally integrations.
 */
const GROUPS: ReadonlyArray<{ id: OnboardingGroupId; steps: OnboardingStepId[] }> = [
  // `started` is a single always-resolved step ("Hired {name}") that
  // gives the roadmap visible momentum from second one — the user has
  // already done a thing simply by hiring, so we surface that win.
  { id: 'started', steps: ['hire'] },
  { id: 'breakIce', steps: ['sayHi', 'voiceCall'] },
  { id: 'exchangeEmails', steps: ['email', 'emailAsk'] },
  { id: 'getOnCall', steps: ['phoneOnProfile', 'phone', 'phoneAsk'] },
  { id: 'install', steps: ['install'] },
  { id: 'integrations', steps: ['integrations'] },
];

function getActiveGroups(
  assistant: Assistant
): ReadonlyArray<{ id: OnboardingGroupId; steps: OnboardingStepId[] }> {
  return GROUPS.filter((g) => (g.id === 'install' ? !!assistant.isUserDesktop : true));
}

/**
 * Step dependencies — keyed by the dependent step, value is its
 * prerequisite. Single source of truth for the ordering rules so
 * both the panel UI (which renders disabled rows) and any future
 * automation (e.g. analytics that infers blocked progress) stay in
 * sync.
 *
 * Rationale per entry:
 *   - `phone → phoneOnProfile`: Pointless to give the assistant a
 *     phone number to call from when the user has no number on
 *     file for it to call back to.
 *   - `emailAsk → email`: Asking the assistant to email back without
 *     an email address configured guarantees a dead end.
 *   - `phoneAsk → phone`: Same logic for phone callbacks.
 */
const STEP_PREREQUISITES: Partial<Record<OnboardingStepId, OnboardingStepId>> = {
  phone: 'phoneOnProfile',
  emailAsk: 'email',
  phoneAsk: 'phone',
};

/**
 * Steps that are informational / perpetually open and therefore
 * excluded from progress counting. They still render so the user
 * can engage with them at will, but they don't keep the Onboarding
 * tab visible after the rest of the checklist is done.
 */
const OPTIONAL_STEPS: ReadonlySet<OnboardingStepId> = new Set<OnboardingStepId>(['integrations']);

/**
 * Inputs to step-completion derivation. Centralised so the hook
 * signature stays small and we don't pass a six-parameter context
 * down through prop drilling.
 */
export interface OnboardingDerivationContext {
  /** ≥1 user message in this assistant's chat history. */
  hasUserMessage: boolean;
  /** ≥1 historical voice/video call recorded for this assistant. */
  hasHistoricalCall: boolean;
  /** Logged-in user has a phone number on their profile. */
  hasUserPhoneNumber: boolean;
  /**
   * Timestamp of the latest user message in this chat. We use it
   * along with the persisted `prefillClickedAt[stepId]` to derive
   * "the user actually sent a message after clicking the prefill".
   */
  latestUserMessageAt: Date | null;
}

function isStepConfigured(
  assistant: Assistant,
  step: OnboardingStepId,
  ctx: OnboardingDerivationContext,
  prefillClickedAt: OnboardingPersistedState['prefillClickedAt']
): boolean {
  switch (step) {
    case 'hire':
      // The mere existence of an `Assistant` instance proves the hire
      // step is done — there's no other way to land in this hook.
      return true;
    case 'sayHi':
      return ctx.hasUserMessage;
    case 'voiceCall':
      return ctx.hasHistoricalCall;
    case 'email':
      return !!assistant.email && assistant.email.trim() !== '';
    case 'phone':
      return !!assistant.phone && assistant.phone.trim() !== '';
    case 'phoneOnProfile':
      return ctx.hasUserPhoneNumber;
    case 'emailAsk':
    case 'phoneAsk': {
      // Done only after the user actually sent a message FOLLOWING
      // the prefill click. Comparing timestamps cleanly handles both
      // "sent during this session" and "sent in a previous session"
      // (transcripts return with their original timestamps).
      const clickedAtRaw = prefillClickedAt?.[step];
      if (!clickedAtRaw || !ctx.latestUserMessageAt) return false;
      const clickedAt = new Date(clickedAtRaw);
      return ctx.latestUserMessageAt.getTime() > clickedAt.getTime();
    }
    case 'install':
      // No backend signal — done when the user has at least seen the
      // install instructions (see roadmap component, which calls
      // markResolved on click).
      return false;
    case 'integrations':
      // Optional / never-counted step — the integrations group is a
      // perpetual launcher list rather than a one-shot checkbox, so
      // we don't auto-resolve on platform-launcher click. Returning
      // `false` is harmless because the step is excluded from
      // progress totals via `OPTIONAL_STEPS` anyway; the launcher
      // body still renders inside the group for user engagement.
      return false;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseAssistantOnboardingStateOptions extends OnboardingDerivationContext {}

export interface UseAssistantOnboardingStateResult {
  /** All groups in display order, with their resolved sub-steps. */
  groups: OnboardingGroup[];
  /** Total number of atomic steps across all groups. */
  totalSteps: number;
  /** Number of resolved atomic steps across all groups. */
  resolvedSteps: number;
  /** True iff there's any unresolved step left. */
  hasOutstanding: boolean;
  /** True when the roadmap should render at all (assistant + not globally disabled + has work). */
  shouldShowRoadmap: boolean;
  /** Mark a step as explicitly resolved (covers "completed" and "skipped" semantics). */
  markResolved: (id: OnboardingStepId) => void;
  /** Record that the user activated a chat prefill — sets clickedAt to now. */
  recordPrefillClick: (id: OnboardingStepId) => void;
}

export function useAssistantOnboardingState(
  assistant: Assistant | null,
  ctx: UseAssistantOnboardingStateOptions
): UseAssistantOnboardingStateResult {
  const [persisted, setPersisted] = React.useState<OnboardingPersistedState>({});
  const [globalDisabled, setGlobalDisabled] = React.useState<boolean>(false);

  React.useEffect(() => {
    setGlobalDisabled(readGlobalDisabled());
    setPersisted(assistant ? readOnboardingState(assistant.agentId) : {});
  }, [assistant]);

  const writeAndSet = React.useCallback(
    (next: OnboardingPersistedState) => {
      if (!assistant) return;
      writeState(assistant.agentId, next);
      setPersisted(next);
    },
    [assistant]
  );

  const markResolved = React.useCallback(
    (id: OnboardingStepId) => {
      const resolved = new Set(persisted.resolved ?? []);
      resolved.add(id);
      writeAndSet({ ...persisted, resolved: Array.from(resolved) });
    },
    [persisted, writeAndSet]
  );

  const recordPrefillClick = React.useCallback(
    (id: OnboardingStepId) => {
      writeAndSet({
        ...persisted,
        prefillClickedAt: {
          ...(persisted.prefillClickedAt ?? {}),
          [id]: new Date().toISOString(),
        },
      });
    },
    [persisted, writeAndSet]
  );

  const resolvedSet = React.useMemo(() => new Set(persisted.resolved ?? []), [persisted.resolved]);

  const groups = React.useMemo<OnboardingGroup[]>(() => {
    if (!assistant) return [];
    const active = getActiveGroups(assistant);
    // First pass: build a flat configured-set so step prerequisites
    // can resolve against the live picture (a step's prereq may be in
    // a different group).
    const configuredSet = new Set<OnboardingStepId>();
    for (const g of active) {
      for (const id of g.steps) {
        if (isStepConfigured(assistant, id, ctx, persisted.prefillClickedAt)) {
          configuredSet.add(id);
        }
      }
    }
    return active.map((g) => {
      const steps: OnboardingStep[] = g.steps.map((id) => {
        const isConfigured = configuredSet.has(id);
        const isResolvedManually = resolvedSet.has(id);
        const isOptional = OPTIONAL_STEPS.has(id);
        const prereq = STEP_PREREQUISITES[id];
        const prerequisiteStepId = prereq && !configuredSet.has(prereq) ? prereq : undefined;
        return {
          id,
          isConfigured,
          isResolvedManually,
          isResolved: isConfigured || isResolvedManually,
          prerequisiteStepId,
          isOptional,
        };
      });
      // Optional steps are excluded from the group's complete check —
      // an integrations-only group would otherwise never flip to
      // complete (since its sole step never auto-resolves), keeping
      // the Onboarding tab visible forever after every other piece
      // is done.
      const countableSteps = steps.filter((s) => !s.isOptional);
      const isComplete = countableSteps.length > 0 && countableSteps.every((s) => s.isResolved);
      return { id: g.id, steps, isComplete };
    });
  }, [assistant, ctx, persisted.prefillClickedAt, resolvedSet]);

  // Counts deliberately exclude optional steps so the "X of N done"
  // badge can actually reach N — see OPTIONAL_STEPS rationale.
  const totalSteps = React.useMemo(
    () => groups.reduce((acc, g) => acc + g.steps.filter((s) => !s.isOptional).length, 0),
    [groups]
  );
  const resolvedSteps = React.useMemo(
    () =>
      groups.reduce(
        (acc, g) => acc + g.steps.filter((s) => !s.isOptional && s.isResolved).length,
        0
      ),
    [groups]
  );
  const hasOutstanding = resolvedSteps < totalSteps;
  const shouldShowRoadmap = !!assistant && !globalDisabled && hasOutstanding;

  return {
    groups,
    totalSteps,
    resolvedSteps,
    hasOutstanding,
    shouldShowRoadmap,
    markResolved,
    recordPrefillClick,
  };
}

// ---------------------------------------------------------------------------
// Cross-assistant summary (used for list-item "needs attention" badges)
// ---------------------------------------------------------------------------

export interface OnboardingSummary {
  totalSteps: number;
  resolvedSteps: number;
  hasOutstanding: boolean;
}

/**
 * Pure (no React, no DOM) summary computation. Mirrors the per-step
 * resolution logic the panel uses but returns just the counts — meant
 * to be called for many assistants at once (e.g. to badge incomplete
 * assistants in the sidebar list).
 */
export function summarizeOnboarding(
  assistant: Assistant,
  ctx: OnboardingDerivationContext,
  persisted: OnboardingPersistedState
): OnboardingSummary {
  const active = getActiveGroups(assistant);
  const resolvedSet = new Set(persisted.resolved ?? []);
  let total = 0;
  let resolved = 0;
  for (const g of active) {
    for (const stepId of g.steps) {
      // Optional steps don't count — see OPTIONAL_STEPS in the hook.
      if (OPTIONAL_STEPS.has(stepId)) continue;
      total += 1;
      const isConfigured = isStepConfigured(assistant, stepId, ctx, persisted.prefillClickedAt);
      if (isConfigured || resolvedSet.has(stepId)) resolved += 1;
    }
  }
  return {
    totalSteps: total,
    resolvedSteps: resolved,
    hasOutstanding: resolved < total,
  };
}
