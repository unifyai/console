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
import { ArrowLeft, Check, ChevronDown, RotateCcw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/UI/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { InfoSquareButton } from '@/components/UI/info-square-button';
import { cn } from '@/lib/utils';
import { useCoordinatorOnboardingContext } from './CoordinatorOnboardingContext';

export type ChecklistAction =
  | 'trigger-email-reference'
  | 'start-email-reply'
  | 'add-whatsapp-number'
  | 'trigger-whatsapp-message-reference'
  | 'start-whatsapp-message'
  | 'trigger-whatsapp-call-reference'
  | 'start-whatsapp-call'
  | 'add-phone-number'
  | 'trigger-sms-reference'
  | 'start-sms-message'
  | 'trigger-phone-call-reference'
  | 'start-phone-call'
  | 'connect-slack'
  | 'trigger-slack-reference'
  | 'start-slack-message'
  | 'connect-discord'
  | 'trigger-discord-reference'
  | 'start-discord-message'
  | 'connect-workspace'
  | 'connect-apps'
  | 'act'
  | 'schedule';

/**
 * How strict a dependency edge is. Authored per entry in an item's
 * ``dependsOn`` map so a single row can mix strict and loose gates.
 *  - ``Addressed`` (0): the dependency only needs to be *resolved* —
 *    completed, skipped, or deferred with "Later". Mirrors the legacy
 *    single-prerequisite behaviour where skipping a step still
 *    unlocked everything downstream.
 *  - ``Completed`` (1): the dependency must be *genuinely completed*.
 *    Skipping it does NOT unlock the dependent. A ``Completed`` target
 *    must therefore never be skippable (asserted at module load).
 */
const enum DependencyLevel {
  Addressed = 0,
  Completed = 1,
}

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
  /** Steps that gate this row, keyed by the dependency's ``id``. The
   * value is how strict each gate is (see ``DependencyLevel``). The
   * row stays disabled/hidden until *every* dependency is satisfied
   * at its declared level. Absent or empty means no gate — the row is
   * available immediately. Keeping ordering rules in data (not in the
   * render layer) lets the same map drive gating, visibility, and any
   * future automation from one source of truth. */
  dependsOn?: Partial<Record<string, DependencyLevel>>;
  /** Sub-items render under the parent and count separately toward the
   * progress bar — same accounting model as the per-assistant setup
   * roadmap. */
  children?: OnboardingChecklistItem[];
  /** Whether the row can be deferred with the inline Later affordance. */
  canSkip?: boolean;
}

