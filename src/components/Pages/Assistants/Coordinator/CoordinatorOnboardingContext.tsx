'use client';

/**
 * Shared onboarding-step state for the Coordinator gradual-onboarding flow.
 * The two surfaces that render the step list — the gradual-view
 * sidebar and the coordinator's assistant info panel "Onboarding"
 * sub-tab — both consume this context so the user's per-session
 * progress survives the gradual ↔ info-panel layout transition
 * (which mounts / unmounts distinct subtrees).
 *
 * Action handlers (connect-workspace, connect-apps, …) are
 * deliberately *not* on the context — they're surface-specific (e.g.
 * connect-apps opens a docked side tab in the gradual view but is a
 * no-op in the info-panel surface) and so each surface threads its
 * own handlers down to the shared ``CoordinatorOnboardingChecklist``
 * component as props.
 *
 * The provider lives in ``Main.tsx`` so the underlying state is
 * always mounted while the user is on the assistants page.
 * Consumers fall through gracefully when the context isn't
 * provided — onboarding UI shows everything as pending against an
 * empty completed set and silently ignores ``markStepCompleted``.
 */

import * as React from 'react';
import type { OnboardingRender } from '@/lib/assistants/coordinatorState';

export interface CoordinatorOnboardingContextValue {
  /** Per-session record of which onboarding steps the user has
   * *actually* finished. Drives the strikethrough on the step row and the prereq-satisfaction logic for downstream rows.
   * Lives in ``Main.tsx`` so the set survives the gradual-view →
   * info-panel layout swap.
   *
   * Several steps (connect-apps, task, watch-and-guide) flip
   * to "done" only when their underlying real-world state lands —
   * a token saved, a task created, an action observed running —
   * rather than on the row click that opened the surface. The
   * engagement bookkeeping is kept separately on
   * ``engagedStepIds``. */
  completedStepIds: ReadonlySet<string>;
  /** Idempotently records a step as completed. Re-marking a step
   * already in the set is a no-op (no extra render). */
  markStepCompleted: (stepId: string) => void;
  /** Clears local completion, skip, and engagement state for a group of
   * checklist leaves so the user can walk that section again. */
  resetStepProgress: (stepIds: readonly string[], resetStepId?: string) => void;
  /** Steps the user has locally rewound even if Orchestra can still
   * derive them from durable domain state. */
  resetStepIds: ReadonlySet<string>;
  /** Per-session record of steps the user explicitly chose not to do.
   * Skipped steps satisfy downstream prerequisites, but remain
   * visually distinct from genuinely completed steps. */
  skippedStepIds: ReadonlySet<string>;
  /** Idempotently records a step as skipped. */
  markStepSkipped: (stepId: string) => void;
  /** Idempotently returns a skipped step to the active checklist. */
  markStepUnskipped: (stepId: string) => void;
  /** Per-session record of which onboarding steps the user has
   * *entered* — i.e. clicked into the corresponding surface
   * (integrations / tasks / actions tab in the gradual view).
   * Drives right-section tab visibility so the tab unlocks the
   * moment the user opens the row, even though the row itself
   * stays "pending" until the real underlying action lands. */
  engagedStepIds: ReadonlySet<string>;
  /** Idempotently records a step as engaged. Marking complete also
   * marks engaged automatically (see ``Main.tsx``) so callers
   * generally only invoke this for the click-but-not-yet-done
   * transition. */
  markStepEngaged: (stepId: string) => void;
  /** Whether onboarding scaffolding is live. When false the checklist
   * collapses to a return affordance and every onboarding nudge is
   * suppressed (server-side too) without altering per-step state. */
  onboardingActive: boolean;
  /** Pause onboarding so the user can start using the platform first. */
  setOnboardingActive: (active: boolean) => void;
  /** Server-computed onboarding rendering (steps + statuses + valid next
   * targets). The checklist renders directly from this — availability
   * and ordering are no longer computed client-side. ``null`` outside
   * active onboarding. */
  onboarding: OnboardingRender | null;
  /** One-shot request issued when the first-login intro hands off to
   * the platform. The checklist consumes it by opening Communication /
   * Email, then acknowledges it so later mounts use normal defaults. */
  firstLoginCommunicationEmailOpenRequest: number;
  acknowledgeFirstLoginCommunicationEmailOpen: () => void;
}

const CoordinatorOnboardingContext = React.createContext<CoordinatorOnboardingContextValue | null>(
  null
);

export const CoordinatorOnboardingProvider = CoordinatorOnboardingContext.Provider;

export function useCoordinatorOnboardingContext(): CoordinatorOnboardingContextValue | null {
  return React.useContext(CoordinatorOnboardingContext);
}
