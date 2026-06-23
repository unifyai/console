'use client';

/**
 * CoordinatorOnboardingChecklist — renders the user's progress through
 * Coordinator onboarding.
 *
 * Rendered in the coordinator's assistant info panel "Onboarding"
 * sub-tab on the ``/assistants`` shell, surfaced whenever the
 * coordinator is the selected assistant.
 *
 * The step graph (ordering, dependencies, which steps are valid next
 * targets) lives entirely in Orchestra now: the server returns a
 * precomputed ``onboarding`` rendering (steps + statuses + next
 * targets) on ``Coordinator/State``, and this component renders it
 * directly. The client no longer computes availability — it only maps
 * each step id to its surface-specific action handler.
 */

import * as React from 'react';
import { Check, ChevronDown, Lock, RotateCcw } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import type {
  OnboardingChip,
  OnboardingRender,
  OnboardingStepDependency,
  OnboardingStepStatus,
} from '@/lib/assistants/coordinatorState';
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

interface OnboardingChecklistItem {
  id: string;
  title: string;
  phase?: string;
  /** Short label used in the segmented progress bar legend — kept
   * to a single word so the three phases fit comfortably across
   * the sidebar width. Only meaningful on top-level (phase) items;
   * unused on children. Falls back to ``title`` when unset. */
  phaseLabel?: string;
  /** When set, clicking the row dispatches this action via the
   * surface-supplied handler. Items without an action render as
   * static (informational) rows. */
  action?: ChecklistAction;
  /** Read-only suggestion chips shown under the row while pending. Only
   * the act/schedule steps carry these; selected by surface (chat vs
   * call). Sourced from the server render. */
  chipsChat?: OnboardingChip[];
  chipsCall?: OnboardingChip[];
  dependencies?: OnboardingStepDependency[];
  /** Sub-items render under the parent and count separately toward the
   * progress bar — same accounting model as the per-assistant setup
   * roadmap. */
  children?: OnboardingChecklistItem[];
}

/**
 * Maps each server step id to the surface-specific action this Console
 * dispatches when the row is clicked. This is the *only* per-step mapping
 * Console owns — pure client behaviour that has no place in the backend
 * graph. Everything else is sourced from Orchestra's canonical graph.
 */
const STEP_ACTIONS: Record<string, ChecklistAction> = {
  'email-reference': 'trigger-email-reference',
  'email-reply': 'start-email-reply',
  'whatsapp-number': 'add-whatsapp-number',
  'whatsapp-message-reference': 'trigger-whatsapp-message-reference',
  'whatsapp-message': 'start-whatsapp-message',
  'whatsapp-call-reference': 'trigger-whatsapp-call-reference',
  'whatsapp-call': 'start-whatsapp-call',
  'phone-number': 'add-phone-number',
  'sms-reference': 'trigger-sms-reference',
  'sms-message': 'start-sms-message',
  'phone-call-reference': 'trigger-phone-call-reference',
  'phone-call': 'start-phone-call',
  'slack-connect': 'connect-slack',
  'slack-reference': 'trigger-slack-reference',
  'slack-message': 'start-slack-message',
  'discord-connect': 'connect-discord',
  'discord-reference': 'trigger-discord-reference',
  'discord-message': 'start-discord-message',
  workspace: 'connect-workspace',
  apps: 'connect-apps',
  act: 'act',
  schedule: 'schedule',
};

const INFO_ONLY_ACTIONS = new Set<ChecklistAction>([
  'start-email-reply',
  'start-whatsapp-message',
  'start-whatsapp-call',
  'start-sms-message',
  'start-phone-call',
  'start-slack-message',
  'start-discord-message',
]);

interface ResolvedChecklistItem extends OnboardingChecklistItem {
  done: boolean;
  skipped: boolean;
  locked: boolean;
  comingSoon?: boolean;
  status: 'pending' | 'done' | 'skipped';
  sectionSkipped?: boolean;
  children?: ResolvedChecklistItem[];
}

const EMPTY_ONBOARDING_STEP_IDS: ReadonlySet<string> = new Set();
type BlockingFeedbackHint = 'next' | 'locked';
const EMPTY_BLOCKING_STEP_HINTS: ReadonlyMap<string, BlockingFeedbackHint> = new Map();

function comingSoonTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed || /^\[coming soon\]$/i.test(trimmed)) return '[coming soon]';
  if (/\[coming soon\]$/i.test(trimmed)) return trimmed;
  return `${trimmed} [coming soon]`;
}

function isOnboardingDependencySatisfied(
  status: OnboardingStepStatus,
  resolution: OnboardingStepDependency['resolution']
): boolean {
  if (resolution === 'completed') return status === 'done';
  return status === 'done' || status === 'skipped';
}