const ONBOARDING_CHECKLIST: OnboardingChecklistItem[] = [
  {
    id: 'comms',
    title: 'Guess the reference',
    phaseLabel: 'Quiz',
    description: 'Identify clues sent over email, WhatsApp, phone, Slack, and Discord.',
    children: [
      {
        id: 'email-reference',
        title: 'Email the first reference',
        description: 'Twin sends the first reference clue over email.',
        estimatedTime: '~10s',
        action: 'trigger-email-reference',
        canSkip: false,
      },
      {
        id: 'email-reply',
        title: 'Reply to email',
        description: 'Twin sends you a quick email.',
        estimatedTime: '~30s',
        action: 'start-email-reply',
        dependsOn: { 'email-reference': DependencyLevel.Addressed },
      },
      {
        id: 'whatsapp-number',
        title: 'Add your WhatsApp number',
        description: 'Add the WhatsApp number Twin should use.',
        estimatedTime: '~30s',
        action: 'add-whatsapp-number',
        dependsOn: { 'email-reply': DependencyLevel.Addressed },
      },
      {
        id: 'whatsapp-message-reference',
        title: 'WhatsApp the next reference',
        description: 'Twin sends the next reference clue over WhatsApp.',
        estimatedTime: '~10s',
        action: 'trigger-whatsapp-message-reference',
        dependsOn: { 'whatsapp-number': DependencyLevel.Addressed },
        canSkip: false,
      },
      {
        id: 'whatsapp-message',
        title: 'Guess a WhatsApp clue',
        description: 'Twin sends you a reference clue over WhatsApp.',
        estimatedTime: '~1 min',
        action: 'start-whatsapp-message',
        dependsOn: { 'whatsapp-message-reference': DependencyLevel.Addressed },
      },
      {
        id: 'whatsapp-call-reference',
        title: 'WhatsApp call for the next reference',
        description: 'Twin calls with the next reference clue over WhatsApp.',
        estimatedTime: '~10s',
        action: 'trigger-whatsapp-call-reference',
        dependsOn: { 'whatsapp-message': DependencyLevel.Addressed },
        canSkip: false,
      },
      {
        id: 'whatsapp-call',
        title: 'Guess a WhatsApp call clue',
        description: 'Twin gives you a reference clue over WhatsApp voice.',
        estimatedTime: '~1 min',
        action: 'start-whatsapp-call',
        dependsOn: { 'whatsapp-call-reference': DependencyLevel.Addressed },
      },
      {
        id: 'phone-number',
        title: 'Add your phone number',
        description: 'Add the phone number Twin should use for calls and SMS.',
        estimatedTime: '~30s',
        action: 'add-phone-number',
        dependsOn: { 'whatsapp-call': DependencyLevel.Addressed },
      },
      {
        id: 'sms-reference',
        title: 'Text the next reference',
        description: 'Twin sends the next reference clue over SMS.',
        estimatedTime: '~10s',
        action: 'trigger-sms-reference',
        dependsOn: { 'phone-number': DependencyLevel.Addressed },
        canSkip: false,
      },
      {
        id: 'sms-message',
        title: 'Guess an SMS clue',
        description: 'Twin sends you a reference clue over SMS.',
        estimatedTime: '~1 min',
        action: 'start-sms-message',
        dependsOn: { 'sms-reference': DependencyLevel.Addressed },
      },
      {
        id: 'phone-call-reference',
        title: 'Call for the next reference',
        description: 'Twin calls with the next reference clue.',
        estimatedTime: '~10s',
        action: 'trigger-phone-call-reference',
        dependsOn: { 'sms-message': DependencyLevel.Addressed },
        canSkip: false,
      },
      {
        id: 'phone-call',
        title: 'Guess a phone call clue',
        description: 'Twin gives you a reference clue over a phone call.',
        estimatedTime: '~1 min',
        action: 'start-phone-call',
        dependsOn: { 'phone-call-reference': DependencyLevel.Addressed },
      },
      {
        id: 'slack-connect',
        title: 'Connect Slack',
        description: 'Connect Twin through the Unify Slack app.',
        estimatedTime: '~1 min',
        action: 'connect-slack',
        dependsOn: { 'phone-call': DependencyLevel.Addressed },
      },
      {
        id: 'slack-reference',
        title: 'Send the next reference via Slack',
        description: 'Twin sends the next reference clue in Slack.',
        estimatedTime: '~10s',
        action: 'trigger-slack-reference',
        dependsOn: { 'slack-connect': DependencyLevel.Addressed },
        canSkip: false,
      },
      {
        id: 'slack-message',
        title: 'Guess a Slack clue',
        description: 'Twin sends you a reference clue in Slack.',
        estimatedTime: '~1 min',
        action: 'start-slack-message',
        dependsOn: { 'slack-reference': DependencyLevel.Addressed },
      },
      {
        id: 'discord-connect',
        title: 'Connect Discord',
        description: 'Connect Twin through the public Discord bot.',
        estimatedTime: '~1 min',
        action: 'connect-discord',
        dependsOn: { 'slack-message': DependencyLevel.Addressed },
      },
      {
        id: 'discord-reference',
        title: 'Send the next reference via discord',
        description: 'Twin sends the next reference clue in Discord.',
        estimatedTime: '~10s',
        action: 'trigger-discord-reference',
        dependsOn: { 'discord-connect': DependencyLevel.Addressed },
        canSkip: false,
      },
      {
        id: 'discord-message',
        title: 'Guess a Discord clue',
        description: 'Twin sends you a reference clue in Discord.',
        estimatedTime: '~1 min',
        action: 'start-discord-message',
        dependsOn: { 'discord-reference': DependencyLevel.Addressed },
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
        dependsOn: { 'discord-message': DependencyLevel.Addressed },
      },
      {
        id: 'apps',
        title: 'Connect me with your apps',
        description: 'Hook up at least one app (Slack, Gmail…).',
        estimatedTime: '~2 min',
        action: 'connect-apps',
        dependsOn: { workspace: DependencyLevel.Addressed },
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
        dependsOn: { apps: DependencyLevel.Addressed },
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
        dependsOn: { act: DependencyLevel.Addressed },
      },
    ],
  },
];

