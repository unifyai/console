'use client';

/**
 * CoordinatorOnboardingChecklist — the gating-aware checklist body
 * that surfaces the user's progress through Coordinator onboarding.
 *
 * Rendered in the coordinator's assistant info panel "Onboarding"
 * sub-tab on the ``/assistants`` shell, surfaced whenever the
 * coordinator is the selected assistant.
 *
 * Shared state (``completedStepIds``) comes from
 * ``CoordinatorOnboardingContext`` so it survives across surfaces and
 * reloads. Action handlers are passed in as props because they're
 * surface-specific — e.g. connect-apps opens a docked side tab in
 * the gradual view but degrades to a static row in the info panel,
 * where the user already has the base shell's full chrome at hand.
 *
 * Step gating mirrors the per-assistant ``AssistantSetupRoadmap``
 * pattern: each pending row may declare a prerequisite step id, and
 * the row stays disabled (with a tooltip explaining the missing
 * prereq) until that prerequisite is marked done.
 */

import * as React from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { InfoSquareButton } from '@/components/UI/info-square-button';
import { cn } from '@/lib/utils';
import { useCoordinatorOnboardingContext } from './CoordinatorOnboardingContext';

export type ChecklistAction =
  | 'start-email-reply'
  | 'add-whatsapp-number'
  | 'start-whatsapp-message'
  | 'start-whatsapp-call'
  | 'add-phone-number'
  | 'start-sms-message'
  | 'start-phone-call'
  | 'connect-slack'
  | 'start-slack-message'
  | 'connect-discord'
  | 'start-discord-message'
  | 'connect-workspace'
  | 'connect-apps'
  | 'act'
  | 'schedule';

interface OnboardingChecklistItem {
  id: string;
  title: string;
  /** Short label used in the segmented progress bar legend — kept
   * to a single word so the three phases fit comfortably across
   * the sidebar width. Only meaningful on top-level (phase) items;
   * unused on children. Falls back to ``title`` when unset. */
  phaseLabel?: string;
  /** Short one-line description shown on the info tooltip — answers
   * "why does this step matter?" so the user can decide whether to
   * engage before clicking through. Keep terse; the tooltip is a
   * hint, not a doc. */
  description?: string;
  /** Rough time estimate ("~30s", "~2min") surfaced in the info
   * tooltip. Optional because some steps (e.g. group headers) are
   * compounded and don't have a single-number estimate. */
  estimatedTime?: string;
  /** When set, clicking the row dispatches this action via the
   * surface-supplied handler. Items without an action render as
   * static (informational) rows. */
  action?: ChecklistAction;
  /** Step that must be completed before this row becomes
   * actionable. Resolved against ``completedStepIds``. */
  prerequisiteId?: string;
  /** Sub-items render under the parent and count separately toward the
   * progress bar — same accounting model as the per-assistant setup
   * roadmap. */
  children?: OnboardingChecklistItem[];
}

