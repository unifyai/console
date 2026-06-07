'use client';

/**
 * CoordinatorOnboardingChecklist — the gating-aware checklist body
 * that surfaces the user's progress through Coordinator onboarding.
 *
 * Rendered in two surfaces with identical UX:
 *
 *   1. The gradual-view sidebar — wrapped by
 *      ``CoordinatorOnboardingSidebar`` which adds a full-height
 *      column shell and the "Skip onboarding" footer.
 *   2. The coordinator's assistant info panel "Onboarding" sub-tab
 *      in the base ``/assistants`` shell, which the user reaches the
 *      moment they engage the "Hire your first specialist" step.
 *      The layout swaps to base but the checklist follows the user
 *      so the progress they've made stays in view.
 *
 * Shared state (``completedStepIds``) comes from
 * ``CoordinatorOnboardingContext`` so it survives the surface
 * transition. Action handlers are passed in as props because they're
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
import { ArrowLeft, Check, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import { useCoordinatorOnboardingContext } from './CoordinatorOnboardingContext';

type ChecklistAction =
  | 'connect-workspace'
  | 'connect-apps'
  | 'act'
  | 'schedule'
  | 'hire-specialist';

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
    title: 'Meet Unity',
    phaseLabel: 'Meet',
    description: 'Say hi to Unity.',
    estimatedTime: '~1 min',
  },
  {
    id: 'connect',
    title: 'Connect Unity',
    phaseLabel: 'Connect',
    description: 'Plug it into your workspace and apps.',
    // No action: the parent row is purely a grouping header; the
    // workspace OAuth + integrations actions live on its children.
    children: [
      {
        id: 'workspace',
        title: 'Give Unity access to your workspace',
        description: 'Required for everything else in onboarding.',
        estimatedTime: '~30s',
        action: 'connect-workspace',
        prerequisiteId: 'meet',
      },
      {
        id: 'apps',
        title: 'Connect Unity with your apps',
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
        title: 'Ask Unity to do something now',
        description: 'Give it a one-off job and watch it run live.',
        estimatedTime: '~2 min',
        action: 'act',
        prerequisiteId: 'apps',
      },
      {
        // Time- or event-bound work: this is what the product calls
        // a "Task" — it lands in the Coordinator's Tasks context and
        // shows in the Tasks panel. Completion is the Tasks count
        // going non-zero. Encouraged but not a hard gate for hiring
        // (see ``hire-specialist`` below).
        id: 'schedule',
        title: 'Schedule a task for later',
        description: 'Set up a recurring or event-triggered task.',
        estimatedTime: '~1 min',
        action: 'schedule',
        prerequisiteId: 'act',
      },
      {
        id: 'hire-specialist',
        title: 'Hire your first specialist assistant',
        description: 'Spin up a focused specialist for recurring work.',
        estimatedTime: '~3 min',
        action: 'hire-specialist',
        // Gated on ``act`` (seeing real work happen), not
        // ``schedule`` — scheduling is encouraged but optional, so a
        // user who just wants to hire isn't forced to set up a
        // scheduled task first.
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
  /** Human-readable prereq label used by the disabled tooltip.
   * ``undefined`` means the row is either done, has no prereq, or
   * its prereq is already satisfied. */
  disabledReason?: string;
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
  titlesById: Map<string, string>
): ResolvedChecklistItem[] {
  return items.map((item) => {
    const resolvedChildren = item.children
      ? resolveChecklist(item.children, completed, titlesById)
      : undefined;
    const childrenAllDone =
      !!resolvedChildren?.length && resolvedChildren.every((child) => child.done);
    const done = completed.has(item.id) || childrenAllDone;
    const prereqDone = !item.prerequisiteId || completed.has(item.prerequisiteId);
    const disabledReason =
      !done && !prereqDone && item.prerequisiteId
        ? `Complete "${titlesById.get(item.prerequisiteId) ?? item.prerequisiteId}" first`
        : undefined;
    return {
      ...item,
      done,
      disabledReason,
      children: resolvedChildren,
    };
  });
}

function collectTitles(
  items: OnboardingChecklistItem[],
  out: Map<string, string> = new Map()
): Map<string, string> {
  for (const item of items) {
    out.set(item.id, item.title);
    if (item.children) collectTitles(item.children, out);
  }
  return out;
}

function countItems(items: ResolvedChecklistItem[]): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const item of items) {
    if (item.children?.length) {
      // Parent rows that have children aren't independently scored —
      // the children carry the weight, so the progress bar reflects
      // the real granularity of remaining work.
      for (const child of item.children) {
        total += 1;
        if (child.done) done += 1;
      }
    } else {
      total += 1;
      if (item.done) done += 1;
    }
  }
  return { total, done };
}

interface PhaseProgress {
  id: string;
  label: string;
  total: number;
  done: number;
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
      const done = children.filter((child) => child.done).length;
      return { id: item.id, label, total, done };
    }
    return { id: item.id, label, total: 1, done: item.done ? 1 : 0 };
  });
}