/**
 * Dev-time integrity check for the hand-authored dependency graph.
 * Catches the three ways the ``dependsOn`` map can silently rot:
 *  1. A dependency id that doesn't exist anywhere in the tree.
 *  2. A cycle — which would leave the dependent rows permanently
 *     hidden with no obvious cause.
 *  3. A ``Completed`` (level-1) edge pointing at a skippable row — the
 *     user could skip the dependency and strand the dependent forever,
 *     since a skip never satisfies a ``Completed`` gate.
 * Runs once at module load in development and throws loudly so the
 * mistake surfaces immediately rather than as a confusing empty
 * checklist at runtime. Stripped from production builds.
 */
function assertChecklistDependencyGraph(items: OnboardingChecklistItem[]): void {
  const leaves = flattenChecklistLeaves(items);
  const byId = new Map(leaves.map((leaf) => [leaf.id, leaf]));

  for (const leaf of leaves) {
    for (const [depId, level] of Object.entries(leaf.dependsOn ?? {})) {
      const dep = byId.get(depId);
      if (!dep) {
        throw new Error(`Onboarding checklist: "${leaf.id}" depends on unknown step "${depId}".`);
      }
      if (level === DependencyLevel.Completed && dep.canSkip !== false) {
        throw new Error(
          `Onboarding checklist: "${leaf.id}" requires "${depId}" completed, ` +
            `but "${depId}" is skippable — set canSkip: false on it.`
        );
      }
    }
  }

  // Depth-first cycle detection over the dependency edges.
  const VISITING = 1;
  const DONE = 2;
  const state = new Map<string, number>();
  const visit = (id: string): void => {
    const current = state.get(id);
    if (current === DONE) return;
    if (current === VISITING) {
      throw new Error(`Onboarding checklist: dependency cycle through "${id}".`);
    }
    state.set(id, VISITING);
    for (const depId of Object.keys(byId.get(id)?.dependsOn ?? {})) visit(depId);
    state.set(id, DONE);
  };
  for (const leaf of leaves) visit(leaf.id);
}

if (process.env.NODE_ENV !== 'production') {
  assertChecklistDependencyGraph(ONBOARDING_CHECKLIST);
}

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

function flattenChecklistLeaves(items: OnboardingChecklistItem[]): OnboardingChecklistItem[] {
  const leaves: OnboardingChecklistItem[] = [];
  for (const item of items) {
    if (item.children?.length) leaves.push(...flattenChecklistLeaves(item.children));
    else leaves.push(item);
  }
  return leaves;
}

/**
 * Single source of truth for "are this row's gates open?". A row
 * unlocks only when *every* entry in its ``dependsOn`` map is
 * satisfied at its declared level:
 *  - ``Completed`` — the dependency must be in ``completed``.
 *  - ``Addressed`` — the dependency may be in ``completed`` *or*
 *    ``skipped`` (deferred with "Later" counts).
 * A dependency that's *not applicable* on this deployment
 * (``unavailable``) never blocks — it's treated as satisfied so the
 * chain doesn't dead-end behind a step the user can't reach here.
 */
function dependenciesSatisfied(
  deps: Partial<Record<string, DependencyLevel>> | undefined,
  completed: ReadonlySet<string>,
  skipped: ReadonlySet<string>,
  unavailable: ReadonlySet<string>
): boolean {
  if (!deps) return true;
  for (const [depId, level] of Object.entries(deps)) {
    if (unavailable.has(depId)) continue;
    if (level === DependencyLevel.Completed) {
      if (!completed.has(depId)) return false;
    } else if (!completed.has(depId) && !skipped.has(depId)) {
      return false;
    }
  }
  return true;
}

interface DisplayStepSets {
  completed: ReadonlySet<string>;
  skipped: ReadonlySet<string>;
}