const ONBOARDING_CHECKLIST: OnboardingChecklistItem[] = [
  {
    id: 'meet',
    title: 'Meet me',
    phaseLabel: 'Meet',
    description: 'Say hi to me.',
    estimatedTime: '~1 min',
  },
  {
    id: 'comms',
    title: 'Guess the reference',
    phaseLabel: 'Quiz',
    description: 'Identify clues sent over email, WhatsApp, phone, Slack, and Discord.',
    children: [
      {
        id: 'email-reply',
        title: 'Reply to email',
        description: 'Marty sends you a quick email.',
        estimatedTime: '~30s',
        action: 'start-email-reply',
        prerequisiteId: 'meet',
      },
      {
        id: 'whatsapp-number',
        title: 'Add your WhatsApp number',
        description: 'Add the WhatsApp number Marty should use.',
        estimatedTime: '~30s',
        action: 'add-whatsapp-number',
        prerequisiteId: 'email-reply',
      },
      {
        id: 'whatsapp-message',
        title: 'Guess a WhatsApp clue',
        description: 'Marty sends you a reference clue over WhatsApp.',
        estimatedTime: '~1 min',
        action: 'start-whatsapp-message',
        prerequisiteId: 'whatsapp-number',
      },
      {
        id: 'whatsapp-call',
        title: 'Guess a WhatsApp call clue',
        description: 'Marty gives you a reference clue over WhatsApp voice.',
        estimatedTime: '~1 min',
        action: 'start-whatsapp-call',
        prerequisiteId: 'whatsapp-message',
      },
      {
        id: 'phone-number',
        title: 'Add your phone number',
        description: 'Add the phone number Marty should use for calls and SMS.',
        estimatedTime: '~30s',
        action: 'add-phone-number',
        prerequisiteId: 'whatsapp-call',
      },
      {
        id: 'sms-message',
        title: 'Guess an SMS clue',
        description: 'Marty sends you a reference clue over SMS.',
        estimatedTime: '~1 min',
        action: 'start-sms-message',
        prerequisiteId: 'phone-number',
      },
      {
        id: 'phone-call',
        title: 'Guess a phone call clue',
        description: 'Marty gives you a reference clue over a phone call.',
        estimatedTime: '~1 min',
        action: 'start-phone-call',
        prerequisiteId: 'sms-message',
      },
      {
        id: 'slack-connect',
        title: 'Connect Slack',
        description: 'Connect Marty through the Unify Slack app.',
        estimatedTime: '~1 min',
        action: 'connect-slack',
        prerequisiteId: 'phone-call',
      },
      {
        id: 'slack-message',
        title: 'Guess a Slack clue',
        description: 'Marty sends you a reference clue in Slack.',
        estimatedTime: '~1 min',
        action: 'start-slack-message',
        prerequisiteId: 'slack-connect',
      },
      {
        id: 'discord-connect',
        title: 'Connect Discord',
        description: 'Connect Marty through the public Discord bot.',
        estimatedTime: '~1 min',
        action: 'connect-discord',
        prerequisiteId: 'slack-message',
      },
      {
        id: 'discord-message',
        title: 'Guess a Discord clue',
        description: 'Marty sends you a reference clue in Discord.',
        estimatedTime: '~1 min',
        action: 'start-discord-message',
        prerequisiteId: 'discord-connect',
      },
    ],
  },
  {
    id: 'connect',
    title: 'Connect me',
    phaseLabel: 'Connect',
    description: 'Plug me into your workspace and apps.',
    // No action: the parent row is purely a grouping header; the
    // workspace OAuth + integrations actions live on its children.
    children: [
      {
        id: 'workspace',
        title: 'Give me access to your workspace',
        description: 'Required for everything else in onboarding.',
        estimatedTime: '~30s',
        action: 'connect-workspace',
        prerequisiteId: 'discord-message',
      },
      {
        id: 'apps',
        title: 'Connect me with your apps',
        description: 'Hook up at least one app (Slack, Gmail…).',
        estimatedTime: '~2 min',
        action: 'connect-apps',
        prerequisiteId: 'workspace',
      },
    ],
  },
  {
    id: 'work',
    title: 'Get work done',
    phaseLabel: 'Delegate',
    description: 'Hand off real work and see it run.',
    // Grouping row. The right-section panels (Actions, then Tasks)
    // surface alongside the children as each is engaged.
    children: [
      {
        // Point-in-time work: the user asks for something now and
        // watches it run live in the Actions panel. Completion is
        // observed off the live-actions feed (an action started),
        // NOT the scheduled-Tasks list — a "do X now" request never
        // creates a scheduled task, so gating this on the Tasks
        // count would strand the user here. The old separate "watch
        // and guide" row is folded in: asking + watching it run is
        // a single moment on the Actions panel.
        id: 'act',
        title: 'Ask me to do something now',
        description: 'Give me a one-off job and watch it run live.',
        estimatedTime: '~2 min',
        action: 'act',
        prerequisiteId: 'apps',
      },
      {
        // Time- or event-bound work: this is what the product calls
        // a "Task" — it lands in the Coordinator's Tasks context and
        // shows in the Tasks panel. Completion is the Tasks count
        // going non-zero.
        id: 'schedule',
        title: 'Schedule a task for later',
        description: 'Set up a recurring or event-triggered task.',
        estimatedTime: '~1 min',
        action: 'schedule',
        prerequisiteId: 'act',
      },
    ],
  },
];

/**
 * Static, read-only "try one of these" prompts that surface as
 * chips under the ``act`` and ``schedule`` rows while each is still
 * the current step.
 *
 * Intentionally non-interactive: the chips are inspiration, not a
 * UI to click. They disappear the moment their row lands (it flips
 * to ``done`` and the body becomes a strikethrough label). Keeping
 * them inert means we don't need a transport (chat-send vs call-
 * inject) and the same chip reads the same in chat and call.
 *
 * They're split by row so each chip matches what *completes* that
 * step — the earlier single list mixed point-in-time prompts with a
 * scheduled one under a step that only completed on a scheduled
 * task, which sent users down a dead end.
 *
 * ``ACT`` — point-in-time jobs that run immediately and show in the
 * Actions panel. The set is further split by *medium* so each chip's
 * output is naturally consumable on the channel the user is actually
 * using right now:
 *  - ``ACT…_CHAT``  jobs whose result reads well as text in the
 *    transcript (a summary, a news digest, a drafted reply).
 *  - ``ACT…_CALL``  jobs whose result is naturally delivered out
 *    loud or interactively on a voice call (walking a website via
 *    screen-share + vision, reading the calendar aloud, an inbox
 *    readout). Suggesting "summarize my emails" on a call would dump
 *    a wall of text the caller can't hear; suggesting "walk me
 *    through this website" in chat has nothing to walk through.
 * Both sets span distinct capability dimensions so the strip stays a
 * tiny tour rather than three variations on one trick.
 *
 * ``SCHEDULE`` — time- or event-bound tasks that land in the Tasks
 * context (recurrence, future delivery, event triggers). Medium-
 * agnostic: a scheduled task's output is delivered later, not on the
 * current channel, so the same chips read fine in chat or on a call:
 *  - ``morning-briefing`` future + recurring proactive delivery.
 *  - ``weekly-recap``     recurrence on a weekly cadence.
 *  - ``email-trigger``    event-driven (fires on an inbound email).
 *
 * Gating is intentional too: we *don't* hide chips whose
 * preconditions aren't satisfied. A chip describing email
 * summarization is also a prompt to connect email — gating it
 * defeats that side effect.
 */