function resolveLocalStepStatuses(
  render: OnboardingRender,
  completedStepIds: ReadonlySet<string>,
  skippedStepIds: ReadonlySet<string>,
  resetStepIds: ReadonlySet<string>
): Map<string, OnboardingStepStatus> {
  const statuses = new Map<string, OnboardingStepStatus>();
  for (const step of render.steps) {
    if (resetStepIds.has(step.id)) {
      statuses.set(step.id, step.status === 'coming_soon' ? 'coming_soon' : 'available');
    } else if (completedStepIds.has(step.id) || step.status === 'done') {
      statuses.set(step.id, 'done');
    } else if (skippedStepIds.has(step.id) || step.status === 'skipped') {
      statuses.set(step.id, 'skipped');
    } else if (step.status === 'coming_soon') {
      statuses.set(step.id, 'coming_soon');
    } else {
      statuses.set(step.id, step.status === 'locked' ? 'locked' : 'available');
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const step of render.steps) {
      const current = statuses.get(step.id);
      if (current === 'done' || current === 'skipped' || current === 'coming_soon') continue;
      const next = step.dependencies.every((dependency) =>
        isOnboardingDependencySatisfied(
          statuses.get(dependency.id) ?? dependency.status,
          dependency.resolution
        )
      )
        ? 'available'
        : 'locked';
      if (current !== next) {
        statuses.set(step.id, next);
        changed = true;
      }
    }
  }

  return statuses;
}

/**
 * Build the rendered checklist tree from the server's onboarding
 * rendering. The server supplies ordering and base state; local
 * completion/skip/reset overlays are applied so immediate checklist
 * actions do not wait on a state refetch.
 *
 * Visibility mirrors the server render: ``done``/``skipped`` rows always
 * show; an ``available`` row shows only when its action is wired on this
 * surface; ``locked`` rows render as disabled children with dependency
 * explanations so the user can see why they are not active yet. A phase
 * header renders only when it has at least one visible child, and resolves
 * to done/skipped by lifting its children's statuses.
 */
function buildVisibleChecklist(
  render: OnboardingRender | null,
  isActionWired: (action: ChecklistAction | undefined) => boolean,
  completedStepIds: ReadonlySet<string>,
  skippedStepIds: ReadonlySet<string>,
  resetStepIds: ReadonlySet<string>
): ResolvedChecklistItem[] {
  if (!render) return [];

  const leavesByPhase = new Map<string, ResolvedChecklistItem[]>();
  const skippedPhases = new Set(render.skippedPhaseIds);
  const localStatuses = resolveLocalStepStatuses(
    render,
    completedStepIds,
    skippedStepIds,
    resetStepIds
  );
  for (const step of render.steps) {
    const phaseSkipped = skippedPhases.has(step.phase);
    const localStatus = localStatuses.get(step.id) ?? step.status;
    const action = STEP_ACTIONS[step.id];
    const isUnavailableAction =
      localStatus === 'available' && !!action && !isActionWired(action) && !phaseSkipped;
    const comingSoon = localStatus === 'coming_soon' || isUnavailableAction;
    const locked = localStatus === 'locked' || comingSoon;
    let status: 'pending' | 'done' | 'skipped';
    if (localStatus === 'done') status = 'done';
    else if (localStatus === 'skipped') status = 'skipped';
    else status = 'pending';

    const leaf: ResolvedChecklistItem = {
      id: step.id,
      title: comingSoon ? comingSoonTitle(step.title) : step.title,
      phase: step.phase,
      chipsChat: step.chipsChat,
      chipsCall: step.chipsCall,
      dependencies: step.dependencies.map((dependency) => {
        const dependencyStatus = localStatuses.get(dependency.id) ?? dependency.status;
        return {
          ...dependency,
          status: dependencyStatus,
          satisfied: isOnboardingDependencySatisfied(dependencyStatus, dependency.resolution),
        };
      }),
      action,
      done: status === 'done',
      skipped: status === 'skipped',
      locked,
      comingSoon,
      status,
    };
    const list = leavesByPhase.get(step.phase) ?? [];
    list.push(leaf);
    leavesByPhase.set(step.phase, list);
  }

  const result: ResolvedChecklistItem[] = [];
  for (const phase of render.phases) {
    const isCommunication = phase.id === COMMUNICATION_SECTION_ID;
    const children = isCommunication ? (leavesByPhase.get(phase.phase) ?? []) : [];
    const sectionSkipped = isCommunication && skippedPhases.has(phase.phase);
    const hasChildren = children.length > 0;
    const childrenAllDone = hasChildren && children.every((child) => child.status === 'done');
    const childrenAllResolved =
      hasChildren && children.every((child) => child.status !== 'pending');
    const childrenHaveSkipped = children.some((child) => child.status === 'skipped');
    const done = childrenAllDone;
    const skipped =
      sectionSkipped || (hasChildren && !done && childrenAllResolved && childrenHaveSkipped);
    result.push({
      id: phase.id,
      title: phase.title,
      phase: phase.phase,
      phaseLabel: phase.phase,
      done,
      skipped,
      locked: false,
      status: done ? 'done' : skipped ? 'skipped' : 'pending',
      sectionSkipped,
      children,
    });
  }
  return result;
}

