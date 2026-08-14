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
import {
  Check,
  ChevronDown,
  ExternalLink,
  Lock,
  MoreHorizontal,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
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
import { ScrollArea } from '@/components/UI/scroll-area';
import { cn } from '@/lib/utils';
import type {
  OnboardingChip,
  OnboardingRender,
  OnboardingStepDependency,
  OnboardingStepStatus,
} from '@/lib/assistants/coordinatorState';
import { useCoordinatorOnboardingContext } from './CoordinatorOnboardingContext';
import {
  readCoordinatorOnboardingFoldState,
  writeCoordinatorOnboardingFoldState,
} from '@/lib/assistants/coordinatorOnboardingFoldState';

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
  | 'connect-ms-teams'
  | 'open-ms-teams-chat'
  | 'start-ms-teams-message'
  | 'add-discord-id'
  | 'connect-discord'
  | 'trigger-discord-reference'
  | 'start-discord-message'
  | 'connect-workspace'
  | 'trigger-workspace-mailbox'
  | 'trigger-workspace-drive'
  | 'trigger-workspace-calendar'
  | 'connect-apps'
  | 'trigger-integration-read'
  | 'trigger-integration-action'
  | 'act'
  | 'create-scheduled-task'
  | 'create-triggerable-task'
  | 'learn-from-correction'
  | 'my-computer-demo'
  | 'connect-your-computer'
  | 'enable-desktop-filesys'
  | 'trigger-your-computer-demo';

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
  /** Whether the server allows this step to be skipped. */
  canSkip?: boolean;
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
  'ms-teams-connect': 'connect-ms-teams',
  'ms-teams-reference': 'open-ms-teams-chat',
  'ms-teams-message': 'start-ms-teams-message',
  'discord-id': 'add-discord-id',
  'discord-connect': 'connect-discord',
  'discord-reference': 'trigger-discord-reference',
  'discord-message': 'start-discord-message',
  workspace: 'connect-workspace',
  'workspace-mailbox': 'trigger-workspace-mailbox',
  'workspace-drive': 'trigger-workspace-drive',
  'workspace-calendar': 'trigger-workspace-calendar',
  apps: 'connect-apps',
  'integration-read': 'trigger-integration-read',
  'integration-action': 'trigger-integration-action',
  act: 'act',
  'create-scheduled-task': 'create-scheduled-task',
  'create-triggerable-task': 'create-triggerable-task',
  'learn-from-correction': 'learn-from-correction',
  'my-computer-demo': 'my-computer-demo',
  'your-computer-link': 'connect-your-computer',
  'your-computer-filesys': 'enable-desktop-filesys',
  'your-computer-demo': 'trigger-your-computer-demo',
};

const ACTION_FEEDBACK_LABELS: Partial<Record<ChecklistAction, string>> = {
  'trigger-email-reference': 'Sending...',
  'start-email-reply': 'Checking...',
  'trigger-whatsapp-message-reference': 'Sending...',
  'start-whatsapp-message': 'Checking...',
  'trigger-whatsapp-call-reference': 'Calling...',
  'start-whatsapp-call': 'Checking...',
  'trigger-sms-reference': 'Sending...',
  'start-sms-message': 'Checking...',
  'trigger-phone-call-reference': 'Calling...',
  'start-phone-call': 'Checking...',
  'trigger-slack-reference': 'Sending...',
  'start-slack-message': 'Checking...',
  'open-ms-teams-chat': 'Opening...',
  'start-ms-teams-message': 'Checking...',
  'trigger-discord-reference': 'Sending...',
  'start-discord-message': 'Checking...',
  'trigger-workspace-mailbox': 'Summarizing...',
  'trigger-workspace-drive': 'Summarizing...',
  'trigger-workspace-calendar': 'Summarizing...',
  'trigger-integration-read': 'Reading...',
  'trigger-integration-action': 'Working...',
  'connect-apps': 'Connecting...',
  'create-scheduled-task': 'Starting...',
  'create-triggerable-task': 'Starting...',
  'learn-from-correction': 'Starting...',
  'my-computer-demo': 'Starting...',
  'trigger-your-computer-demo': 'Fetching...',
};
const ACTION_FEEDBACK_MS = 4_500;

interface ResolvedChecklistItem extends OnboardingChecklistItem {
  done: boolean;
  skipped: boolean;
  locked: boolean;
  inProgress?: boolean;
  comingSoon?: boolean;
  status: 'pending' | 'done' | 'skipped';
  sectionSkipped?: boolean;
  children?: ResolvedChecklistItem[];
}

const EMPTY_ONBOARDING_STEP_IDS: ReadonlySet<string> = new Set();

/**
 * Step ids that are not yet shipped. Dropping them from the rendered
 * tree leaves their phase with no visible children, so it falls back to
 * the generic locked "[coming soon]" placeholder (see
 * ``createComingSoonPlaceholder``) — the same empty-section treatment the
 * Learning phase gets — instead of surfacing an actionable row.
 */
const COMING_SOON_STEP_IDS: ReadonlySet<string> = new Set();

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
    } else if (step.status === 'in_progress') {
      statuses.set(step.id, 'in_progress');
    } else {
      statuses.set(step.id, step.status === 'locked' ? 'locked' : 'available');
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const step of render.steps) {
      const current = statuses.get(step.id);
      if (
        current === 'done' ||
        current === 'skipped' ||
        current === 'coming_soon' ||
        current === 'in_progress'
      ) {
        continue;
      }
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
    if (COMING_SOON_STEP_IDS.has(step.id)) continue;
    const phaseSkipped = skippedPhases.has(step.phase);
    const localStatus = localStatuses.get(step.id) ?? step.status;
    const action = STEP_ACTIONS[step.id];
    const inProgress = localStatus === 'in_progress';
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
      canSkip: step.canSkip,
      done: status === 'done',
      skipped: status === 'skipped',
      locked,
      inProgress,
      comingSoon,
      status,
    };
    const list = leavesByPhase.get(step.phase) ?? [];
    list.push(leaf);
    leavesByPhase.set(step.phase, list);
  }

  const result: ResolvedChecklistItem[] = [];
  for (const phase of render.phases) {
    const children = leavesByPhase.get(phase.phase) ?? [];
    const sectionSkipped = skippedPhases.has(phase.phase);
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
  '-mx-1.5 grid w-full grid-cols-[minmax(0,1fr)_4.5rem_1.5rem_1.5rem] gap-1 px-1.5';
const COMMUNICATION_SECTION_ID = 'communication';
const WORKSPACE_SECTION_ID = 'workspace';

/** Overview pages for each onboarding section in the public docs site. */
const ONBOARDING_SECTION_DOCS_URLS: Readonly<Record<string, string>> = {
  communication: 'https://docs.unify.ai/communication/overview',
  workspace: 'https://docs.unify.ai/workspace/overview',
  integrations: 'https://docs.unify.ai/integrations/overview',
  tasks: 'https://docs.unify.ai/tasks/overview',
  learning: 'https://docs.unify.ai/learning/overview',
  canvas: 'https://docs.unify.ai/canvas/overview',
  'your-computer': 'https://docs.unify.ai/their-computer/overview',
  'my-computer': 'https://docs.unify.ai/your-computer/overview',
  teams: 'https://docs.unify.ai/teams/overview',
  hiring: 'https://docs.unify.ai/hiring/overview',
};

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
    stepIds: ['discord-id', 'discord-connect', 'discord-reference', 'discord-message'],
  },
];