const ACT_SUGGESTED_WORKFLOWS_CHAT: ReadonlyArray<{
  id: string;
  label: string;
}> = [
  { id: 'summarize-email', label: 'Summarize my unread emails' },
  { id: 'catch-up-news', label: "Catch me up on today's news" },
  { id: 'draft-reply', label: 'Draft a reply to my latest email' },
];

const ACT_SUGGESTED_WORKFLOWS_CALL: ReadonlyArray<{
  id: string;
  label: string;
}> = [
  { id: 'screen-share', label: 'Walk me through this website' },
  { id: 'next-meetings', label: 'Tell me about my next meetings' },
  { id: 'inbox-readout', label: 'Read me a rundown of my inbox' },
];

const SCHEDULE_SUGGESTED_WORKFLOWS: ReadonlyArray<{
  id: string;
  label: string;
}> = [
  { id: 'morning-briefing', label: 'Send me a briefing tomorrow at 8am' },
  { id: 'weekly-recap', label: 'Every Friday, recap my week' },
  { id: 'email-trigger', label: 'When I get an email from my boss, alert me' },
];

interface ResolvedChecklistItem extends OnboardingChecklistItem {
  done: boolean;
  skipped: boolean;
  status: 'pending' | 'done' | 'skipped';
  children?: ResolvedChecklistItem[];
}

/**
 * Walks ``ONBOARDING_CHECKLIST`` once, attaching the resolved
 * ``done`` flag + disabled-tooltip text per row. Returning a
 * separate ``ResolvedChecklistItem`` keeps the static config and
 * the per-render derived state cleanly separated.
 *
 * Parent rows auto-resolve to ``done`` once every child is done —
 * the parent itself is rarely in ``completedStepIds`` directly
 * (the workspace OAuth dialog marks ``workspace``, not ``connect``)
 * so we lift that signal up from the children instead. Same
 * accounting model as the per-assistant setup roadmap.
 */
function resolveChecklist(
  items: OnboardingChecklistItem[],
  completed: ReadonlySet<string>,
  skipped: ReadonlySet<string>
): ResolvedChecklistItem[] {
  return items.map((item) => {
    const resolvedChildren = item.children
      ? resolveChecklist(item.children, completed, skipped)
      : undefined;
    const childrenAllDone =
      !!resolvedChildren?.length && resolvedChildren.every((child) => child.status === 'done');
    const childrenAllResolved =
      !!resolvedChildren?.length && resolvedChildren.every((child) => child.status !== 'pending');
    const childrenHaveSkipped =
      !!resolvedChildren?.length && resolvedChildren.some((child) => child.status === 'skipped');
    const done = completed.has(item.id) || childrenAllDone;
    const skippedStep = !done && skipped.has(item.id);
    const skippedByChildren = !done && childrenAllResolved && childrenHaveSkipped;
    const skippedResolved = skippedStep || skippedByChildren;
    const status = done ? 'done' : skippedResolved ? 'skipped' : 'pending';
    return {
      ...item,
      done,
      skipped: skippedResolved,
      status,
      children: resolvedChildren,
    };
  });
}