function computeDisplayStepSets(
  items: OnboardingChecklistItem[],
  completed: ReadonlySet<string>,
  skipped: ReadonlySet<string>,
  isActionWired: (action: ChecklistAction | undefined) => boolean
): DisplayStepSets {
  const leaves = flattenChecklistLeaves(items);
  // A leaf whose action isn't wired on this deployment is not
  // applicable — it never displays as resolved itself, but counts as
  // satisfied for anything that depends on it.
  const unavailable = new Set<string>();
  for (const item of leaves) {
    if (item.action && !isActionWired(item.action)) unavailable.add(item.id);
  }

  const displayCompleted = new Set<string>();
  const displaySkipped = new Set<string>();

  // A leaf's persisted completed/skipped status is only honored once
  // all of its dependencies are satisfied against the already-honored
  // sets — guarding against stale, out-of-order persistence. Because
  // ``dependsOn`` is a map (not a strict linear chain) we iterate to a
  // fixpoint instead of relying on authoring order: cheap at this node
  // count and order-independent.
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of leaves) {
      if (unavailable.has(item.id)) continue;
      if (displayCompleted.has(item.id) || displaySkipped.has(item.id)) continue;
      if (!dependenciesSatisfied(item.dependsOn, displayCompleted, displaySkipped, unavailable)) {
        continue;
      }
      if (completed.has(item.id)) {
        displayCompleted.add(item.id);
        changed = true;
      } else if (skipped.has(item.id)) {
        displaySkipped.add(item.id);
        changed = true;
      }
    }
  }

  return { completed: displayCompleted, skipped: displaySkipped };
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
  // step treats a not-applicable dependency as satisfied rather than
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
    const depsSatisfied = dependenciesSatisfied(item.dependsOn, completed, skipped, unavailableIds);
    // A dependency hidden because it's *not applicable* doesn't block
    // its dependents — it counts as satisfied above. Only a dependency
    // hidden for other reasons keeps the dependent out of view.
    const dependencyHidden = Object.keys(item.dependsOn ?? {}).some(
      (depId) => hiddenIds.has(depId) && !unavailableIds.has(depId)
    );
    // A leaf whose action is *configured* but not wired in the current
    // surface is not applicable on this deployment (e.g. the workspace
    // OAuth step when no Google/Microsoft provider is configured). We
    // hide it entirely rather than surfacing a dead — or merely
    // skippable — row that the user can never actually complete here.
    const actionUnavailable = !!item.action && !isActionWired(item.action);
    const canDeferNow = canMarkLater && !item.children?.length && !actionUnavailable;
    const canActNow =
      item.status === 'pending' &&
      depsSatisfied &&
      !dependencyHidden &&
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

interface PhaseProgress {
  id: string;
  label: string;
  total: number;
  completed: number;
}

/**
 * Collapse the top-level checklist into one phase per row. Each
 * phase counts its own available leaves: parent rows with children
 * contribute their children's totals, leaf-only phases contribute
 * themselves. The label prefers ``phaseLabel`` (a single word) over
 * the full ``title`` so the detail view stays compact.
 */
function computePhases(
  items: ResolvedChecklistItem[],
  isActionWired: (action: ChecklistAction | undefined) => boolean
): PhaseProgress[] {
  return items.flatMap((item) => {
    const label = item.phaseLabel ?? item.title;
    const { total, completed } = countAvailableLeaves(item, isActionWired);
    return total > 0 ? [{ id: item.id, label, total, completed }] : [];
  });
}

function countAvailableLeaves(
  item: ResolvedChecklistItem,
  isActionWired: (action: ChecklistAction | undefined) => boolean
): { total: number; completed: number } {
  if (item.children?.length) {
    return item.children.reduce(
      (acc, child) => {
        const childCount = countAvailableLeaves(child, isActionWired);
        return {
          total: acc.total + childCount.total,
          completed: acc.completed + childCount.completed,
        };
      },
      { total: 0, completed: 0 }
    );
  }

  if (item.action && !isActionWired(item.action)) return { total: 0, completed: 0 };
  return { total: 1, completed: item.status === 'done' ? 1 : 0 };
}

function collectVisibleLeafIds(item: ResolvedChecklistItem): string[] {
  if (!item.children?.length) return [item.id];
  return item.children.flatMap(collectVisibleLeafIds);
}

function hasResolvedLeaf(item: ResolvedChecklistItem): boolean {
  if (!item.children?.length) return item.status !== 'pending';
  return item.children.some(hasResolvedLeaf);
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
  const displayStepSets = computeDisplayStepSets(
    ONBOARDING_CHECKLIST,
    completedStepIds,
    skippedStepIds,
    isActionWired
  );
  const resolved = resolveChecklist(
    ONBOARDING_CHECKLIST,
    displayStepSets.completed,
    displayStepSets.skipped
  );
  const visible = filterVisibleChecklist(
    resolved,
    displayStepSets.completed,
    displayStepSets.skipped,
    isActionWired,
    true
  );
  return findNextActionableId(visible, isActionWired, true) !== null;
}