// Microsoft Teams is grouped under Workspace (rendered as the 2.1 subgroup) and
// is only present when the connected workspace is Microsoft — the backend gates
// visibility, so the subgroup simply disappears for Google workspaces.
const WORKSPACE_SUBGROUPS: ReadonlyArray<{
  id: string;
  title: string;
  stepIds: readonly string[];
}> = [
  {
    id: 'ms_teams',
    title: 'Microsoft Teams',
    stepIds: ['ms-teams-connect', 'ms-teams-reference', 'ms-teams-message'],
  },
];

// Sections that render their steps under collapsible subgroups. Any section not
// listed here renders its steps as flat rows; steps in a section that are not
// claimed by a subgroup render flat before the section's subgroups.
const SECTION_SUBGROUPS: Readonly<
  Record<string, ReadonlyArray<{ id: string; title: string; stepIds: readonly string[] }>>
> = {
  [COMMUNICATION_SECTION_ID]: COMMUNICATION_SUBGROUPS,
  [WORKSPACE_SECTION_ID]: WORKSPACE_SUBGROUPS,
};

// Connect steps for Slack and Microsoft Teams stand for a single install that is
// shared org-wide: one workspace/tenant connection serves every user in the org
// and its completion is derived server-side from that install existing. A single
// user's onboarding reset must therefore never re-open or tear these down —
// resetting them would either be a no-op (state re-derives from the live install)
// or, if it revoked, would disconnect the whole org. Only the owner-scoped
// Disconnect action may remove a shared install.
const NON_RESETTABLE_STEP_IDS: ReadonlySet<string> = new Set(['slack-connect', 'ms-teams-connect']);

// Saved contact details (WhatsApp/phone number, Discord ID) back their steps'
// derivation from durable user state. A section reset clears the channel's quiz
// tasks but must leave the saved detail intact so the user need not re-enter it —
// mirroring Orchestra's completion_coupled_steps. The detail row itself stays
// individually resettable via its own row menu.
const STICKY_CONTACT_DETAIL_STEP_IDS: ReadonlySet<string> = new Set([
  'whatsapp-number',
  'phone-number',
  'discord-id',
]);

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
    canSkip: false,
    status: 'pending',
  };
}