function filterVisibleChecklist(
  items: ResolvedChecklistItem[],
  completed: ReadonlySet<string>,
  skipped: ReadonlySet<string>,
  isActionWired: (action: ChecklistAction | undefined) => boolean,
  canMarkLater: boolean,
  hiddenIds: Set<string> = new Set(),
  // Steps hidden because they're *not applicable* on this deployment
  // (configured action with no wired handler — e.g. workspace OAuth with
  // no provider). Tracked separately from ``hiddenIds`` so a dependent
  // step treats a not-applicable prerequisite as satisfied rather than
  // getting hidden alongside it.
  unavailableIds: Set<string> = new Set()
): ResolvedChecklistItem[] {
  const visibleItems: ResolvedChecklistItem[] = [];

  for (const item of items) {
    const filteredChildren = item.children
      ? filterVisibleChecklist(
          item.children,
          completed,
          skipped,
          isActionWired,
          canMarkLater,
          hiddenIds,
          unavailableIds
        )
      : undefined;
    const hasVisibleChildren = !!filteredChildren?.length;
    const isResolved = item.status !== 'pending';
    const prereqSatisfied =
      !item.prerequisiteId ||
      completed.has(item.prerequisiteId) ||
      skipped.has(item.prerequisiteId) ||
      unavailableIds.has(item.prerequisiteId);
    // A prerequisite hidden because it's *not applicable* doesn't block
    // its dependents — it counts as satisfied above. Only a prerequisite
    // hidden for other reasons keeps the dependent out of view.
    const prereqHidden =
      !!item.prerequisiteId &&
      hiddenIds.has(item.prerequisiteId) &&
      !unavailableIds.has(item.prerequisiteId);
    // A leaf whose action is *configured* but not wired in the current
    // surface is not applicable on this deployment (e.g. the workspace
    // OAuth step when no Google/Microsoft provider is configured). We
    // hide it entirely rather than surfacing a dead — or merely
    // skippable — row that the user can never actually complete here.
    const actionUnavailable = !!item.action && !isActionWired(item.action);
    const canDeferNow = canMarkLater && !item.children?.length && !actionUnavailable;
    const canActNow =
      item.status === 'pending' &&
      prereqSatisfied &&
      !prereqHidden &&
      !actionUnavailable &&
      (isActionWired(item.action) || canDeferNow);

    if (!isResolved && !hasVisibleChildren && !canActNow) {
      hiddenIds.add(item.id);
      if (actionUnavailable) unavailableIds.add(item.id);
      continue;
    }

    if (hasVisibleChildren) {
      const childrenAllDone = filteredChildren.every((child) => child.status === 'done');
      const childrenAllResolved = filteredChildren.every((child) => child.status !== 'pending');
      const childrenHaveSkipped = filteredChildren.some((child) => child.status === 'skipped');
      const done = item.done || childrenAllDone;
      const skippedResolved =
        !done && (item.skipped || (childrenAllResolved && childrenHaveSkipped));
      visibleItems.push({
        ...item,
        done,
        skipped: skippedResolved,
        status: done ? 'done' : skippedResolved ? 'skipped' : 'pending',
        children: filteredChildren,
      });
    } else {
      visibleItems.push({
        ...item,
        children: filteredChildren,
      });
    }
  }

  return visibleItems;
}

function countItems(items: ResolvedChecklistItem[]): { total: number; resolved: number } {
  let total = 0;
  let resolved = 0;
  for (const item of items) {
    if (item.children?.length) {
      // Parent rows that have children aren't independently scored —
      // the children carry the weight, so the progress bar reflects
      // the real granularity of remaining work.
      for (const child of item.children) {
        total += 1;
        if (child.status !== 'pending') resolved += 1;
      }
    } else {
      total += 1;
      if (item.status !== 'pending') resolved += 1;
    }
  }
  return { total, resolved };
}

interface PhaseProgress {
  id: string;
  label: string;
  total: number;
  resolved: number;
}

/**
 * Collapse the top-level checklist into one phase per row so the
 * progress bar can show distinct segments (Meet / Connect /
 * Delegate) instead of a single anonymous fill. Each phase counts
 * its own leaves: parent rows with children contribute their
 * children's totals, leaf-only phases contribute themselves. The
 * label prefers ``phaseLabel`` (a single word) over the full
 * ``title`` so the three legends fit across the sidebar.
 */
function computePhases(items: ResolvedChecklistItem[]): PhaseProgress[] {
  return items.map((item) => {
    const label = item.phaseLabel ?? item.title;
    const children = item.children ?? [];
    if (children.length) {
      const total = children.length;
      const resolved = children.filter((child) => child.status !== 'pending').length;
      return { id: item.id, label, total, resolved };
    }
    return { id: item.id, label, total: 1, resolved: item.status !== 'pending' ? 1 : 0 };
  });
}

/**
 * Identify the next actionable leaf so the UI can call it out with
 * a "Next" affordance. Walks the resolved tree in render order and
 * returns the first pending leaf with a wired
 * action. Returning ``null`` (everything done or everything still
 * hidden) is a non-event — the row variants alone are enough
 * signal at that point.
 */
function findNextActionableId(
  items: ResolvedChecklistItem[],
  isActionWired: (action: ChecklistAction | undefined) => boolean,
  canMarkLater: boolean
): string | null {
  for (const item of items) {
    if (item.children?.length) {
      const inner = findNextActionableId(item.children, isActionWired, canMarkLater);
      if (inner) return inner;
      continue;
    }
    if (item.status === 'pending' && (isActionWired(item.action) || canMarkLater)) {
      return item.id;
    }
  }
  return null;
}

function findNextChildAction(
  item: ResolvedChecklistItem,
  isActionWired: (action: ChecklistAction | undefined) => boolean
): ChecklistAction | null {
  const children = item.children ?? [];
  for (const child of children) {
    if (child.children?.length) {
      const inner = findNextChildAction(child, isActionWired);
      if (inner) return inner;
      continue;
    }
    if (child.status === 'pending' && child.action && isActionWired(child.action)) {
      return child.action;
    }
  }
  return null;
}

/**
 * Whether the coordinator still has an actionable onboarding step
 * outstanding, given which actions are wired (available) on the current
 * deployment. Reuses the same resolve → visibility-filter → next-actionable
 * pipeline the rendered checklist uses, so the "incomplete" signal that
 * drives the info-card nudge and onboarding focus default can't drift from
 * what the user actually sees — unavailable steps don't count, fully
 * skipped/complete checklists report ``false``.
 */