const CHECKLIST_CONTROL_GRID_CLASS =
  '-mx-1.5 grid w-full grid-cols-[minmax(0,1fr)_4.5rem_1.5rem] gap-1 px-1.5';
const COMMUNICATION_SECTION_ID = 'communication';

const COMMUNICATION_SUBGROUPS: ReadonlyArray<{
  id: string;
  title: string;
  stepIds: readonly string[];
}> = [
  { id: 'email', title: 'Email', stepIds: ['email-reference', 'email-reply'] },
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    stepIds: [
      'whatsapp-number',
      'whatsapp-message-reference',
      'whatsapp-message',
      'whatsapp-call-reference',
      'whatsapp-call',
    ],
  },
  {
    id: 'phone',
    title: 'Phone',
    stepIds: ['phone-number', 'sms-reference', 'sms-message', 'phone-call-reference', 'phone-call'],
  },
  { id: 'slack', title: 'Slack', stepIds: ['slack-connect', 'slack-reference', 'slack-message'] },
  {
    id: 'discord',
    title: 'Discord',
    stepIds: ['discord-connect', 'discord-reference', 'discord-message'],
  },
];

function collectVisibleLeafIds(item: ResolvedChecklistItem): string[] {
  if (!item.children?.length) return [item.id];
  return item.children.flatMap(collectVisibleLeafIds);
}

function collectVisibleLeaves(items: readonly ResolvedChecklistItem[]): ResolvedChecklistItem[] {
  return items.flatMap((item) =>
    item.children?.length ? collectVisibleLeaves(item.children) : [item]
  );
}

function collectBlockingStepHints(
  stepId: string,
  items: readonly ResolvedChecklistItem[]
): ReadonlyMap<string, BlockingFeedbackHint> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const result = new Map<string, BlockingFeedbackHint>();
  const seen = new Set<string>();

  const visit = (currentStepId: string) => {
    const current = byId.get(currentStepId);
    if (!current) return;
    for (const dependency of current.dependencies ?? []) {
      if (dependency.satisfied || seen.has(dependency.id)) continue;
      seen.add(dependency.id);
      const dependencyItem = byId.get(dependency.id);
      if (!dependencyItem) continue;
      const canPointAtDependency =
        !dependencyItem.sectionSkipped && dependencyItem.status !== 'done';
      const dependencyHasBlockingDependencies = dependencyItem.dependencies?.some(
        (innerDependency) => !innerDependency.satisfied
      );
      if (!dependencyItem.locked && canPointAtDependency) {
        result.set(dependency.id, 'next');
      } else if (dependencyHasBlockingDependencies) {
        visit(dependency.id);
      } else if (canPointAtDependency) {
        result.set(dependency.id, dependencyItem.locked ? 'locked' : 'next');
      } else {
        visit(dependency.id);
      }
    }
  };

  visit(stepId);
  return result;
}

function progressForItems(items: readonly ResolvedChecklistItem[]): {
  completed: number;
  total: number;
} {
  const leaves = collectVisibleLeaves(items);
  return {
    completed: leaves.filter((item) => item.status !== 'pending').length,
    total: leaves.length,
  };
}

function collectDependentStepIds(
  stepId: string,
  items: readonly ResolvedChecklistItem[]
): string[] {
  const result: string[] = [stepId];
  const seen = new Set(result);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (seen.has(item.id)) continue;
      if (item.dependencies?.some((dependency) => seen.has(dependency.id))) {
        seen.add(item.id);
        result.push(item.id);
        changed = true;
      }
    }
  }
  return result;
}

function hasResolvedLeaf(item: ResolvedChecklistItem): boolean {
  if (!item.children?.length) return item.status !== 'pending';
  return item.children.some(hasResolvedLeaf);
}

function createComingSoonPlaceholder(section: ResolvedChecklistItem): ResolvedChecklistItem {
  return {
    id: `${section.id}-coming-soon-placeholder`,
    title: '[coming soon]',
    phase: section.phase,
    done: false,
    skipped: false,
    locked: true,
    comingSoon: true,
    status: 'pending',
  };
}