function sectionSubgroups(
  sectionId: string,
  items: readonly ResolvedChecklistItem[]
): Array<{ id: string; title: string; items: ResolvedChecklistItem[] }> {
  const config = SECTION_SUBGROUPS[sectionId];
  if (!config) return [];
  const byId = new Map(items.map((item) => [item.id, item]));
  return config
    .map((group) => ({
      id: group.id,
      title: group.title,
      items: group.stepIds
        .map((stepId) => byId.get(stepId))
        .filter((item): item is ResolvedChecklistItem => !!item),
    }))
    .filter((group) => group.items.length > 0);
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
    if (
      !item.locked &&
      item.status === 'pending' &&
      !item.inProgress &&
      item.action &&
      isActionWired(item.action)
    ) {
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
  onAddDiscordId?: () => void;
  onConnectSlack?: () => void;
  onConnectMsTeams?: () => void;
  /** Opens the 1:1 Teams chat with the Unify bot (adding the app for the
   * user first if needed) so they can send it a first message. The bot is
   * reply-only, so this user-initiated send is what seeds the conversation
   * reference before Twin can reply. Hung off the ``ms-teams-reference``
   * row. Unset means the row degrades to a static entry. */
  onOpenMsTeamsChat?: () => void;
  onConnectDiscord?: () => void;
  /** Opens the workspace OAuth dialog. Hung off the "Give T-W1N
   * access to your workspace" sub-item. Unset means
   * the row degrades to a static checklist entry. */
  onConnectWorkspace?: () => void;
  /** Opens the Integrations pane in the current surface. Hung off
   * "Connect T-W1N with your apps". Unset means the
   * row degrades to a static entry. */
  onConnectApps?: () => void;
  /** Opens the live Actions viewer in the current surface. Hung off
   * "Ask me to do something now" — the user gives a
   * one-off job and watches it run live. Unset means the row
   * degrades to a static entry. */
  onActNow?: () => void;
  /** Opens the Tasks pane in the current surface. Hung off
   * "Create a scheduled task" — the user schedules a task and watches me
   * report back. Unset means the row degrades to a static entry. */
  onCreateScheduledTask?: () => void;
  /** Opens the Tasks pane in the current surface. Hung off
   * "Create a triggerable task" — the user arms an event-triggered task.
   * Unset means the row degrades to a static entry. */
  onCreateTriggerableTask?: () => void;
  /** Dispatch the event for one Tasks-phase example chip so Twin sets that
   * specific task up straight away. ``stepId`` is the owning beat row id
   * (``create-scheduled-task`` / ``create-triggerable-task``); ``chipId`` the
   * chip's id. Unset leaves the chips as read-only inspiration. */
  onSelectTaskChip?: (stepId: string, chipId: string) => void;
  /** Dispatches the Learning tutorial beat event to Unity. Hung off
   * ``learn-from-correction``. Unset means the row degrades to a static entry. */
  onLearnFromCorrection?: () => void;
  /** Dispatches the My Computer live demo beat event to Unity. Hung off
   * ``my-computer-demo``. Unset means the row degrades to a static entry. */
  onMyComputerDemo?: () => void;
  /** Opens the desktop-linker dialog so the user can install/link their
   * computer. Hung off ``your-computer-link``. Unset means the row degrades
   * to a static entry. */
  onConnectYourComputer?: () => void;
  /** Opens the same desktop-linker dialog so the user can flip the
   * filesystem-access toggle. Hung off ``your-computer-filesys``. Unset means
   * the row degrades to a static entry. */
  onEnableDesktopFilesys?: () => void;
  /** Dispatches the Their Computer fetch-and-return beat event to Unity.
   * Hung off ``your-computer-demo``. Unset means the row degrades to a
   * static entry. */
  onYourComputerDemo?: () => void;
  onSkipStep?: (stepId: string) => void;
  onUnskipStep?: (stepId: string) => void;
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
  onAddDiscordId,
  onConnectSlack,
  onConnectMsTeams,
  onOpenMsTeamsChat,
  onConnectDiscord,
  onConnectWorkspace,
  onConnectApps,
  onActNow,
  onCreateScheduledTask,
  onCreateTriggerableTask,
  onSelectTaskChip,
  onLearnFromCorrection,
  onMyComputerDemo,
  onConnectYourComputer,
  onEnableDesktopFilesys,
  onYourComputerDemo,
  onSkipStep,
  onUnskipStep,
  isOnCall = false,
  className,
}: CoordinatorOnboardingChecklistProps) {
  const ctx = useCoordinatorOnboardingContext();
  const resetStepProgress = ctx?.resetStepProgress;
  const onboardingActive = ctx?.onboardingActive ?? false;
  const setOnboardingActive = ctx?.setOnboardingActive;
  const onboarding = ctx?.onboarding ?? null;
  const completedStepIds = ctx?.completedStepIds ?? EMPTY_ONBOARDING_STEP_IDS;
  const skippedStepIds = ctx?.skippedStepIds ?? EMPTY_ONBOARDING_STEP_IDS;
  const resetStepIds = ctx?.resetStepIds ?? EMPTY_ONBOARDING_STEP_IDS;
  const firstLoginCommunicationEmailOpenRequest = ctx?.firstLoginCommunicationEmailOpenRequest ?? 0;
  const acknowledgeFirstLoginCommunicationEmailOpen =
    ctx?.acknowledgeFirstLoginCommunicationEmailOpen;
  const storedFoldStateRef = React.useRef(readCoordinatorOnboardingFoldState());
  const [openSectionIds, setOpenSectionIds] = React.useState<ReadonlySet<string>>(() => {
    const stored = storedFoldStateRef.current;
    return stored?.sectionIds.length ? new Set(stored.sectionIds) : new Set();
  });
  const [openSubgroupIds, setOpenSubgroupIds] = React.useState<ReadonlySet<string>>(() => {
    const stored = storedFoldStateRef.current;
    return stored?.subgroupIds.length ? new Set(stored.subgroupIds) : new Set();
  });
  const [blockedFeedback, setBlockedFeedback] = React.useState<{
    stepId: string;
    token: number;
    blockingStepHints: ReadonlyMap<string, BlockingFeedbackHint>;
  } | null>(null);
  const [actionFeedbackByStepId, setActionFeedbackByStepId] = React.useState<
    ReadonlyMap<string, string>
  >(() => new Map());
  const actionFeedbackTimeoutsRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const didInitializeOpenSectionRef = React.useRef(false);
  const didInitializeOpenSubgroupRef = React.useRef(false);
  const foldStateHydratedRef = React.useRef(false);
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
      else if (action === 'connect-ms-teams') onConnectMsTeams?.();
      else if (action === 'open-ms-teams-chat') onOpenMsTeamsChat?.();
      else if (action === 'start-ms-teams-message') onStartOnboardingStep?.('ms-teams-message');
      else if (action === 'add-discord-id') onAddDiscordId?.();
      else if (action === 'connect-discord') onConnectDiscord?.();
      else if (action === 'trigger-discord-reference')
        onTriggerReferenceStep?.('discord-reference');
      else if (action === 'start-discord-message') onStartOnboardingStep?.('discord-message');
      else if (action === 'connect-workspace') onConnectWorkspace?.();
      else if (action === 'trigger-workspace-mailbox')
        onTriggerReferenceStep?.('workspace-mailbox');
      else if (action === 'trigger-workspace-drive') onTriggerReferenceStep?.('workspace-drive');
      else if (action === 'trigger-workspace-calendar')
        onTriggerReferenceStep?.('workspace-calendar');
      else if (action === 'connect-apps') onConnectApps?.();
      else if (action === 'trigger-integration-read') onTriggerReferenceStep?.('integration-read');
      else if (action === 'trigger-integration-action')
        onTriggerReferenceStep?.('integration-action');
      else if (action === 'act') onActNow?.();
      else if (action === 'create-scheduled-task') onCreateScheduledTask?.();
      else if (action === 'create-triggerable-task') onCreateTriggerableTask?.();
      else if (action === 'learn-from-correction') onLearnFromCorrection?.();
      else if (action === 'my-computer-demo') onMyComputerDemo?.();
      else if (action === 'connect-your-computer') onConnectYourComputer?.();
      else if (action === 'enable-desktop-filesys') onEnableDesktopFilesys?.();
      else if (action === 'trigger-your-computer-demo') onYourComputerDemo?.();
    },
    [
      onStartOnboardingStep,
      onTriggerReferenceStep,
      onAddWhatsappNumber,
      onAddPhoneNumber,
      onAddDiscordId,
      onConnectSlack,
      onConnectMsTeams,
      onOpenMsTeamsChat,
      onConnectDiscord,
      onConnectWorkspace,
      onConnectApps,
      onActNow,
      onCreateScheduledTask,
      onCreateTriggerableTask,
      onLearnFromCorrection,
      onMyComputerDemo,
      onConnectYourComputer,
      onEnableDesktopFilesys,
      onYourComputerDemo,
    ]
  );

  const triggerActionFeedback = React.useCallback((stepId: string, label: string) => {
    const existingTimeout = actionFeedbackTimeoutsRef.current.get(stepId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    setActionFeedbackByStepId((current) => {
      if (current.get(stepId) === label) return current;
      const next = new Map(current);
      next.set(stepId, label);
      return next;
    });
    const timeout = setTimeout(() => {
      actionFeedbackTimeoutsRef.current.delete(stepId);
      setActionFeedbackByStepId((current) => {
        if (!current.has(stepId)) return current;
        const next = new Map(current);
        next.delete(stepId);
        return next;
      });
    }, ACTION_FEEDBACK_MS);
    actionFeedbackTimeoutsRef.current.set(stepId, timeout);
  }, []);

  const handleChecklistRowAction = React.useCallback(
    (item: ResolvedChecklistItem) => {
      if (!item.action) return;
      const actionFeedbackLabel = ACTION_FEEDBACK_LABELS[item.action];
      if (actionFeedbackLabel) {
        triggerActionFeedback(item.id, actionFeedbackLabel);
      }
      handleAction(item.action);
    },
    [handleAction, triggerActionFeedback]
  );

  // Tasks-beat chips dispatch straight through ``onSelectTaskChip`` rather than
  // ``handleChecklistRowAction``, so wrap the parent handler to surface the same
  // transient row feedback the reference-quiz rows show on click. Stays
  // undefined when no handler is wired so the ``chipsClickable`` gate keeps the
  // chips read-only.
  const handleSelectTaskChip = React.useMemo(
    () =>
      onSelectTaskChip
        ? (stepId: string, chipId: string) => {
            triggerActionFeedback(stepId, 'Setting up...');
            onSelectTaskChip(stepId, chipId);
          }
        : undefined,
    [onSelectTaskChip, triggerActionFeedback]
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
      if (action === 'open-ms-teams-chat') {
        return !!onOpenMsTeamsChat;
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
      if (action === 'start-ms-teams-message') return !!onStartOnboardingStep && !!onConnectMsTeams;
      if (action === 'start-discord-message') return !!onStartOnboardingStep && !!onConnectDiscord;
      if (action === 'add-whatsapp-number') return !!onAddWhatsappNumber;
      if (action === 'add-phone-number') return !!onAddPhoneNumber;
      if (action === 'add-discord-id') return !!onAddDiscordId;
      if (action === 'connect-slack') return !!onConnectSlack;
      if (action === 'connect-ms-teams') return !!onConnectMsTeams;
      if (action === 'connect-discord') return !!onConnectDiscord;
      if (action === 'connect-workspace') return !!onConnectWorkspace;
      if (
        action === 'trigger-workspace-mailbox' ||
        action === 'trigger-workspace-drive' ||
        action === 'trigger-workspace-calendar'
      ) {
        return !!onTriggerReferenceStep && !!onConnectWorkspace;
      }
      if (action === 'connect-apps') return !!onConnectApps;
      if (action === 'trigger-integration-read' || action === 'trigger-integration-action') {
        return !!onTriggerReferenceStep;
      }
      if (action === 'act') return !!onActNow;
      if (action === 'create-scheduled-task') return !!onCreateScheduledTask;
      if (action === 'create-triggerable-task') return !!onCreateTriggerableTask;
      if (action === 'learn-from-correction') return !!onLearnFromCorrection;
      if (action === 'my-computer-demo') return !!onMyComputerDemo;
      if (action === 'connect-your-computer') return !!onConnectYourComputer;
      if (action === 'enable-desktop-filesys') return !!onEnableDesktopFilesys;
      if (action === 'trigger-your-computer-demo') return !!onYourComputerDemo;
      return false;
    },
    [
      onStartOnboardingStep,
      onTriggerReferenceStep,
      onAddWhatsappNumber,
      onAddPhoneNumber,
      onAddDiscordId,
      onConnectSlack,
      onConnectMsTeams,
      onOpenMsTeamsChat,
      onConnectDiscord,
      onConnectWorkspace,
      onConnectApps,
      onActNow,
      onCreateScheduledTask,
      onCreateTriggerableTask,
      onLearnFromCorrection,
      onMyComputerDemo,
      onConnectYourComputer,
      onEnableDesktopFilesys,
      onYourComputerDemo,
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
      for (const timeout of actionFeedbackTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      actionFeedbackTimeoutsRef.current.clear();
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
    const validSectionIds = new Set(resolved.map((section) => section.id));
    setOpenSectionIds((current) => {
      const filtered = new Set(
        Array.from(current).filter((sectionId) => validSectionIds.has(sectionId))
      );
      if (filtered.size > 0) {
        didInitializeOpenSectionRef.current = true;
        foldStateHydratedRef.current = true;
        return filtered.size === current.size ? current : filtered;
      }
      const communicationSection = resolved.find(
        (section) => section.id === COMMUNICATION_SECTION_ID
      );
      const defaultSection =
        communicationSection ??
        (nextActionableId
          ? resolved.find((section) => containsLeafId(section, nextActionableId))
          : null);
      didInitializeOpenSectionRef.current = true;
      foldStateHydratedRef.current = true;
      return new Set([defaultSection?.id ?? resolved[0].id]);
    });
  }, [nextActionableId, resolved]);

  React.useEffect(() => {
    if (!foldStateHydratedRef.current) return;
    writeCoordinatorOnboardingFoldState({
      sectionIds: [...openSectionIds],
      subgroupIds: [...openSubgroupIds],
    });
  }, [openSectionIds, openSubgroupIds]);

  const hasVisibleEmailSubgroup = React.useMemo(() => {
    const communicationSection = resolved.find(
      (section) => section.id === COMMUNICATION_SECTION_ID
    );
    if (!communicationSection?.children?.length) return false;
    return sectionSubgroups(COMMUNICATION_SECTION_ID, communicationSection.children).some(
      (group) => group.id === 'email'
    );
  }, [resolved]);

  React.useEffect(() => {
    if (!foldStateHydratedRef.current || didInitializeOpenSubgroupRef.current) return;
    if (!hasVisibleEmailSubgroup) return;
    if ((storedFoldStateRef.current?.subgroupIds.length ?? 0) > 0) {
      didInitializeOpenSubgroupRef.current = true;
      return;
    }
    if (!openSectionIds.has(COMMUNICATION_SECTION_ID)) return;
    setOpenSubgroupIds((current) => {
      if (current.size > 0) {
        didInitializeOpenSubgroupRef.current = true;
        return current;
      }
      didInitializeOpenSubgroupRef.current = true;
      return new Set(['email']);
    });
  }, [hasVisibleEmailSubgroup, openSectionIds]);

  React.useEffect(() => {
    if (firstLoginCommunicationEmailOpenRequest <= 0 || !hasVisibleEmailSubgroup) return;
    setOpenSectionIds((current) => {
      if (current.has(COMMUNICATION_SECTION_ID)) return current;
      return new Set([...current, COMMUNICATION_SECTION_ID]);
    });
    setOpenSubgroupIds((current) => {
      if (current.has('email')) return current;
      return new Set([...current, 'email']);
    });
    acknowledgeFirstLoginCommunicationEmailOpen?.();
  }, [
    acknowledgeFirstLoginCommunicationEmailOpen,
    firstLoginCommunicationEmailOpenRequest,
    hasVisibleEmailSubgroup,
  ]);

  const toggleSection = React.useCallback(
    (sectionId: string) => {
      const section = resolved.find((entry) => entry.id === sectionId);
      const subgroupIds = section?.children
        ? sectionSubgroups(sectionId, section.children).map((group) => group.id)
        : [];

      setOpenSectionIds((current) => {
        const opening = !current.has(sectionId);
        const next = new Set(current);
        if (opening) next.add(sectionId);
        else next.delete(sectionId);

        if (subgroupIds.length > 0) {
          setOpenSubgroupIds((subgroups) => {
            const nextSubgroups = new Set(subgroups);
            if (opening) {
              for (const subgroupId of subgroupIds) nextSubgroups.add(subgroupId);
            } else {
              for (const subgroupId of subgroupIds) nextSubgroups.delete(subgroupId);
            }
            return nextSubgroups;
          });
        }

        return next;
      });
    },
    [resolved]
  );
  const toggleSubgroup = React.useCallback((subgroupId: string) => {
    setOpenSubgroupIds((current) => {
      const next = new Set(current);
      if (next.has(subgroupId)) next.delete(subgroupId);
      else next.add(subgroupId);
      return next;
    });
  }, []);

  if (!onboardingActive) {
    return (
      <div
        className={cn('flex min-h-0 flex-1 flex-col gap-3', className)}
        data-testid="coordinator-onboarding-inactive"
      >
        <div className="rounded-control bg-muted/40 px-2.5 py-2">
          <p className="text-body-sm text-muted-foreground">
            Onboarding is paused. You can return to the setup checklist anytime (here or by asking
            T-W1N to resume setup after confirming).
          </p>
        </div>
        <div className="mt-auto flex flex-shrink-0 justify-end pt-2">
          {setOnboardingActive ? (
            <button
              type="button"
              onClick={() => setOnboardingActive(true)}
              className={cn(
                'text-caption rounded-control flex-shrink-0 px-1.5 py-0.5 font-medium text-primary',
                'hover:bg-primary-tint-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              )}
              data-testid="coordinator-onboarding-return"
            >
              Return to onboarding
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!resolved.length) {
    return null;
  }

  // Offer pause only while there's still onboarding left to do.
  const canPauseAll = !!setOnboardingActive && nextActionableId !== null;
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3', className)}>
      <ScrollArea className="min-h-0 flex-1" viewportTestId="coordinator-onboarding-checklist">
        <ul>
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
            const renderRow = (item: ResolvedChecklistItem) => (
              <ChecklistRow
                key={item.id}
                item={item}
                isChild
                isInSkippedSection={section.sectionSkipped === true}
                onAction={handleChecklistRowAction}
                isActionWired={isActionWired}
                nextActionableId={nextActionableId}
                allVisibleItems={visibleLeaves}
                actionFeedback={actionFeedbackByStepId.get(item.id)}
                blockedFeedbackStepId={blockedFeedback?.stepId ?? null}
                blockedFeedbackToken={blockedFeedback?.token ?? 0}
                blockingStepHints={blockedFeedback?.blockingStepHints ?? EMPTY_BLOCKING_STEP_HINTS}
                onBlockedStepClick={triggerBlockedFeedback}
                isOnCall={isOnCall}
                onResetStepProgress={resetStepProgress}
                onSkipStep={onSkipStep}
                onUnskipStep={onUnskipStep}
                onSelectTaskChip={handleSelectTaskChip}
              />
            );
            // Steps claimed by a subgroup render under it; the rest render flat
            // above the subgroups (Communication has no flat rows; Workspace
            // shows its demos flat then the 2.1 Microsoft Teams subgroup).
            const subgroups = sectionSubgroups(section.id, sectionItems);
            const groupedIds = new Set<string>(
              subgroups.flatMap((group) => group.items.map((item) => item.id))
            );
            const flatItems = sectionItems.filter((item) => !groupedIds.has(item.id));
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
                    {ONBOARDING_SECTION_DOCS_URLS[section.id] ? (
                      <li>
                        <SectionDocsLink
                          sectionId={section.id}
                          href={ONBOARDING_SECTION_DOCS_URLS[section.id]}
                        />
                      </li>
                    ) : null}
                    {flatItems.map(renderRow)}
                    {subgroups.map((group, groupIndex) => (
                      <ChecklistSubgroup
                        key={group.id}
                        sectionId={section.id}
                        id={group.id}
                        title={`${index + 1}.${groupIndex + 1} ${group.title}`}
                        progress={progressForItems(group.items)}
                        isOpen={openSubgroupIds.has(group.id)}
                        onToggle={() => toggleSubgroup(group.id)}
                        items={group.items}
                        onSkipStep={onSkipStep}
                        onUnskipStep={onUnskipStep}
                        isPhaseSkipped={section.sectionSkipped === true}
                      >
                        {group.items.map(renderRow)}
                      </ChecklistSubgroup>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </ScrollArea>
      <div className="mt-auto flex flex-shrink-0 justify-end pt-2">
        {canPauseAll ? (
          <button
            type="button"
            onClick={() => setOnboardingActive?.(false)}
            className={cn(
              'text-caption rounded-control whitespace-nowrap px-1.5 py-0.5 text-muted-foreground',
              'hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
            data-testid="coordinator-onboarding-pause-all"
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

function SectionDocsLink({ sectionId, href }: { sectionId: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'text-caption inline-flex items-center gap-1 py-1 pl-5 text-muted-foreground underline-offset-2 transition-colors',
        'rounded-sm hover:text-foreground hover:underline',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
      )}
      data-testid={`coordinator-onboarding-section-${sectionId}-docs`}
    >
      Read docs
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

function SectionHeader({ section, index, progress, isOpen, onToggle }: SectionHeaderProps) {
  const label = `${index + 1}. ${section.title}`;
  const toggleProps = {
    type: 'button' as const,
    onClick: onToggle,
    'aria-expanded': isOpen,
  };

  return (
    <div
      className={cn(
        CHECKLIST_CONTROL_GRID_CLASS,
        'group/onboarding-section rounded-control items-center py-3'
      )}
      aria-expanded={isOpen}
      data-testid={`coordinator-onboarding-section-${section.id}`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <button
          {...toggleProps}
          className={cn(
            'text-body-sm min-w-0 truncate text-left font-medium text-foreground transition-colors',
            'rounded-sm bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            'group-hover/onboarding-section:text-muted-foreground'
          )}
          data-testid={`coordinator-onboarding-section-${section.id}-toggle`}
        >
          {label}
        </button>
      </div>
      <button
        {...toggleProps}
        className={cn(
          'flex w-16 flex-col gap-1 justify-self-center rounded-sm bg-transparent',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${section.title}`}
      >
        <CompactProgress completed={progress.completed} total={progress.total} />
      </button>
      <span aria-hidden="true" />
      <button
        {...toggleProps}
        className={cn(
          'flex h-6 w-6 items-center justify-center justify-self-center rounded-sm bg-transparent text-muted-foreground',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${section.title}`}
      >
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', !isOpen && '-rotate-90')}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

function ChecklistSubgroup({
  sectionId,
  id,
  title,
  progress,
  isOpen,
  onToggle,
  items,
  onSkipStep,
  onUnskipStep,
  isPhaseSkipped,
  children,
}: {
  sectionId: string;
  id: string;
  title: string;
  progress: { completed: number; total: number };
  isOpen: boolean;
  onToggle: () => void;
  items: ResolvedChecklistItem[];
  onSkipStep?: (stepId: string) => void;
  onUnskipStep?: (stepId: string) => void;
  isPhaseSkipped?: boolean;
  children: React.ReactNode;
}) {
  const pendingSkippableLeaves = items.filter((item) => item.status === 'pending' && item.canSkip);
  const skippedLeaves = items.filter((item) => item.status === 'skipped');
  const channelSkipped =
    items.length > 0 &&
    items.every((item) => item.status !== 'pending') &&
    skippedLeaves.length > 0;

  const canSkipChannel =
    !isPhaseSkipped && pendingSkippableLeaves.some((item) => !item.locked) && !!onSkipStep;
  const canUnskipChannel = !isPhaseSkipped && skippedLeaves.length > 0 && !!onUnskipStep;

  const handleSkipChannel = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onSkipStep || pendingSkippableLeaves.length === 0) return;
    // Prefer unlocked roots so cascade covers locked COMPLETED-descendants.
    // Fall back to any root if the channel only has locked pending rows.
    const pendingSkippableIds = new Set(pendingSkippableLeaves.map((l) => l.id));
    const roots = pendingSkippableLeaves.filter(
      (leaf) =>
        !(leaf.dependencies ?? []).some(
          (dep) => dep.resolution === 'completed' && pendingSkippableIds.has(dep.id)
        )
    );
    const unlockedRoots = roots.filter((leaf) => !leaf.locked);
    const toSkip =
      unlockedRoots.length > 0 ? unlockedRoots : roots.length > 0 ? roots : pendingSkippableLeaves;
    for (const leaf of toSkip) onSkipStep(leaf.id);
  };

  const handleUnskipChannel = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onUnskipStep || skippedLeaves.length === 0) return;
    const skippedIds = new Set(skippedLeaves.map((l) => l.id));
    const roots = skippedLeaves.filter(
      (leaf) =>
        !(leaf.dependencies ?? []).some(
          (dep) => dep.resolution === 'completed' && skippedIds.has(dep.id)
        )
    );
    const toUnskip = roots.length > 0 ? roots : skippedLeaves;
    for (const leaf of toUnskip) onUnskipStep(leaf.id);
  };

  return (
    <li
      data-testid={`coordinator-onboarding-${sectionId}-${id}`}
      className={cn(channelSkipped && 'opacity-60')}
    >
      <div
        className={cn(
          CHECKLIST_CONTROL_GRID_CLASS,
          'group/onboarding-subgroup rounded-control items-center py-3 pl-5'
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className={cn(
              'text-body-sm min-w-0 flex-1 truncate text-left font-medium text-foreground transition-colors',
              'bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              'group-hover/onboarding-subgroup:text-muted-foreground group-focus-visible/onboarding-subgroup:text-muted-foreground'
            )}
            data-testid={`coordinator-onboarding-${sectionId}-${id}-toggle`}
          >
            {title}
          </button>
          {channelSkipped && canUnskipChannel ? (
            <button
              type="button"
              onClick={handleUnskipChannel}
              aria-label={`Unskip ${title}`}
              className={cn(
                'text-caption rounded-control flex-shrink-0 whitespace-nowrap border border-border px-1.5 py-0.5 text-muted-foreground',
                'hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              )}
              data-testid={`coordinator-onboarding-unskip-channel-${id}`}
            >
              Skipped · Undo
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
          className="flex w-16 flex-col gap-1 justify-self-center rounded-sm bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <CompactProgress completed={progress.completed} total={progress.total} />
        </button>
        {canSkipChannel ? (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`Skip ${title}`}
                  onClick={handleSkipChannel}
                  className={cn(
                    'rounded-control text-muted-foreground hover:bg-muted hover:text-foreground',
                    'flex h-6 w-6 flex-shrink-0 items-center justify-center justify-self-center',
                    'opacity-0 focus-visible:opacity-100 group-hover/onboarding-subgroup:opacity-100',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                  )}
                  data-testid={`coordinator-onboarding-skip-channel-${id}`}
                >
                  <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-caption">Skip for now</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
          className="flex h-6 w-6 items-center justify-center justify-self-center text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', !isOpen && '-rotate-90')}
            aria-hidden="true"
          />
        </button>
      </div>
      {isOpen ? <ul>{children}</ul> : null}
    </li>
  );
}

interface ChecklistRowProps {
  item: ResolvedChecklistItem;
  isChild?: boolean;
  isInSkippedSection?: boolean;
  onAction: (item: ResolvedChecklistItem) => void;
  isActionWired: (action: ChecklistAction | undefined) => boolean;
  /** ID of the next leaf the user should tackle. Used for default
   * section selection and hidden state markers; threaded down rather
   * than recomputed per-row so the lookup stays O(checklist-size)
   * in total. */
  nextActionableId: string | null;
  allVisibleItems: readonly ResolvedChecklistItem[];
  actionFeedback?: string;
  blockedFeedbackStepId: string | null;
  blockedFeedbackToken: number;
  blockingStepHints: ReadonlyMap<string, BlockingFeedbackHint>;
  onBlockedStepClick: (stepId: string) => void;
  /** Whether the user is on a call — selects the call vs. chat
   * "Act now" suggestion chips. */
  isOnCall: boolean;
  onSkipStep?: (stepId: string) => void;
  onUnskipStep?: (stepId: string) => void;
  onResetStepProgress?: (stepIds: readonly string[], resetStepId?: string) => void;
  /** Dispatch a graph-owned chip event. Unset leaves chips read-only. */
  onSelectTaskChip?: (stepId: string, chipId: string) => void;
}

function ChecklistRow({
  item,
  isChild = false,
  isInSkippedSection = false,
  onAction,
  isActionWired,
  nextActionableId,
  allVisibleItems,
  actionFeedback,
  blockedFeedbackStepId,
  blockedFeedbackToken,
  blockingStepHints,
  onBlockedStepClick,
  isOnCall,
  onSkipStep,
  onUnskipStep,
  onResetStepProgress,
  onSelectTaskChip,
}: ChecklistRowProps) {
  const hasWiredAction = isActionWired(item.action);
  const isResolved = item.status !== 'pending';
  const isNext = nextActionableId === item.id;
  const sectionDisabled = isInSkippedSection || item.sectionSkipped === true;
  const isActionable =
    hasWiredAction && !!item.action && !item.locked && !isResolved && !sectionDisabled;
  const canShowBlockedFeedback =
    item.locked && !item.children?.length && item.status === 'pending' && !sectionDisabled;
  const shouldJiggle = blockedFeedbackStepId === item.id;
  const blockingHint = blockingStepHints.get(item.id);
  const showActionFeedback =
    item.inProgress ||
    (!!actionFeedback && item.status === 'pending' && !item.locked && !sectionDisabled);
  const onboardingCtx = useCoordinatorOnboardingContext();
  const actionFeedbackLabel =
    item.id === 'apps' && item.inProgress && onboardingCtx?.appsConnectSettling
      ? 'Finishing connection...'
      : item.inProgress
        ? 'In progress'
        : actionFeedback;
  // Shared org-wide connect steps are excluded from every reset path (see
  // NON_RESETTABLE_STEP_IDS): a per-user reset must not disturb a connection the
  // whole org depends on.
  const resetStepIds = React.useMemo(
    () =>
      collectVisibleLeafIds(item).filter(
        (id) => !NON_RESETTABLE_STEP_IDS.has(id) && !STICKY_CONTACT_DETAIL_STEP_IDS.has(id)
      ),
    [item]
  );
  const canResetSection =
    !isChild &&
    !!item.children?.length &&
    !!onResetStepProgress &&
    !item.sectionSkipped &&
    hasResolvedLeaf(item) &&
    resetStepIds.length > 0;
  const rowResetStepIds = React.useMemo(
    () =>
      collectDependentStepIds(item.id, allVisibleItems).filter(
        (id) => !NON_RESETTABLE_STEP_IDS.has(id)
      ),
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
  const canReset =
    item.status === 'done' && !!onResetStepProgress && !NON_RESETTABLE_STEP_IDS.has(item.id);
  const canSkipRow =
    !!onSkipStep &&
    item.canSkip === true &&
    item.status === 'pending' &&
    !sectionDisabled &&
    !item.children?.length;
  const canUnskipRow =
    !!onUnskipStep && item.status === 'skipped' && !sectionDisabled && !item.children?.length;
  const hasRowMenu = canReset || canSkipRow || canUnskipRow;

  const [rowMenuOpen, setRowMenuOpen] = React.useState(false);
  // The row menu is a React child of the actionable row, but Radix portals it
  // in the DOM. React still bubbles portal events through the component tree,
  // so Skip/Unskip/Reset clicks would reach the row onClick (e.g. open Slack)
  // unless propagation is stopped. Also suppress a brief post-close window for
  // any native leftover pointer event after the menu unmounts.
  const suppressRowActivationRef = React.useRef(false);
  const suppressRowActivationTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (suppressRowActivationTimeoutRef.current !== null) {
        window.clearTimeout(suppressRowActivationTimeoutRef.current);
      }
    };
  }, []);

  const handleRowMenuOpenChange = (open: boolean) => {
    setRowMenuOpen(open);
    if (open) {
      if (suppressRowActivationTimeoutRef.current !== null) {
        window.clearTimeout(suppressRowActivationTimeoutRef.current);
        suppressRowActivationTimeoutRef.current = null;
      }
      suppressRowActivationRef.current = false;
      return;
    }
    suppressRowActivationRef.current = true;
    if (suppressRowActivationTimeoutRef.current !== null) {
      window.clearTimeout(suppressRowActivationTimeoutRef.current);
    }
    suppressRowActivationTimeoutRef.current = window.setTimeout(() => {
      suppressRowActivationRef.current = false;
      suppressRowActivationTimeoutRef.current = null;
    }, 100);
  };

  const shouldSuppressRowActivation = () => rowMenuOpen || suppressRowActivationRef.current;

  const renderMarkerAndLabel = (variant: 'done' | 'skipped' | 'actionable' | 'static') => (
    <span className={cn('flex min-w-0 flex-1 items-start', isChild && 'pl-6', dimClassName)}>
      <span className="inline-flex min-w-0 items-start gap-2">
        <ChecklistMarker status={item.status} locked={item.comingSoon === true} />
        {renderLabel(variant)}
      </span>
    </span>
  );

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
              {item.id === 'discord' ? (
                <>
                  {' '}
                  T-W1N uses a shared Discord bot, so this only resets your setup here — to fully
                  disconnect, remove the bot from your own Discord server in Server Settings →
                  Integrations.
                </>
              ) : null}
              {item.id === 'slack' ? (
                <>
                  {' '}
                  Your Slack workspace connection is shared across the org and stays connected —
                  only your setup steps here reset. To fully disconnect, use Disconnect in the Slack
                  settings.
                </>
              ) : null}
              {item.id === 'ms_teams' ? (
                <>
                  {' '}
                  Your Microsoft Teams connection is shared across the org and stays connected —
                  only your setup steps here reset. To fully remove T-W1N, a Teams admin must
                  uninstall the app from the Teams admin center.
                </>
              ) : null}
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
        {showActionFeedback ? (
          <span
            className="text-caption whitespace-nowrap font-medium text-primary"
            aria-live="polite"
            data-testid={`coordinator-onboarding-action-feedback-${item.id}`}
          >
            {actionFeedbackLabel}
          </span>
        ) : blockingHint ? (
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
      {hasRowMenu ? (
        <DropdownMenu open={rowMenuOpen} onOpenChange={handleRowMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More actions"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              className={cn(
                'rounded-control text-muted-foreground hover:bg-muted hover:text-foreground',
                'flex h-6 w-6 flex-shrink-0 items-center justify-center justify-self-center',
                'opacity-0 focus-visible:opacity-100 group-hover/onboarding-row:opacity-100',
                rowMenuOpen && 'opacity-100',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              )}
              data-testid={`coordinator-onboarding-row-menu-${item.id}`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="end"
            className="min-w-[6rem]"
            onCloseAutoFocus={(event) => event.preventDefault()}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {canUnskipRow ? (
              <DropdownMenuItem
                data-testid={`coordinator-onboarding-unskip-${item.id}`}
                onSelect={() => onUnskipStep?.(item.id)}
              >
                Unskip
              </DropdownMenuItem>
            ) : null}
            {canSkipRow ? (
              <DropdownMenuItem
                data-testid={`coordinator-onboarding-skip-${item.id}`}
                onSelect={() => onSkipStep?.(item.id)}
              >
                Skip
              </DropdownMenuItem>
            ) : null}
            {canReset ? (
              <DropdownMenuItem
                data-testid={`coordinator-onboarding-reset-${item.id}`}
                onSelect={() => onResetStepProgress?.(rowResetStepIds, item.id)}
              >
                Reset
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span aria-hidden="true" className="flex h-6 items-center justify-center" />
      )}
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
        onClick={() => {
          if (shouldSuppressRowActivation()) return;
          onAction(item);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (shouldSuppressRowActivation()) return;
            onAction(item);
          }
        }}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        data-testid={`coordinator-onboarding-item-${item.id}`}
        data-status={item.inProgress ? 'in_progress' : undefined}
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
        onClick={
          canShowBlockedFeedback
            ? () => {
                if (shouldSuppressRowActivation()) return;
                onBlockedStepClick(item.id);
              }
            : undefined
        }
        onKeyDown={
          canShowBlockedFeedback
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (shouldSuppressRowActivation()) return;
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

  // Suggestion chips under the ``act`` / Tasks-beat rows — each row shows the
  // set that matches what completes it (point-in-time prompts for ``act``,
  // scheduled/event prompts for the Tasks beats). Rendered only while the row
  // is still pending; hidden rows never reach this component.
  //
  // Tasks beats and Integrations onboarding rows wire an ``onSelectTaskChip``
  // handler: clicking a chip dispatches a system event that asks Twin to act on
  // that specific server-owned example. ``act`` and every other step pass no
  // handler, so their chips stay read-only inspiration.
  //
  // Suggestion chips come from the server render (sourced from the canonical
  // graph). The chat/call split lives in the data: ``act`` carries distinct
  // sets, the Tasks beats carry their own, and every other step carries none —
  // so an empty list naturally means "no chips here".
  const suggestionsForItem = isOnCall ? item.chipsCall : item.chipsChat;
  const showSuggestions =
    !!suggestionsForItem?.length && item.status === 'pending' && !item.locked && !sectionDisabled;
  const chipsClickable =
    item.id === 'create-scheduled-task' ||
    item.id === 'create-triggerable-task' ||
    item.id === 'apps' ||
    item.id === 'integration-read' ||
    item.id === 'integration-action'
      ? !!onSelectTaskChip
      : false;

  return (
    <li className="flex flex-col gap-2">
      {row}
      {showSuggestions && suggestionsForItem ? (
        <ul
          className={cn('ml-6 flex flex-wrap gap-1.5', dimClassName)}
          aria-label={chipsClickable ? 'Example tasks to set up' : 'Suggested workflows to try'}
          data-testid="coordinator-onboarding-suggestions"
        >
          {suggestionsForItem.map((workflow) => (
            <li key={workflow.id}>
              {chipsClickable ? (
                <button
                  type="button"
                  onClick={() => onSelectTaskChip?.(item.id, workflow.id)}
                  className={cn(
                    'inline-flex items-center rounded-full text-left',
                    'bg-muted/40 px-2 py-0.5 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    'text-caption text-muted-foreground transition-colors hover:text-foreground'
                  )}
                  data-testid={`coordinator-onboarding-suggestion-${workflow.id}`}
                >
                  {workflow.label}
                </button>
              ) : (
                <span
                  className={cn(
                    'inline-flex select-none items-center rounded-full',
                    'bg-muted/40 px-2 py-0.5',
                    'text-caption text-muted-foreground'
                  )}
                  data-testid={`coordinator-onboarding-suggestion-${workflow.id}`}
                >
                  {workflow.label}
                </span>
              )}
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
              onSkipStep={onSkipStep}
              onUnskipStep={onUnskipStep}
              onResetStepProgress={onResetStepProgress}
              onSelectTaskChip={onSelectTaskChip}
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