export function hasOutstandingCoordinatorOnboarding(
  completedStepIds: ReadonlySet<string>,
  skippedStepIds: ReadonlySet<string>,
  isActionWired: (action: ChecklistAction | undefined) => boolean
): boolean {
  const resolved = resolveChecklist(ONBOARDING_CHECKLIST, completedStepIds, skippedStepIds);
  const visible = filterVisibleChecklist(
    resolved,
    completedStepIds,
    skippedStepIds,
    isActionWired,
    true
  );
  return findNextActionableId(visible, isActionWired, true) !== null;
}

export interface CoordinatorOnboardingChecklistProps {
  onStartOnboardingStep?: (stepId: string) => void;
  onAddWhatsappNumber?: () => void;
  onAddPhoneNumber?: () => void;
  onConnectSlack?: () => void;
  onConnectDiscord?: () => void;
  /** Opens the workspace OAuth dialog. Hung off the "Give me
   * access to your workspace" sub-item. Unset means
   * the row degrades to a static checklist entry. */
  onConnectWorkspace?: () => void;
  /** Opens the Integrations pane in the current surface. Hung off
   * "Connect me with your apps". Unset means the
   * row degrades to a static entry. */
  onConnectApps?: () => void;
  /** Opens the live Actions viewer in the current surface. Hung off
   * "Ask me to do something now" — the user gives a
   * one-off job and watches it run live. Unset means the row
   * degrades to a static entry. */
  onActNow?: () => void;
  /** Opens the Tasks pane in the current surface. Hung off
   * "Schedule a task for later". Unset means the row degrades to a
   * static entry. */
  onScheduleTask?: () => void;
  onSkipStep?: (stepId: string) => void;
  onUnskipStep?: (stepId: string) => void;
  /** Whether the user is currently on a voice call (vs. chat).
   * Selects which "Act now" suggestion chips show: call-friendly
   * (spoken / interactive output) vs. chat-friendly (text output).
   * Defaults to chat. */
  isOnCall?: boolean;
  className?: string;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

export function CoordinatorOnboardingChecklist({
  onStartOnboardingStep,
  onAddWhatsappNumber,
  onAddPhoneNumber,
  onConnectSlack,
  onConnectDiscord,
  onConnectWorkspace,
  onConnectApps,
  onActNow,
  onScheduleTask,
  onSkipStep,
  onUnskipStep,
  isOnCall = false,
  className,
}: CoordinatorOnboardingChecklistProps) {
  const ctx = useCoordinatorOnboardingContext();
  const completedStepIds = ctx?.completedStepIds ?? EMPTY_SET;
  const skippedStepIds = ctx?.skippedStepIds ?? EMPTY_SET;
  const rawResolved = React.useMemo(
    () => resolveChecklist(ONBOARDING_CHECKLIST, completedStepIds, skippedStepIds),
    [completedStepIds, skippedStepIds]
  );

  const handleAction = React.useCallback(
    (action: ChecklistAction) => {
      if (action === 'start-email-reply') onStartOnboardingStep?.('email-reply');
      else if (action === 'add-whatsapp-number') onAddWhatsappNumber?.();
      else if (action === 'start-whatsapp-message') onStartOnboardingStep?.('whatsapp-message');
      else if (action === 'start-whatsapp-call') onStartOnboardingStep?.('whatsapp-call');
      else if (action === 'add-phone-number') onAddPhoneNumber?.();
      else if (action === 'start-sms-message') onStartOnboardingStep?.('sms-message');
      else if (action === 'start-phone-call') onStartOnboardingStep?.('phone-call');
      else if (action === 'connect-slack') onConnectSlack?.();
      else if (action === 'start-slack-message') onStartOnboardingStep?.('slack-message');
      else if (action === 'connect-discord') onConnectDiscord?.();
      else if (action === 'start-discord-message') onStartOnboardingStep?.('discord-message');
      else if (action === 'connect-workspace') onConnectWorkspace?.();
      else if (action === 'connect-apps') onConnectApps?.();
      else if (action === 'act') onActNow?.();
      else if (action === 'schedule') onScheduleTask?.();
    },
    [
      onStartOnboardingStep,
      onAddWhatsappNumber,
      onAddPhoneNumber,
      onConnectSlack,
      onConnectDiscord,
      onConnectWorkspace,
      onConnectApps,
      onActNow,
      onScheduleTask,
    ]
  );

  // An action is reachable when the parent has wired the
  // corresponding handler. Pending items whose handler is unset are
  // hidden so the checklist never shows a dead button.
  const isActionWired = React.useCallback(
    (action: ChecklistAction | undefined): boolean => {
      if (!action) return false;
      if (
        action === 'start-email-reply' ||
        action === 'start-whatsapp-message' ||
        action === 'start-whatsapp-call' ||
        action === 'start-sms-message' ||
        action === 'start-phone-call' ||
        action === 'start-slack-message' ||
        action === 'start-discord-message'
      ) {
        return !!onStartOnboardingStep;
      }
      if (action === 'add-whatsapp-number') return !!onAddWhatsappNumber;
      if (action === 'add-phone-number') return !!onAddPhoneNumber;
      if (action === 'connect-slack') return !!onConnectSlack;
      if (action === 'connect-discord') return !!onConnectDiscord;
      if (action === 'connect-workspace') return !!onConnectWorkspace;
      if (action === 'connect-apps') return !!onConnectApps;
      if (action === 'act') return !!onActNow;
      if (action === 'schedule') return !!onScheduleTask;
      return false;
    },
    [
      onStartOnboardingStep,
      onAddWhatsappNumber,
      onAddPhoneNumber,
      onConnectSlack,
      onConnectDiscord,
      onConnectWorkspace,
      onConnectApps,
      onActNow,
      onScheduleTask,
    ]
  );

  const resolved = React.useMemo(
    () =>
      filterVisibleChecklist(
        rawResolved,
        completedStepIds,
        skippedStepIds,
        isActionWired,
        !!onSkipStep
      ),
    [rawResolved, completedStepIds, skippedStepIds, isActionWired, onSkipStep]
  );
  const { total, resolved: resolvedCount } = React.useMemo(() => countItems(resolved), [resolved]);
  const percent = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;
  const phases = React.useMemo(() => computePhases(resolved), [resolved]);

  // ID of the leaf row the user should tackle next — drives the
  // "Next" pill + soft highlight that anchors attention without
  // hiding the rest of the checklist. Null when every visible row is
  // already resolved.
  const nextActionableId = React.useMemo(
    () => findNextActionableId(resolved, isActionWired, !!onSkipStep),
    [resolved, isActionWired, onSkipStep]
  );
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <PhaseProgressBar phases={phases} resolved={resolvedCount} total={total} percent={percent} />
      <ul className="space-y-2.5" data-testid="coordinator-onboarding-checklist">
        {resolved.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            onAction={handleAction}
            isActionWired={isActionWired}
            nextActionableId={nextActionableId}
            isOnCall={isOnCall}
            onSkipStep={onSkipStep}
            onUnskipStep={onUnskipStep}
          />
        ))}
      </ul>
    </div>
  );
}