/**
 * Identify the next actionable leaf so the UI can call it out with
 * a "Next" affordance. Walks the resolved tree in render order and
 * returns the first non-done, non-blocked leaf with a wired
 * action. Returning ``null`` (everything done or everything still
 * blocked) is a non-event — the row variants alone are enough
 * signal at that point.
 */
function findNextActionableId(
  items: ResolvedChecklistItem[],
  isActionWired: (action: ChecklistAction | undefined) => boolean
): string | null {
  for (const item of items) {
    if (item.children?.length) {
      const inner = findNextActionableId(item.children, isActionWired);
      if (inner) return inner;
      continue;
    }
    if (!item.done && !item.disabledReason && isActionWired(item.action)) {
      return item.id;
    }
  }
  return null;
}

export interface CoordinatorOnboardingChecklistProps {
  /** Opens the workspace OAuth dialog. Hung off the "Give your
   * coordinator access to your workspace" sub-item. Unset means
   * the row degrades to a static checklist entry. */
  onConnectWorkspace?: () => void;
  /** Opens the Integrations pane in the current surface. Hung off
   * "Connect your coordinator with your apps". Unset means the
   * row degrades to a static entry. */
  onConnectApps?: () => void;
  /** Opens the live Actions viewer in the current surface. Hung off
   * "Ask your coordinator to do something now" — the user gives a
   * one-off job and watches it run live. Unset means the row
   * degrades to a static entry. */
  onActNow?: () => void;
  /** Opens the Tasks pane in the current surface. Hung off
   * "Schedule a task for later". Unset means the row degrades to a
   * static entry. */
  onScheduleTask?: () => void;
  /** Engages the final step — see the prop docs on
   * ``CoordinatorOnboarding`` for the exact contract. Unset means
   * the row degrades to a static entry. */
  onHireSpecialist?: () => void;
  /** Whether the user is currently on a voice call (vs. chat).
   * Selects which "Act now" suggestion chips show: call-friendly
   * (spoken / interactive output) vs. chat-friendly (text output).
   * Defaults to chat. */
  isOnCall?: boolean;
  className?: string;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

export function CoordinatorOnboardingChecklist({
  onConnectWorkspace,
  onConnectApps,
  onActNow,
  onScheduleTask,
  onHireSpecialist,
  isOnCall = false,
  className,
}: CoordinatorOnboardingChecklistProps) {
  const ctx = useCoordinatorOnboardingContext();
  const completedStepIds = ctx?.completedStepIds ?? EMPTY_SET;
  const titlesById = React.useMemo(() => collectTitles(ONBOARDING_CHECKLIST), []);
  const resolved = React.useMemo(
    () => resolveChecklist(ONBOARDING_CHECKLIST, completedStepIds, titlesById),
    [completedStepIds, titlesById]
  );
  const { total, done } = React.useMemo(() => countItems(resolved), [resolved]);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const phases = React.useMemo(() => computePhases(resolved), [resolved]);

  const handleAction = React.useCallback(
    (action: ChecklistAction) => {
      if (action === 'connect-workspace') onConnectWorkspace?.();
      else if (action === 'connect-apps') onConnectApps?.();
      else if (action === 'act') onActNow?.();
      else if (action === 'schedule') onScheduleTask?.();
      else if (action === 'hire-specialist') onHireSpecialist?.();
    },
    [onConnectWorkspace, onConnectApps, onActNow, onScheduleTask, onHireSpecialist]
  );

  // An action is reachable when the parent has wired the
  // corresponding handler. Items whose handler is unset render as
  // static rows even if their prereq is satisfied — surfaces that
  // don't support a particular action shouldn't show a dead button.
  const isActionWired = React.useCallback(
    (action: ChecklistAction | undefined): boolean => {
      if (!action) return false;
      if (action === 'connect-workspace') return !!onConnectWorkspace;
      if (action === 'connect-apps') return !!onConnectApps;
      if (action === 'act') return !!onActNow;
      if (action === 'schedule') return !!onScheduleTask;
      if (action === 'hire-specialist') return !!onHireSpecialist;
      return false;
    },
    [onConnectWorkspace, onConnectApps, onActNow, onScheduleTask, onHireSpecialist]
  );

  // ID of the leaf row the user should tackle next — drives the
  // "Next" pill + soft highlight that anchors attention without
  // hiding the rest of the checklist. Null while everything is
  // either done or still blocked (e.g. wired handlers missing on
  // this surface).
  const nextActionableId = React.useMemo(
    () => findNextActionableId(resolved, isActionWired),
    [resolved, isActionWired]
  );

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <PhaseProgressBar phases={phases} done={done} total={total} percent={percent} />
      <ul className="space-y-2.5" data-testid="coordinator-onboarding-checklist">
        {resolved.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            onAction={handleAction}
            isActionWired={isActionWired}
            nextActionableId={nextActionableId}
            isOnCall={isOnCall}
          />
        ))}
      </ul>
    </div>
  );
}