function communicationSubgroups(
  items: readonly ResolvedChecklistItem[]
): Array<{ id: string; title: string; items: ResolvedChecklistItem[] }> {
  const byId = new Map(items.map((item) => [item.id, item]));
  return COMMUNICATION_SUBGROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    items: group.stepIds
      .map((stepId) => byId.get(stepId))
      .filter((item): item is ResolvedChecklistItem => !!item),
  })).filter((group) => group.items.length > 0);
}

function containsLeafId(item: ResolvedChecklistItem, leafId: string): boolean {
  if (!item.children?.length) return item.id === leafId;
  return item.children.some((child) => containsLeafId(child, leafId));
}

/**
 * Identify the recommended next leaf so the UI can call it out with a
 * "Next" affordance. Walks the resolved tree in render order and
 * returns the first pending leaf with a wired action. Other pending
 * leaves remain actionable; this just provides an ordered suggestion.
 */
function findNextActionableId(
  items: ResolvedChecklistItem[],
  isActionWired: (action: ChecklistAction | undefined) => boolean
): string | null {
  for (const item of items) {
    if (item.sectionSkipped) continue;
    if (item.children?.length) {
      const inner = findNextActionableId(item.children, isActionWired);
      if (inner) return inner;
      continue;
    }
    if (!item.locked && item.status === 'pending' && item.action && isActionWired(item.action)) {
      return item.id;
    }
  }
  return null;
}

/**
 * Whether the coordinator still has an actionable onboarding step
 * outstanding. Now a thin read of the server rendering: any valid next
 * target means there is work left. Empty (everything done/skipped) or
 * absent (working / deferred) reports ``false``. Drives the info-card
 * nudge dot and the onboarding focus-layout default.
 */