interface PhaseProgressBarProps {
  phases: PhaseProgress[];
  resolved: number;
  total: number;
  percent: number;
}

/**
 * Multi-segment progress bar that splits the meter by top-level
 * phase. Each segment fills from left to right with its own
 * per-phase fraction so the user can tell *what kind* of work is
 * left, not just how much. The legend underneath labels the
 * segments to keep the affordance discoverable without a tooltip.
 */
function PhaseProgressBar({ phases, resolved, total, percent }: PhaseProgressBarProps) {
  if (!phases.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-caption flex items-center justify-between text-muted-foreground">
        <span>
          {resolved} of {total} resolved
        </span>
        <span>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={`Onboarding progress: ${resolved} of ${total} steps resolved`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="flex h-1.5 w-full gap-1 overflow-hidden"
        data-testid="coordinator-onboarding-progress"
      >
        {phases.map((phase) => {
          const phasePercent =
            phase.total > 0 ? Math.round((phase.resolved / phase.total) * 100) : 0;
          return (
            <div
              key={phase.id}
              data-testid={`coordinator-onboarding-progress-phase-${phase.id}`}
              data-phase-resolved={phase.resolved}
              data-phase-total={phase.total}
              className="relative h-full flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${phasePercent}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="text-caption text-muted-foreground/80 flex items-center justify-between">
        {phases.map((phase) => (
          <span
            key={phase.id}
            className={cn(
              'truncate',
              phase.resolved === phase.total && phase.total > 0 && 'text-foreground'
            )}
          >
            {phase.label}
          </span>
        ))}
      </div>
    </div>
  );
}

interface ChecklistRowProps {
  item: ResolvedChecklistItem;
  isChild?: boolean;
  onAction: (action: ChecklistAction) => void;
  isActionWired: (action: ChecklistAction | undefined) => boolean;
  /** ID of the next leaf the user should tackle. Used to flag the
   * row as "you are here" with a Next pill + soft highlight; we
   * thread it down rather than recomputing per-row so the lookup
   * stays O(checklist-size) in total. */
  nextActionableId: string | null;
  /** Whether the user is on a call — selects the call vs. chat
   * "Act now" suggestion chips. */
  isOnCall: boolean;
  onSkipStep?: (stepId: string) => void;
  onUnskipStep?: (stepId: string) => void;
}

function ChecklistRow({
  item,
  isChild = false,
  onAction,
  isActionWired,
  nextActionableId,
  isOnCall,
  onSkipStep,
  onUnskipStep,
}: ChecklistRowProps) {
  const hasWiredAction = isActionWired(item.action);
  const isResolved = item.status !== 'pending';
  const isActionable = hasWiredAction && !isResolved;
  const isNext = nextActionableId === item.id;
  const nextChildAction = React.useMemo(
    () => findNextChildAction(item, isActionWired),
    [item, isActionWired]
  );
  const canOpenChildAction = !!nextChildAction && !isResolved;
  const canSkip = !!onSkipStep && !item.children?.length && !isResolved;
  const canUnskip = !!onUnskipStep && !item.children?.length && item.status === 'skipped';
  // Whether the next actionable leaf sits somewhere inside this
  // row's subtree. Parents on the path to "Next" stay at full
  // opacity so the user's eye flows from the phase header straight
  // down to the actionable row instead of jumping over a dimmed
  // group title.
  const containsNext =
    !!nextActionableId &&
    !!item.children?.some(function walk(child: ResolvedChecklistItem): boolean {
      if (child.id === nextActionableId) return true;
      return !!child.children?.some(walk);
    });
  // Soft-dim every row that isn't the "Next" anchor (and isn't on
  // the path leading to it). Done rows already carry their own
  // muted styling but we still apply the wrapper so the entire
  // list visually settles behind the single actionable focus.
  const dim = !isNext && !containsNext && item.status !== 'skipped';
  const hasInfo = !!item.description || !!item.estimatedTime;

  const handleClick = React.useCallback(() => {
    if (item.action) onAction(item.action);
  }, [item.action, onAction]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleClick();
    },
    [handleClick]
  );

  const handleParentClick = React.useCallback(() => {
    if (!nextChildAction) return;
    onAction(nextChildAction);
  }, [nextChildAction, onAction]);

  const handleParentKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleParentClick();
    },
    [handleParentClick]
  );

  const handleSkipClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onSkipStep?.(item.id);
    },
    [item.id, onSkipStep]
  );

  const handleUnskipClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onUnskipStep?.(item.id);
    },
    [item.id, onUnskipStep]
  );

  const rowClassName = (variant: 'done' | 'skipped' | 'actionable' | 'static') =>
    cn(
      'flex w-full items-start gap-2 rounded-md px-1.5 py-1 -mx-1.5',
      variant === 'actionable' && 'cursor-pointer hover:bg-muted/50',
      variant === 'static' && canOpenChildAction && 'cursor-pointer hover:bg-muted/50'
      // "Next" anchor: the Next pill + the row label going
      // ``font-medium`` carries the affordance — we leave the row
      // chrome flat so the highlight reads as a guide rather than
      // a competing call-to-action.
    );

  const renderLabel = (variant: 'done' | 'skipped' | 'actionable' | 'static') => (
    <span
      className={cn(
        'text-body-sm flex-1 leading-5',
        variant === 'done' && 'text-muted-foreground line-through',
        variant === 'skipped' && 'text-muted-foreground',
        variant === 'actionable' && (isNext ? 'font-medium text-foreground' : 'text-foreground'),
        variant === 'static' && 'text-foreground'
      )}
    >
      {item.title}
    </span>
  );

  const renderSkipButton = () =>
    canSkip ? (
      <button
        type="button"
        onClick={handleSkipClick}
        className={cn(
          'text-caption rounded-control flex-shrink-0 px-1.5 py-0.5 text-muted-foreground',
          'hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
        data-testid={`coordinator-onboarding-skip-step-${item.id}`}
      >
        Later
      </button>
    ) : null;

  const renderUnskipButton = () =>
    canUnskip ? (
      <button
        type="button"
        onClick={handleUnskipClick}
        className={cn(
          'text-caption rounded-control flex-shrink-0 px-1.5 py-0.5 font-medium text-primary',
          'hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
        data-testid={`coordinator-onboarding-unskip-step-${item.id}`}
      >
        Do now
      </button>
    ) : null;

  const renderNextPill = () =>
    isNext ? (
      <span
        className={cn(
          'bg-primary/15 text-caption ml-1 inline-flex flex-shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-primary'
        )}
        data-testid={`coordinator-onboarding-next-${item.id}`}
      >
        <ArrowLeft aria-hidden="true" className="h-3 w-3" />
        Next
      </span>
    ) : null;

  const renderInfoTooltip = () =>
    hasInfo ? (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <InfoSquareButton
              // ``span``-like click target nested inside the
              // actionable button isn't valid HTML — stop the
              // propagation so opening the tooltip never
              // double-fires the row action.
              onClick={(e) => e.stopPropagation()}
              aria-label={`What is "${item.title}"?`}
              className="border-muted-foreground/60 text-muted-foreground/60 ml-0.5"
              data-testid={`coordinator-onboarding-info-${item.id}`}
            />
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[220px]">
            <p className="text-caption leading-snug">
              {item.description}
              {item.description && item.estimatedTime ? (
                <span className="text-muted-foreground"> · {item.estimatedTime}</span>
              ) : item.estimatedTime ? (
                <span className="text-muted-foreground">{item.estimatedTime}</span>
              ) : null}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : null;

  const rowBody = (variant: 'done' | 'skipped' | 'actionable' | 'static') => (
    <div className={rowClassName(variant)}>
      <ChecklistMarker status={item.status} />
      {renderLabel(variant)}
      {renderNextPill()}
      {renderInfoTooltip()}
      {renderSkipButton()}
      {renderUnskipButton()}
    </div>
  );

  let row: React.ReactNode;
  if (item.status === 'done') {
    row = (
      <div data-testid={`coordinator-onboarding-item-${item.id}`} data-status="done">
        {rowBody('done')}
      </div>
    );
  } else if (item.status === 'skipped') {
    row = (
      <div data-testid={`coordinator-onboarding-item-${item.id}`} data-status="skipped">
        {rowBody('skipped')}
      </div>
    );
  } else if (isActionable) {
    row = (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        data-testid={`coordinator-onboarding-item-${item.id}`}
        data-next={isNext ? 'true' : undefined}
      >
        {rowBody('actionable')}
      </div>
    );
  } else {
    // Static informational row: a non-actionable grouping header
    // ("Connect me") that can open its visible child.
    row = canOpenChildAction ? (
      <div
        role="button"
        tabIndex={0}
        onClick={handleParentClick}
        onKeyDown={handleParentKeyDown}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        data-testid={`coordinator-onboarding-item-${item.id}`}
        data-next={isNext ? 'true' : undefined}
        aria-label={`Open next step in ${item.title}`}
      >
        {rowBody('static')}
      </div>
    ) : (
      <div
        data-testid={`coordinator-onboarding-item-${item.id}`}
        data-next={isNext ? 'true' : undefined}
      >
        {rowBody('static')}
      </div>
    );
  }

  // Read-only suggestion chips under the ``act`` / ``schedule``
  // rows — each row shows the set that matches what completes it
  // (point-in-time prompts for ``act``, scheduled/event prompts for
  // ``schedule``). Rendered only while the row is still pending; hidden
  // rows never reach this component. We intentionally don't wire
  // any click behaviour: the chips are non-interactive copy. Same
  // chip reads the same in chat and call surfaces — keeping them
  // inert avoids bifurcating semantics across the two transports
  // (chat could seed an input, call has nothing to seed) and avoids
  // the user accidentally firing a multi-sentence prompt
  // mid-voice-turn.
  const suggestionsForItem =
    item.id === 'act'
      ? isOnCall
        ? ACT_SUGGESTED_WORKFLOWS_CALL
        : ACT_SUGGESTED_WORKFLOWS_CHAT
      : item.id === 'schedule'
        ? SCHEDULE_SUGGESTED_WORKFLOWS
        : null;
  const showSuggestions = !!suggestionsForItem && item.status === 'pending';

  return (
    <li
      className={cn(
        'flex flex-col gap-2',
        isChild && 'ml-6',
        // Soft fade applies to the whole row container so the
        // marker, label, Next pill, info button, and any
        // suggestion chips all dim together. The "Next" row and
        // its ancestor chain stay opaque to keep the path to the
        // current focus legible.
        dim && 'opacity-50 transition-opacity'
      )}
    >
      {row}
      {showSuggestions && suggestionsForItem ? (
        <ul
          className="ml-6 flex flex-wrap gap-1.5"
          aria-label="Suggested workflows to try"
          data-testid="coordinator-onboarding-suggestions"
        >
          {suggestionsForItem.map((workflow) => (
            <li
              key={workflow.id}
              className={cn(
                'inline-flex select-none items-center rounded-full',
                'bg-muted/40 px-2 py-0.5',
                'text-caption text-muted-foreground'
              )}
              data-testid={`coordinator-onboarding-suggestion-${workflow.id}`}
            >
              {workflow.label}
            </li>
          ))}
        </ul>
      ) : null}
      {item.children?.length ? (
        <ul className="space-y-2">
          {item.children.map((child) => (
            <ChecklistRow
              key={child.id}
              item={child}
              isChild
              onAction={onAction}
              isActionWired={isActionWired}
              nextActionableId={nextActionableId}
              isOnCall={isOnCall}
              onSkipStep={onSkipStep}
              onUnskipStep={onUnskipStep}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ChecklistMarker({ status }: { status: 'pending' | 'done' | 'skipped' }) {
  const markerClasses = cn(
    'rounded-control mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center border',
    status === 'done'
      ? 'border-[color:var(--role-green-deep)] bg-[color:var(--status-success-bg)] text-[color:var(--role-green-deep)]'
      : status === 'skipped'
        ? 'border-muted-foreground/60 bg-muted text-muted-foreground'
        : 'border-muted-foreground/40 bg-transparent'
  );

  // Skipped rows mark the box with an "L" (for "Later"). The glyph
  // alone is opaque, so the box doubles as a tooltip trigger that
  // spells out "Later" on hover/focus.
  if (status === 'skipped') {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} aria-label="Later" className={markerClasses}>
              <span aria-hidden="true" className="text-caption font-semibold leading-none">
                L
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="text-caption">Later</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <span aria-hidden="true" className={markerClasses}>
      {status === 'done' ? <Check className="h-3 w-3 stroke-[4]" /> : null}
    </span>
  );
}