interface PhaseProgressBarProps {
  phases: PhaseProgress[];
  done: number;
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
function PhaseProgressBar({ phases, done, total, percent }: PhaseProgressBarProps) {
  if (!phases.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-caption flex items-center justify-between text-muted-foreground">
        <span>
          {done} of {total} done
        </span>
        <span>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={`Onboarding progress: ${done} of ${total} steps complete`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="flex h-1.5 w-full gap-1 overflow-hidden"
        data-testid="coordinator-onboarding-progress"
      >
        {phases.map((phase) => {
          const phasePercent = phase.total > 0 ? Math.round((phase.done / phase.total) * 100) : 0;
          return (
            <div
              key={phase.id}
              data-testid={`coordinator-onboarding-progress-phase-${phase.id}`}
              data-phase-done={phase.done}
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
              phase.done === phase.total && phase.total > 0 && 'text-foreground'
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
}

function ChecklistRow({
  item,
  isChild = false,
  onAction,
  isActionWired,
  nextActionableId,
  isOnCall,
}: ChecklistRowProps) {
  const hasWiredAction = isActionWired(item.action);
  const isBlocked = !!item.disabledReason;
  const isActionable = hasWiredAction && !item.done && !isBlocked;
  const isNext = nextActionableId === item.id;
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
  const dim = !isNext && !containsNext;
  const hasInfo = !!item.description || !!item.estimatedTime;

  const handleClick = React.useCallback(() => {
    if (item.action) onAction(item.action);
  }, [item.action, onAction]);

  const rowClassName = (variant: 'done' | 'actionable' | 'blocked' | 'static') =>
    cn(
      'flex w-full items-start gap-2 rounded-md px-1.5 py-1 -mx-1.5',
      variant === 'actionable' && 'cursor-pointer hover:bg-muted/50',
      variant === 'blocked' && 'cursor-not-allowed'
      // "Next" anchor: the Next pill + the row label going
      // ``font-medium`` carries the affordance — we leave the row
      // chrome flat so the highlight reads as a guide rather than
      // a competing call-to-action.
    );

  const renderLabel = (variant: 'done' | 'actionable' | 'blocked' | 'static') => (
    <span
      className={cn(
        'text-body-sm flex-1 leading-5',
        variant === 'done' && 'text-muted-foreground line-through',
        variant === 'actionable' && (isNext ? 'font-medium text-foreground' : 'text-foreground'),
        variant === 'blocked' && 'text-muted-foreground/70',
        variant === 'static' && 'text-foreground'
      )}
    >
      {item.title}
    </span>
  );

  const renderNextPill = () =>
    isNext ? (
      <span
        className="bg-primary/15 text-caption ml-1 inline-flex flex-shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-primary"
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
            <button
              type="button"
              // ``span``-like click target nested inside the
              // actionable button isn't valid HTML — stop the
              // propagation so opening the tooltip never
              // double-fires the row action.
              onClick={(e) => e.stopPropagation()}
              aria-label={`What is "${item.title}"?`}
              className="text-muted-foreground/60 ml-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:text-foreground"
              data-testid={`coordinator-onboarding-info-${item.id}`}
            >
              <Info className="h-3 w-3" />
            </button>
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

  const rowBody = (variant: 'done' | 'actionable' | 'blocked' | 'static') => (
    <div className={rowClassName(variant)}>
      <ChecklistMarker done={item.done} />
      {renderLabel(variant)}
      {renderNextPill()}
      {renderInfoTooltip()}
    </div>
  );

  let row: React.ReactNode;
  if (item.done) {
    row = <div data-testid={`coordinator-onboarding-item-${item.id}`}>{rowBody('done')}</div>;
  } else if (isActionable) {
    row = (
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left"
        data-testid={`coordinator-onboarding-item-${item.id}`}
        data-next={isNext ? 'true' : undefined}
      >
        {rowBody('actionable')}
      </button>
    );
  } else if (isBlocked) {
    // Wrapping the disabled button in a Tooltip trigger mirrors
    // ``AssistantSetupRoadmap``'s pattern — keyboard + mouse users
    // both get the prereq hint, AT users still hear "button,
    // dimmed".
    row = (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled
              aria-disabled="true"
              data-testid={`coordinator-onboarding-item-${item.id}`}
              data-status="pending-blocked"
              className="w-full text-left"
            >
              {rowBody('blocked')}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="text-caption">{item.disabledReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  } else {
    // Static informational row: a non-actionable grouping header
    // ("Connect your coordinator") or a pending step with no
    // unblocked / wired action.
    row = <div data-testid={`coordinator-onboarding-item-${item.id}`}>{rowBody('static')}</div>;
  }

  // Read-only suggestion chips under the ``act`` / ``schedule``
  // rows — each row shows the set that matches what completes it
  // (point-in-time prompts for ``act``, scheduled/event prompts for
  // ``schedule``). Rendered only while the row is still pending +
  // unblocked — once the row lands the parent strikes it through and
  // the inspiration is no longer useful. We intentionally don't wire
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
  const showSuggestions = !!suggestionsForItem && !item.done && !isBlocked;

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
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ChecklistMarker({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-none border',
        done
          ? 'border-[color:var(--role-green-deep)] bg-[color:var(--status-success-bg)] text-[color:var(--role-green-deep)]'
          : 'border-muted-foreground/40 bg-transparent'
      )}
    >
      {done ? <Check className="h-3 w-3 stroke-[3]" /> : null}
    </span>
  );
}