export interface CoordinatorOnboardingChecklistProps {
  onStartOnboardingStep?: (stepId: string) => void;
  onTriggerReferenceStep?: (stepId: string) => void;
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
  onTriggerReferenceStep,
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
  const resetStepProgress = ctx?.resetStepProgress;
  const [areProgressDetailsOpen, setAreProgressDetailsOpen] = React.useState(false);

  const handleAction = React.useCallback(
    (action: ChecklistAction) => {
      if (action === 'trigger-email-reference') onTriggerReferenceStep?.('email-reference');
      else if (action === 'start-email-reply') onStartOnboardingStep?.('email-reply');
      else if (action === 'add-whatsapp-number') onAddWhatsappNumber?.();
      else if (action === 'trigger-whatsapp-message-reference')
        onTriggerReferenceStep?.('whatsapp-message-reference');
      else if (action === 'start-whatsapp-message') onStartOnboardingStep?.('whatsapp-message');
      else if (action === 'trigger-whatsapp-call-reference')
        onTriggerReferenceStep?.('whatsapp-call-reference');
      else if (action === 'start-whatsapp-call') onStartOnboardingStep?.('whatsapp-call');
      else if (action === 'add-phone-number') onAddPhoneNumber?.();
      else if (action === 'trigger-sms-reference') onTriggerReferenceStep?.('sms-reference');
      else if (action === 'start-sms-message') onStartOnboardingStep?.('sms-message');
      else if (action === 'trigger-phone-call-reference')
        onTriggerReferenceStep?.('phone-call-reference');
      else if (action === 'start-phone-call') onStartOnboardingStep?.('phone-call');
      else if (action === 'connect-slack') onConnectSlack?.();
      else if (action === 'trigger-slack-reference') onTriggerReferenceStep?.('slack-reference');
      else if (action === 'start-slack-message') onStartOnboardingStep?.('slack-message');
      else if (action === 'connect-discord') onConnectDiscord?.();
      else if (action === 'trigger-discord-reference')
        onTriggerReferenceStep?.('discord-reference');
      else if (action === 'start-discord-message') onStartOnboardingStep?.('discord-message');
      else if (action === 'connect-workspace') onConnectWorkspace?.();
      else if (action === 'connect-apps') onConnectApps?.();
      else if (action === 'act') onActNow?.();
      else if (action === 'schedule') onScheduleTask?.();
    },
    [
      onStartOnboardingStep,
      onTriggerReferenceStep,
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
      if (action === 'trigger-email-reference') {
        return !!onTriggerReferenceStep;
      }
      if (
        action === 'trigger-whatsapp-message-reference' ||
        action === 'trigger-whatsapp-call-reference'
      ) {
        return !!onTriggerReferenceStep && !!onAddWhatsappNumber;
      }
      if (action === 'trigger-sms-reference' || action === 'trigger-phone-call-reference') {
        return !!onTriggerReferenceStep && !!onAddPhoneNumber;
      }
      if (action === 'trigger-slack-reference') {
        return !!onTriggerReferenceStep && !!onConnectSlack;
      }
      if (action === 'trigger-discord-reference') {
        return !!onTriggerReferenceStep && !!onConnectDiscord;
      }
      if (action === 'start-email-reply') return !!onStartOnboardingStep;
      if (
        action === 'start-whatsapp-message' ||
        action === 'start-whatsapp-call' ||
        action === 'start-sms-message' ||
        action === 'start-phone-call'
      ) {
        return (
          !!onStartOnboardingStep &&
          (action === 'start-whatsapp-message' || action === 'start-whatsapp-call'
            ? !!onAddWhatsappNumber
            : !!onAddPhoneNumber)
        );
      }
      if (action === 'start-slack-message') return !!onStartOnboardingStep && !!onConnectSlack;
      if (action === 'start-discord-message') return !!onStartOnboardingStep && !!onConnectDiscord;
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
      onTriggerReferenceStep,
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

  const displayStepSets = React.useMemo(
    () =>
      computeDisplayStepSets(ONBOARDING_CHECKLIST, completedStepIds, skippedStepIds, isActionWired),
    [completedStepIds, skippedStepIds, isActionWired]
  );
  const displayResolved = React.useMemo(
    () =>
      resolveChecklist(ONBOARDING_CHECKLIST, displayStepSets.completed, displayStepSets.skipped),
    [displayStepSets]
  );
  const resolved = React.useMemo(
    () =>
      filterVisibleChecklist(
        displayResolved,
        displayStepSets.completed,
        displayStepSets.skipped,
        isActionWired,
        !!onSkipStep
      ),
    [displayResolved, displayStepSets, isActionWired, onSkipStep]
  );
  const phases = React.useMemo(
    () => computePhases(displayResolved, isActionWired),
    [displayResolved, isActionWired]
  );

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
      <SectionProgressDisclosure
        phases={phases}
        isOpen={areProgressDetailsOpen}
        onToggle={() => setAreProgressDetailsOpen((open) => !open)}
      />
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
            onResetStepProgress={resetStepProgress}
          />
        ))}
      </ul>
    </div>
  );
}