export function hasOutstandingCoordinatorOnboarding(render: OnboardingRender | null): boolean {
  return (render?.nextTargets.length ?? 0) > 0;
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
  onSkipSection?: (phaseId: string) => void;
  onUnskipSection?: (phaseId: string) => void;
  /** Whether the user is currently on a voice call (vs. chat).
   * Selects which "Act now" suggestion chips show: call-friendly
   * (spoken / interactive output) vs. chat-friendly (text output).
   * Defaults to chat. */
  isOnCall?: boolean;
  className?: string;
}

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
  onSkipSection,
  onUnskipSection,
  isOnCall = false,
  className,
}: CoordinatorOnboardingChecklistProps) {
  const ctx = useCoordinatorOnboardingContext();
  const resetStepProgress = ctx?.resetStepProgress;
  const onboardingDeferred = ctx?.onboardingDeferred ?? false;
  const deferOnboarding = ctx?.deferOnboarding;
  const resumeOnboarding = ctx?.resumeOnboarding;
  const onboarding = ctx?.onboarding ?? null;
  const completedStepIds = ctx?.completedStepIds ?? EMPTY_ONBOARDING_STEP_IDS;
  const skippedStepIds = ctx?.skippedStepIds ?? EMPTY_ONBOARDING_STEP_IDS;
  const resetStepIds = ctx?.resetStepIds ?? EMPTY_ONBOARDING_STEP_IDS;
  const [openSectionIds, setOpenSectionIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const [openSubgroupIds, setOpenSubgroupIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [blockedFeedback, setBlockedFeedback] = React.useState<{
    stepId: string;
    token: number;
    blockingStepHints: ReadonlyMap<string, BlockingFeedbackHint>;
  } | null>(null);
  const didInitializeOpenSectionRef = React.useRef(false);
  const blockedFeedbackTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockedFeedbackTokenRef = React.useRef(0);

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

  const resolved = React.useMemo(
    () =>
      buildVisibleChecklist(
        onboarding,
        isActionWired,
        completedStepIds,
        skippedStepIds,
        resetStepIds
      ),
    [onboarding, isActionWired, completedStepIds, skippedStepIds, resetStepIds]
  );
  const visibleLeaves = React.useMemo(() => collectVisibleLeaves(resolved), [resolved]);
  const triggerBlockedFeedback = React.useCallback(
    (stepId: string) => {
      if (blockedFeedbackTimeoutRef.current) {
        clearTimeout(blockedFeedbackTimeoutRef.current);
      }
      blockedFeedbackTokenRef.current += 1;
      setBlockedFeedback({
        stepId,
        token: blockedFeedbackTokenRef.current,
        blockingStepHints: collectBlockingStepHints(stepId, visibleLeaves),
      });
      blockedFeedbackTimeoutRef.current = setTimeout(() => {
        setBlockedFeedback(null);
        blockedFeedbackTimeoutRef.current = null;
      }, 1_000);
    },
    [visibleLeaves]
  );

  React.useEffect(
    () => () => {
      if (blockedFeedbackTimeoutRef.current) {
        clearTimeout(blockedFeedbackTimeoutRef.current);
      }
    },
    []
  );

  // ID of the leaf row the user should tackle next. The value still
  // drives hidden state markers, but the checklist does not render an
  // inline "Next" marker.
  const nextActionableId = React.useMemo(
    () => findNextActionableId(resolved, isActionWired),
    [resolved, isActionWired]
  );
  React.useEffect(() => {
    const sectionIds = resolved.map((section) => section.id);
    setOpenSectionIds((current) => {
      const validIds = new Set(sectionIds);
      const next = new Set(Array.from(current).filter((sectionId) => validIds.has(sectionId)));
      return next.size === current.size ? current : next;
    });
  }, [resolved]);

  React.useEffect(() => {
    if (didInitializeOpenSectionRef.current || !resolved.length) return;
    const defaultSection = nextActionableId
      ? resolved.find((section) => containsLeafId(section, nextActionableId))
      : null;
    setOpenSectionIds(new Set([defaultSection?.id ?? resolved[0].id]));
    didInitializeOpenSectionRef.current = true;
  }, [nextActionableId, resolved]);

  const toggleSection = React.useCallback((sectionId: string) => {
    setOpenSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);
  const toggleSubgroup = React.useCallback((subgroupId: string) => {
    setOpenSubgroupIds((current) => {
      const next = new Set(current);
      if (next.has(subgroupId)) next.delete(subgroupId);
      else next.add(subgroupId);
      return next;
    });
  }, []);

  // Global "do onboarding later" collapses the whole checklist to a
  // single resume affordance. The underlying per-step state is
  // untouched, so resuming brings the user back exactly where they were.
  if (onboardingDeferred) {
    return (
      <div
        className={cn('flex min-h-0 flex-1 flex-col gap-3', className)}
        data-testid="coordinator-onboarding-deferred"
      >
        <div className="rounded-control bg-muted/40 px-2.5 py-2">
          <p className="text-body-sm text-muted-foreground">
            Onboarding paused — you can{' '}
            {resumeOnboarding ? (
              <button
                type="button"
                onClick={resumeOnboarding}
                className={cn(
                  'rounded-control font-medium text-primary',
                  'hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                )}
              >
                resume
              </button>
            ) : (
              <span className="font-medium text-primary">resume</span>
            )}{' '}
            anytime.
          </p>
        </div>
        <div className="mt-auto flex flex-shrink-0 justify-end pt-2">
          {resumeOnboarding ? (
            <button
              type="button"
              onClick={resumeOnboarding}
              className={cn(
                'text-caption rounded-control flex-shrink-0 px-1.5 py-0.5 font-medium text-primary',
                'hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              )}
              data-testid="coordinator-onboarding-resume"
            >
              Resume onboarding
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // Nothing to show when the server reports no active onboarding
  // (complete or working mode) — the panel falls back to its other tabs.
  if (!resolved.length) return null;

  // Offer the global defer only while there's still onboarding left to
  // do — once everything resolves there's nothing to postpone.
  const canDeferAll = !!deferOnboarding && nextActionableId !== null;
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3', className)}>
      <ul className="min-h-0 flex-1 overflow-y-auto" data-testid="coordinator-onboarding-checklist">
        <style jsx>{`
          @keyframes coordinator-onboarding-blocked-jiggle {
            0%,
            100% {
              transform: translateX(0);
            }
            20% {
              transform: translateX(-1.5px);
            }
            40% {
              transform: translateX(1.5px);
            }
            60% {
              transform: translateX(-1px);
            }
            80% {
              transform: translateX(1px);
            }
          }
        `}</style>
        {resolved.map((section, index) => {
          const isOpen = openSectionIds.has(section.id);
          const hasVisibleChildren = (section.children?.length ?? 0) > 0;
          const sectionItems = hasVisibleChildren
            ? section.children!
            : [createComingSoonPlaceholder(section)];
          return (
            <li key={section.id}>
              <SectionHeader
                section={section}
                index={index}
                progress={progressForItems(sectionItems)}
                isOpen={isOpen}
                onToggle={() => toggleSection(section.id)}
              />
              {isOpen ? (
                <ul>
                  {section.id === COMMUNICATION_SECTION_ID
                    ? communicationSubgroups(sectionItems).map((group, groupIndex) => (
                        <CommunicationSubgroup
                          key={group.id}
                          id={group.id}
                          title={`${index + 1}.${groupIndex + 1} ${group.title}`}
                          progress={progressForItems(group.items)}
                          isOpen={openSubgroupIds.has(group.id)}
                          onToggle={() => toggleSubgroup(group.id)}
                        >
                          {group.items.map((item) => (
                            <ChecklistRow
                              key={item.id}
                              item={item}
                              isChild
                              isInSkippedSection={section.sectionSkipped === true}
                              onAction={handleAction}
                              isActionWired={isActionWired}
                              nextActionableId={nextActionableId}
                              allVisibleItems={visibleLeaves}
                              blockedFeedbackStepId={blockedFeedback?.stepId ?? null}
                              blockedFeedbackToken={blockedFeedback?.token ?? 0}
                              blockingStepHints={
                                blockedFeedback?.blockingStepHints ?? EMPTY_BLOCKING_STEP_HINTS
                              }
                              onBlockedStepClick={triggerBlockedFeedback}
                              isOnCall={isOnCall}
                              onResetStepProgress={resetStepProgress}
                            />
                          ))}
                        </CommunicationSubgroup>
                      ))
                    : sectionItems.map((item) => (
                        <ChecklistRow
                          key={item.id}
                          item={item}
                          isChild
                          isInSkippedSection={section.sectionSkipped === true}
                          onAction={handleAction}
                          isActionWired={isActionWired}
                          nextActionableId={nextActionableId}
                          allVisibleItems={visibleLeaves}
                          blockedFeedbackStepId={blockedFeedback?.stepId ?? null}
                          blockedFeedbackToken={blockedFeedback?.token ?? 0}
                          blockingStepHints={
                            blockedFeedback?.blockingStepHints ?? EMPTY_BLOCKING_STEP_HINTS
                          }
                          onBlockedStepClick={triggerBlockedFeedback}
                          isOnCall={isOnCall}
                          onResetStepProgress={resetStepProgress}
                        />
                      ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-shrink-0 justify-end pt-2">
        {canDeferAll ? (
          <button
            type="button"
            onClick={deferOnboarding}
            className={cn(
              'text-caption rounded-control whitespace-nowrap px-1.5 py-0.5 text-muted-foreground',
              'hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
            data-testid="coordinator-onboarding-defer-all"
          >
            Pause onboarding for now
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  section: ResolvedChecklistItem;
  index: number;
  progress: { completed: number; total: number };
  isOpen: boolean;
  onToggle: () => void;
}

function CompactProgress({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <span
      className="flex w-16 flex-col gap-1 justify-self-center"
      aria-label={`${completed} of ${total}`}
    >
      <span className="text-caption text-center tabular-nums text-muted-foreground">
        {completed}/{total}
      </span>
      <span className="h-1 overflow-hidden rounded-full bg-muted">
        <span className="block h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

function SectionHeader({ section, index, progress, isOpen, onToggle }: SectionHeaderProps) {
  const label = `${index + 1}. ${section.title}`;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className={cn(
        CHECKLIST_CONTROL_GRID_CLASS,
        'group/onboarding-section rounded-control cursor-pointer items-center py-3 text-left',
        'bg-transparent transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
      )}
      data-testid={`coordinator-onboarding-section-${section.id}`}
    >
      <span
        className="text-body-sm min-w-0 flex-1 truncate font-medium text-foreground transition-colors group-hover/onboarding-section:text-muted-foreground group-focus-visible/onboarding-section:text-muted-foreground"
        data-testid={`coordinator-onboarding-section-${section.id}-toggle`}
      >
        {label}
      </span>
      <CompactProgress completed={progress.completed} total={progress.total} />
      <span className="flex h-6 w-6 items-center justify-center justify-self-center text-muted-foreground">
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', !isOpen && '-rotate-90')}
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

function CommunicationSubgroup({
  id,
  title,
  progress,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  progress: { completed: number; total: number };
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <li data-testid={`coordinator-onboarding-communication-${id}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          CHECKLIST_CONTROL_GRID_CLASS,
          'group/onboarding-subgroup rounded-control cursor-pointer items-center py-3 pl-5 text-left',
          'bg-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
        data-testid={`coordinator-onboarding-communication-${id}-toggle`}
      >
        <span className="text-body-sm min-w-0 flex-1 truncate font-medium text-foreground transition-colors group-hover/onboarding-subgroup:text-muted-foreground group-focus-visible/onboarding-subgroup:text-muted-foreground">
          {title}
        </span>
        <CompactProgress completed={progress.completed} total={progress.total} />
        <span className="flex h-6 w-6 items-center justify-center justify-self-center text-muted-foreground">
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', !isOpen && '-rotate-90')}
            aria-hidden="true"
          />
        </span>
      </button>
      {isOpen ? <ul>{children}</ul> : null}
    </li>
  );
}

interface ChecklistRowProps {
  item: ResolvedChecklistItem;
  isChild?: boolean;
  isInSkippedSection?: boolean;
  onAction: (action: ChecklistAction) => void;
  isActionWired: (action: ChecklistAction | undefined) => boolean;
  /** ID of the next leaf the user should tackle. Used for default
   * section selection and hidden state markers; threaded down rather
   * than recomputed per-row so the lookup stays O(checklist-size)
   * in total. */
  nextActionableId: string | null;
  allVisibleItems: readonly ResolvedChecklistItem[];
  blockedFeedbackStepId: string | null;
  blockedFeedbackToken: number;
  blockingStepHints: ReadonlyMap<string, BlockingFeedbackHint>;
  onBlockedStepClick: (stepId: string) => void;
  /** Whether the user is on a call — selects the call vs. chat
   * "Act now" suggestion chips. */
  isOnCall: boolean;
  onSkipSection?: (phaseId: string) => void;
  onUnskipSection?: (phaseId: string) => void;
  onResetStepProgress?: (stepIds: readonly string[], resetStepId?: string) => void;
}

function ChecklistRow({
  item,
  isChild = false,
  isInSkippedSection = false,
  onAction,
  isActionWired,
  nextActionableId,
  allVisibleItems,
  blockedFeedbackStepId,
  blockedFeedbackToken,
  blockingStepHints,
  onBlockedStepClick,
  isOnCall,
  onResetStepProgress,
}: ChecklistRowProps) {
  const hasWiredAction = isActionWired(item.action);
  const isResolved = item.status !== 'pending';
  const isNext = nextActionableId === item.id;
  const sectionDisabled = isInSkippedSection || item.sectionSkipped === true;
  const hasDirectAction = hasWiredAction && !!item.action && !INFO_ONLY_ACTIONS.has(item.action);
  const isActionable = hasDirectAction && !item.locked && !isResolved && !sectionDisabled;
  const canShowBlockedFeedback =
    item.locked && !item.children?.length && item.status === 'pending' && !sectionDisabled;
  const shouldJiggle = blockedFeedbackStepId === item.id;
  const blockingHint = blockingStepHints.get(item.id);
  const canResetSection =
    !isChild &&
    !!item.children?.length &&
    !!onResetStepProgress &&
    !item.sectionSkipped &&
    hasResolvedLeaf(item);
  const resetStepIds = React.useMemo(() => collectVisibleLeafIds(item), [item]);
  const rowResetStepIds = React.useMemo(
    () => collectDependentStepIds(item.id, allVisibleItems),
    [allVisibleItems, item.id]
  );
  // Only inaccessible/future rows dim. Addressed rows (done or skipped)
  // should remain readable so their state is clear.
  const dim = item.locked || sectionDisabled;
  const rowClassName = (variant: 'done' | 'skipped' | 'actionable' | 'static') =>
    cn(
      CHECKLIST_CONTROL_GRID_CLASS,
      'group/onboarding-row items-start rounded-md py-1',
      variant === 'actionable' && 'cursor-pointer hover:bg-muted/50',
      canShowBlockedFeedback && 'cursor-pointer hover:bg-muted/40'
    );

  const renderLabel = (variant: 'done' | 'skipped' | 'actionable' | 'static') => (
    <span
      className={cn(
        'text-body-sm flex-1 leading-5',
        variant === 'done' && 'text-muted-foreground line-through',
        variant === 'skipped' && 'text-muted-foreground line-through',
        variant === 'actionable' && 'text-foreground',
        variant === 'static' && (item.comingSoon ? 'text-muted-foreground' : 'text-foreground')
      )}
    >
      {item.title}
    </span>
  );

  const dimClassName = dim ? 'opacity-50 transition-opacity' : undefined;
  const canReset = item.status === 'done' && !!onResetStepProgress;
  const hasRowMenu = canReset;

  const renderMarkerAndLabel = (variant: 'done' | 'skipped' | 'actionable' | 'static') => {
    const content = (
      <span
        className={cn(
          'flex min-w-0 flex-1 items-start',
          isChild && 'pl-6',
          hasRowMenu && 'cursor-pointer',
          dimClassName
        )}
      >
        <span className="inline-flex min-w-0 items-start gap-2">
          <ChecklistMarker status={item.status} locked={item.comingSoon === true} />
          {renderLabel(variant)}
        </span>
      </span>
    );

    if (!hasRowMenu) return content;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{content}</DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="start"
          alignOffset={isChild ? 24 : 0}
          className="min-w-[6rem]"
        >
          {canReset ? (
            <DropdownMenuItem onSelect={() => onResetStepProgress?.(rowResetStepIds, item.id)}>
              Reset
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

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

  const rowBody = (variant: 'done' | 'skipped' | 'actionable' | 'static') => (
    <div className={rowClassName(variant)}>
      {renderMarkerAndLabel(variant)}
      <span className="flex h-6 items-center justify-center gap-1">
        {blockingHint ? (
          <span
            className="text-caption whitespace-nowrap font-medium text-primary"
            data-testid={`coordinator-onboarding-blocking-arrow-${item.id}`}
          >
            ← {blockingHint === 'next' ? 'Next' : 'Locked'}
          </span>
        ) : (
          <span className={cn('flex h-6 items-center justify-center gap-1', dimClassName)}>
            {renderResetSectionButton()}
          </span>
        )}
      </span>
      <span aria-hidden="true" className="flex h-6 items-center justify-center" />
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
        onClick={() => item.action && onAction(item.action)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            item.action && onAction(item.action);
          }
        }}
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
        key={shouldJiggle ? `${item.id}-${blockedFeedbackToken}` : item.id}
        role={canShowBlockedFeedback ? 'button' : undefined}
        tabIndex={canShowBlockedFeedback ? 0 : undefined}
        onClick={canShowBlockedFeedback ? () => onBlockedStepClick(item.id) : undefined}
        onKeyDown={
          canShowBlockedFeedback
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onBlockedStepClick(item.id);
                }
              }
            : undefined
        }
        className={
          canShowBlockedFeedback
            ? 'w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            : undefined
        }
        style={
          shouldJiggle
            ? { animation: 'coordinator-onboarding-blocked-jiggle 280ms ease-out 0s 1' }
            : undefined
        }
        data-testid={`coordinator-onboarding-item-${item.id}`}
        data-status={item.locked ? 'locked' : undefined}
        data-next={isNext ? 'true' : undefined}
        data-blocked-feedback={shouldJiggle ? 'true' : undefined}
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
  // Suggestion chips come from the server render (sourced from the
  // canonical graph). The chat/call split lives in the data: ``act``
  // carries distinct sets, ``schedule`` carries the same set for both,
  // and every other step carries none — so an empty list naturally
  // means "no chips here".
  const suggestionsForItem = isOnCall ? item.chipsCall : item.chipsChat;
  const showSuggestions =
    !!suggestionsForItem?.length && item.status === 'pending' && !item.locked && !sectionDisabled;

  return (
    <li className="flex flex-col gap-2">
      {row}
      {showSuggestions && suggestionsForItem ? (
        <ul
          className={cn('ml-6 flex flex-wrap gap-1.5', dimClassName)}
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
              isInSkippedSection={item.sectionSkipped === true || isInSkippedSection}
              onAction={onAction}
              isActionWired={isActionWired}
              nextActionableId={nextActionableId}
              allVisibleItems={allVisibleItems}
              blockedFeedbackStepId={blockedFeedbackStepId}
              blockedFeedbackToken={blockedFeedbackToken}
              blockingStepHints={blockingStepHints}
              onBlockedStepClick={onBlockedStepClick}
              isOnCall={isOnCall}
              onResetStepProgress={onResetStepProgress}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ChecklistMarker({
  status,
  locked = false,
}: {
  status: 'pending' | 'done' | 'skipped';
  locked?: boolean;
}) {
  const markerClasses = cn(
    'rounded-control mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center border',
    status === 'done'
      ? 'border-[color:var(--role-green-deep)] bg-[color:var(--status-success-bg)] text-[color:var(--role-green-deep)]'
      : status === 'skipped'
        ? 'border-muted-foreground/60 bg-muted text-muted-foreground'
        : locked
          ? 'border-muted-foreground/30 bg-muted/30 text-muted-foreground'
          : 'border-muted-foreground/40 bg-transparent'
  );

  // Skipped rows mark the box with an "S" (for "Skip"). The glyph
  // alone is opaque, so the box doubles as a tooltip trigger that
  // spells out "Skipped" on hover/focus.
  if (status === 'skipped') {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip disableHoverableContent>
          <TooltipTrigger asChild>
            <span tabIndex={0} aria-label="Skipped" className={markerClasses}>
              <span aria-hidden="true" className="text-caption font-semibold leading-none">
                S
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="pointer-events-none">
            <p className="text-caption">Skipped</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <span aria-hidden="true" className={markerClasses}>
      {status === 'done' ? (
        <Check className="h-3 w-3 stroke-[4]" />
      ) : locked ? (
        <Lock className="h-2.5 w-2.5 stroke-[3]" />
      ) : null}
    </span>
  );
}