interface SectionProgressDisclosureProps {
  phases: PhaseProgress[];
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Compact section summary with foldable per-section detail. The
 * default state avoids suggesting progress in future phases that the
 * current checklist path has not reached yet.
 */
function SectionProgressDisclosure({ phases, isOpen, onToggle }: SectionProgressDisclosureProps) {
  const detailsId = React.useId();
  if (!phases.length) return null;
  const completedSections = phases.filter(
    (phase) => phase.total > 0 && phase.completed === phase.total
  ).length;
  return (
    <div className="flex flex-col gap-2" data-testid="coordinator-onboarding-progress">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={detailsId}
        className={cn(
          'rounded-control flex w-full items-center justify-between gap-2 text-left',
          'bg-muted/40 hover:bg-muted/70 px-2.5 py-2 transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
        data-testid="coordinator-onboarding-progress-toggle"
      >
        <span
          className="text-body-sm font-medium text-foreground"
          data-testid="coordinator-onboarding-progress-summary"
        >
          {completedSections} of {phases.length} sections completed
        </span>
        <span className="text-caption flex flex-shrink-0 items-center gap-1 text-muted-foreground">
          {isOpen ? 'Hide details' : 'Show details'}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </span>
      </button>
      {isOpen ? (
        <ul
          id={detailsId}
          className="flex flex-col gap-2"
          data-testid="coordinator-onboarding-progress-details"
        >
          {phases.map((phase) => {
            const phasePercent =
              phase.total > 0 ? Math.round((phase.completed / phase.total) * 100) : 0;
            return (
              <li
                key={phase.id}
                data-testid={`coordinator-onboarding-progress-phase-${phase.id}`}
                data-phase-completed={phase.completed}
                data-phase-total={phase.total}
                className="flex flex-col gap-1"
              >
                <div className="text-caption flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="truncate">{phase.label}</span>
                  <span className="flex-shrink-0">
                    {phase.completed} of {phase.total} items completed
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${phase.label}: ${phase.completed} of ${phase.total} items completed`}
                  aria-valuenow={phasePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${phasePercent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
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
  onResetStepProgress?: (stepIds: readonly string[]) => void;
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
  onResetStepProgress,
}: ChecklistRowProps) {
  const hasWiredAction = isActionWired(item.action);
  const isResolved = item.status !== 'pending';
  const isNext = nextActionableId === item.id;
  const isActionable = hasWiredAction && !isResolved && isNext;
  const canSkip =
    !!onSkipStep && item.canSkip !== false && !item.children?.length && !isResolved && isNext;
  const canUnskip = !!onUnskipStep && !item.children?.length && item.status === 'skipped';
  const canResetSection =
    !isChild && !!item.children?.length && !!onResetStepProgress && hasResolvedLeaf(item);
  const resetStepIds = React.useMemo(() => collectVisibleLeafIds(item), [item]);
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
      variant === 'actionable' && 'cursor-pointer hover:bg-muted/50'
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

  const renderResetSectionButton = () =>
    canResetSection ? (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            aria-label={`Reset ${item.title}`}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              'rounded-control text-muted-foreground hover:bg-muted hover:text-foreground',
              'ml-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
            data-testid={`coordinator-onboarding-reset-section-${item.id}`}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent
          className="max-w-sm"
          data-testid={`coordinator-onboarding-reset-dialog-${item.id}`}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Reset {item.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              All progress in this section will be removed, so you can redo each task. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`coordinator-onboarding-reset-cancel-${item.id}`}>
              No
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onResetStepProgress?.(resetStepIds)}
              data-testid={`coordinator-onboarding-reset-confirm-${item.id}`}
            >
              Yes, reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      {renderResetSectionButton()}
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
    row = (
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
              onResetStepProgress={onResetStepProgress}
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
