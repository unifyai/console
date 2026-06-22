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
 * each step id to its surface-specific action handler and to UI-only
 * copy (description, time estimate, suggestion chips).
 */

import * as React from 'react';
import { Check, ChevronDown, RotateCcw } from 'lucide-react';
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
import type {
  OnboardingChip,
  OnboardingRender,
  OnboardingStepDependency,
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
  /** Whether the row can be deferred with the inline Later affordance. */
  canSkip?: boolean;
}

/**
 * Maps each server step id to the surface-specific action this Console
 * dispatches when the row is clicked. This is the *only* per-step copy
 * Console owns — pure client behaviour (which handler to fire) that has no
 * place in the backend graph. Everything else (titles, descriptions, time
 * estimates, suggestion chips, phase headers) is sourced from the server's
 * onboarding render, which reads it from Orchestra's canonical graph.
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

interface ResolvedChecklistItem extends OnboardingChecklistItem {
  done: boolean;
  skipped: boolean;
  locked: boolean;
  status: 'pending' | 'done' | 'skipped';
  sectionSkipped?: boolean;
  children?: ResolvedChecklistItem[];
}

/**
 * Build the rendered checklist tree from the server's onboarding
 * rendering. The server is authoritative for each step's status; we
 * only attach UI copy + the action handler and group by phase.
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
  isActionWired: (action: ChecklistAction | undefined) => boolean
): ResolvedChecklistItem[] {
  if (!render) return [];

  const leavesByPhase = new Map<string, ResolvedChecklistItem[]>();
  const skippedPhases = new Set(render.skippedPhaseIds);
  for (const step of render.steps) {
    const phaseSkipped = skippedPhases.has(step.phase);
    const locked = step.status === 'locked';
    let status: 'pending' | 'done' | 'skipped';
    if (step.status === 'done') status = 'done';
    else if (step.status === 'skipped') status = 'skipped';
    else if (step.status === 'available') status = 'pending';
    else status = 'pending';

    const action = STEP_ACTIONS[step.id];
    // An available row with an action that isn't wired on this surface
    // can never be actioned here — hide it rather than show a dead row.
    if (status === 'pending' && !locked && action && !isActionWired(action) && !phaseSkipped) {
      continue;
    }

    const leaf: ResolvedChecklistItem = {
      id: step.id,
      title: step.title,
      phase: step.phase,
      description: step.description || undefined,
      estimatedTime: step.estimatedTime || undefined,
      chipsChat: step.chipsChat,
      chipsCall: step.chipsCall,
      dependencies: step.dependencies,
      action,
      canSkip: step.canSkip,
      done: status === 'done',
      skipped: status === 'skipped',
      locked,
      status,
    };
    const list = leavesByPhase.get(step.phase) ?? [];
    list.push(leaf);
    leavesByPhase.set(step.phase, list);
  }

  const result: ResolvedChecklistItem[] = [];
  for (const phase of render.phases) {
    const children = leavesByPhase.get(phase.phase);
    if (!children?.length) continue;
    const sectionSkipped = skippedPhases.has(phase.phase);
    const childrenAllDone = children.every((child) => child.status === 'done');
    const childrenAllResolved = children.every((child) => child.status !== 'pending');
    const childrenHaveSkipped = children.some((child) => child.status === 'skipped');
    const done = childrenAllDone;
    const skipped = sectionSkipped || (!done && childrenAllResolved && childrenHaveSkipped);
    result.push({
      id: phase.id,
      title: phase.title,
      phase: phase.phase,
      phaseLabel: phase.phase,
      description: phase.description,
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

interface PhaseProgress {
  id: string;
  title: string;
  total: number;
  completed: number;
}

const CHECKLIST_CONTROL_GRID_CLASS =
  '-mx-1.5 grid w-full grid-cols-[minmax(0,1fr)_4.5rem_1.5rem] gap-1 px-1.5';

/**
 * Per-phase progress for the segmented bar, computed from the full
 * server step list (not just the visible rows) so the denominator
 * stays stable as locked steps unlock. A step counts toward the total
 * unless its action is unwired on this surface; it counts toward
 * ``completed`` only when its status is ``done``.
 */
function computePhases(
  render: OnboardingRender | null,
  isActionWired: (action: ChecklistAction | undefined) => boolean
): PhaseProgress[] {
  if (!render) return [];
  return render.phases.flatMap((phase) => {
    let total = 0;
    let completed = 0;
    for (const step of render.steps) {
      if (step.phase !== phase.phase) continue;
      const action = STEP_ACTIONS[step.id];
      if (action && !isActionWired(action)) continue;
      total += 1;
      if (step.status === 'done') completed += 1;
    }
    return total > 0 ? [{ id: phase.id, title: phase.title, total, completed }] : [];
  });
}

function collectVisibleLeafIds(item: ResolvedChecklistItem): string[] {
  if (!item.children?.length) return [item.id];
  return item.children.flatMap(collectVisibleLeafIds);
}

function hasResolvedLeaf(item: ResolvedChecklistItem): boolean {
  if (!item.children?.length) return item.status !== 'pending';
  return item.children.some(hasResolvedLeaf);
}

function hasActionableLeaf(
  item: ResolvedChecklistItem,
  isActionWired: (action: ChecklistAction | undefined) => boolean,
  isInSkippedSection = false
): boolean {
  const sectionDisabled = isInSkippedSection || item.sectionSkipped === true;
  if (!item.children?.length) {
    return (
      item.status === 'pending' && !item.locked && !sectionDisabled && isActionWired(item.action)
    );
  }
  return item.children.some((child) => hasActionableLeaf(child, isActionWired, sectionDisabled));
}

function containsLeafId(item: ResolvedChecklistItem, leafId: string): boolean {
  if (!item.children?.length) return item.id === leafId;
  return item.children.some((child) => containsLeafId(child, leafId));
}

function findDefaultSectionId(
  items: ResolvedChecklistItem[],
  nextActionableId: string | null
): string | null {
  if (nextActionableId) {
    const nextSection = items.find((item) => containsLeafId(item, nextActionableId));
    if (nextSection) return nextSection.id;
  }
  const pendingSection = items.find((item) => item.status === 'pending');
  return pendingSection?.id ?? items[0]?.id ?? null;
}

/**
 * Identify the recommended next leaf so the UI can call it out with a
 * "Next" affordance. Walks the resolved tree in render order and
 * returns the first pending leaf with a wired action. Other pending
 * leaves remain actionable; this just provides an ordered suggestion.
 */
function findNextActionableId(
  items: ResolvedChecklistItem[],
  isActionWired: (action: ChecklistAction | undefined) => boolean,
  canMarkLater: boolean
): string | null {
  for (const item of items) {
    if (item.sectionSkipped) continue;
    if (item.children?.length) {
      const inner = findNextActionableId(item.children, isActionWired, canMarkLater);
      if (inner) return inner;
      continue;
    }
    if (!item.locked && item.status === 'pending' && (isActionWired(item.action) || canMarkLater)) {
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
  onSkipStep?: (stepId: string) => void;
  onUnskipStep?: (stepId: string) => void;
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
  onSkipStep,
  onUnskipStep,
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
  const [areProgressDetailsOpen, setAreProgressDetailsOpen] = React.useState(false);
  const [selectedSectionId, setSelectedSectionId] = React.useState<string | null>(null);

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
    () => buildVisibleChecklist(onboarding, isActionWired),
    [onboarding, isActionWired]
  );
  const phases = React.useMemo(
    () => computePhases(onboarding, isActionWired),
    [onboarding, isActionWired]
  );

  // ID of the leaf row the user should tackle next. The value still
  // drives default section selection and internal state, but the
  // checklist does not render an inline "Next" marker.
  const nextActionableId = React.useMemo(
    () => findNextActionableId(resolved, isActionWired, !!onSkipStep),
    [resolved, isActionWired, onSkipStep]
  );
  const defaultSelectedSectionId = React.useMemo(
    () => findDefaultSectionId(resolved, nextActionableId),
    [resolved, nextActionableId]
  );
  const effectiveSelectedSectionId = React.useMemo(() => {
    if (selectedSectionId && resolved.some((item) => item.id === selectedSectionId)) {
      return selectedSectionId;
    }
    return defaultSelectedSectionId;
  }, [defaultSelectedSectionId, resolved, selectedSectionId]);
  const visibleSections = React.useMemo(() => {
    if (!effectiveSelectedSectionId) return resolved;
    return resolved.filter((item) => item.id === effectiveSelectedSectionId);
  }, [effectiveSelectedSectionId, resolved]);
  const selectedSection = React.useMemo(
    () => resolved.find((item) => item.id === effectiveSelectedSectionId) ?? null,
    [effectiveSelectedSectionId, resolved]
  );
  const visibleItems = selectedSection?.children?.length
    ? selectedSection.children
    : visibleSections;
  const canSelectNextSection = phases.length > 1;
  const selectNextSection = React.useCallback(() => {
    if (!phases.length) return;
    const currentIndex = Math.max(
      0,
      phases.findIndex((phase) => phase.id === effectiveSelectedSectionId)
    );
    const nextIndex = (currentIndex + 1) % phases.length;
    setSelectedSectionId(phases[nextIndex].id);
    setAreProgressDetailsOpen(false);
  }, [effectiveSelectedSectionId, phases]);

  React.useEffect(() => {
    if (selectedSectionId && !resolved.some((item) => item.id === selectedSectionId)) {
      setSelectedSectionId(null);
    }
  }, [resolved, selectedSectionId]);

  // Global "do onboarding later" collapses the whole checklist to a
  // single resume affordance. The underlying per-step state is
  // untouched, so resuming brings the user back exactly where they were.
  if (onboardingDeferred) {
    return (
      <div
        className={cn('flex flex-col gap-2', className)}
        data-testid="coordinator-onboarding-deferred"
      >
        <div className="rounded-control bg-muted/40 flex items-center justify-between gap-2 px-2.5 py-2">
          <span className="text-body-sm text-muted-foreground">
            Onboarding paused — you can pick it up anytime.
          </span>
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
  const canSkipSelectedSection =
    !!selectedSection &&
    !!selectedSection.phase &&
    !!onSkipSection &&
    selectedSection.status === 'pending' &&
    !selectedSection.sectionSkipped;
  const canUnskipSelectedSection =
    !!selectedSection &&
    !!selectedSection.phase &&
    !!onUnskipSection &&
    selectedSection.sectionSkipped === true;
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3', className)}>
      <SectionProgressDisclosure
        phases={phases}
        selectedPhaseId={effectiveSelectedSectionId}
        isOpen={areProgressDetailsOpen}
        onToggle={() => setAreProgressDetailsOpen((open) => !open)}
        onSelectPhase={(phaseId) => {
          setSelectedSectionId(phaseId);
          setAreProgressDetailsOpen(false);
        }}
        sectionAction={
          canUnskipSelectedSection
            ? {
                label: 'Do now',
                testId: `coordinator-onboarding-unskip-section-${selectedSection.id}`,
                variant: 'primary',
                onClick: () => onUnskipSection?.(selectedSection.phase!),
              }
            : canSkipSelectedSection
              ? {
                  label: 'Later',
                  testId: `coordinator-onboarding-skip-section-${selectedSection.id}`,
                  variant: 'muted',
                  onClick: () => onSkipSection?.(selectedSection.phase!),
                }
              : null
        }
      />
      <ul
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto"
        data-testid="coordinator-onboarding-checklist"
      >
        {visibleItems.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            isChild={!!selectedSection?.children?.length}
            isInSkippedSection={selectedSection?.sectionSkipped === true}
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
      <div className="mt-auto flex flex-shrink-0 items-center justify-between gap-3 pt-2">
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
            Skip onboarding for now
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        {canSelectNextSection ? (
          <button
            type="button"
            onClick={selectNextSection}
            className={cn(
              'text-caption rounded-control flex-shrink-0 whitespace-nowrap px-1.5 py-0.5 font-medium text-primary',
              'hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
            data-testid="coordinator-onboarding-next-section"
          >
            Next section
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface SectionProgressDisclosureProps {
  phases: PhaseProgress[];
  selectedPhaseId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectPhase: (phaseId: string) => void;
  sectionAction: {
    label: string;
    testId: string;
    variant: 'muted' | 'primary';
    onClick: () => void;
  } | null;
}

/**
 * Compact section summary with foldable per-section detail. The
 * default state avoids suggesting progress in future phases that the
 * current checklist path has not reached yet.
 */
function SectionProgressDisclosure({
  phases,
  selectedPhaseId,
  isOpen,
  onToggle,
  onSelectPhase,
  sectionAction,
}: SectionProgressDisclosureProps) {
  const detailsId = React.useId();
  if (!phases.length) return null;
  const selectedPhase = phases.find((phase) => phase.id === selectedPhaseId) ?? phases[0];
  const selectedPhaseIndex = phases.findIndex((phase) => phase.id === selectedPhase?.id);
  const selectedPhaseLabel = selectedPhase
    ? `${selectedPhaseIndex >= 0 ? selectedPhaseIndex + 1 : 1}. ${selectedPhase.title}`
    : 'Choose section';
  return (
    <div className="relative flex flex-col" data-testid="coordinator-onboarding-progress">
      <div
        className={cn(
          CHECKLIST_CONTROL_GRID_CLASS,
          'rounded-control items-center py-2 text-left',
          'bg-muted/40 hover:bg-muted/70 transition-colors',
          'focus-within:ring-2 focus-within:ring-primary'
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={detailsId}
          className="text-body-sm min-w-0 flex-1 truncate text-left font-medium text-foreground focus:outline-none"
          data-testid="coordinator-onboarding-progress-summary"
        >
          {selectedPhaseLabel}
        </button>
        {sectionAction ? (
          <button
            type="button"
            onClick={sectionAction.onClick}
            className={cn(
              'text-caption rounded-control justify-self-center whitespace-nowrap px-1.5 py-0.5',
              sectionAction.variant === 'primary'
                ? 'hover:bg-primary/10 font-medium text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
            data-testid={sectionAction.testId}
          >
            {sectionAction.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-label="Choose onboarding section"
          aria-expanded={isOpen}
          aria-controls={detailsId}
          className="rounded-control flex h-6 w-6 items-center justify-center justify-self-center text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </div>
      {isOpen ? (
        <ul
          id={detailsId}
          aria-label="Choose onboarding section"
          className={cn(
            'rounded-control absolute left-0 right-0 top-full z-30 mt-2 flex flex-col gap-1.5',
            'border border-border bg-background p-1.5 shadow-lg'
          )}
          data-testid="coordinator-onboarding-progress-details"
        >
          {phases.map((phase, index) => {
            const phasePercent =
              phase.total > 0 ? Math.round((phase.completed / phase.total) * 100) : 0;
            const isSelected = phase.id === selectedPhase?.id;
            const phaseLabel = `${index + 1}. ${phase.title}`;
            return (
              <li
                key={phase.id}
                data-testid={`coordinator-onboarding-progress-phase-${phase.id}`}
                data-phase-completed={phase.completed}
                data-phase-total={phase.total}
                className="flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => onSelectPhase(phase.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    'rounded-control flex flex-col gap-1 px-2.5 py-2 text-left transition-colors',
                    'hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isSelected && 'bg-primary/10'
                  )}
                  data-testid={`coordinator-onboarding-progress-phase-${phase.id}-select`}
                >
                  <div className="text-caption flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'truncate',
                        isSelected ? 'font-medium text-primary' : 'text-foreground'
                      )}
                    >
                      {phaseLabel}
                    </span>
                    <span className="flex-shrink-0 text-muted-foreground">
                      {phase.completed} of {phase.total}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${phase.title}: ${phase.completed} of ${phase.total} items completed`}
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
                </button>
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
  isInSkippedSection?: boolean;
  onAction: (action: ChecklistAction) => void;
  isActionWired: (action: ChecklistAction | undefined) => boolean;
  /** ID of the next leaf the user should tackle. Used for default
   * section selection and hidden state markers; threaded down rather
   * than recomputed per-row so the lookup stays O(checklist-size)
   * in total. */
  nextActionableId: string | null;
  /** Whether the user is on a call — selects the call vs. chat
   * "Act now" suggestion chips. */
  isOnCall: boolean;
  onSkipStep?: (stepId: string) => void;
  onUnskipStep?: (stepId: string) => void;
  onSkipSection?: (phaseId: string) => void;
  onUnskipSection?: (phaseId: string) => void;
  onResetStepProgress?: (stepIds: readonly string[]) => void;
}

function ChecklistRow({
  item,
  isChild = false,
  isInSkippedSection = false,
  onAction,
  isActionWired,
  nextActionableId,
  isOnCall,
  onSkipStep,
  onUnskipStep,
  onSkipSection,
  onUnskipSection,
  onResetStepProgress,
}: ChecklistRowProps) {
  const hasWiredAction = isActionWired(item.action);
  const isResolved = item.status !== 'pending';
  const isNext = nextActionableId === item.id;
  const sectionDisabled = isInSkippedSection || item.sectionSkipped === true;
  const isActionable = hasWiredAction && !item.locked && !isResolved && !sectionDisabled;
  const canSkip =
    !!onSkipStep &&
    item.canSkip !== false &&
    !item.locked &&
    !item.children?.length &&
    !isResolved &&
    !sectionDisabled;
  const canUnskip =
    !!onUnskipStep && !sectionDisabled && !item.children?.length && item.status === 'skipped';
  const canSkipSection =
    !isChild &&
    !!item.children?.length &&
    !!item.phase &&
    !!onSkipSection &&
    item.status === 'pending' &&
    !item.sectionSkipped;
  const canUnskipSection =
    !isChild && !!item.phase && !!onUnskipSection && item.sectionSkipped === true;
  const canResetSection =
    !isChild &&
    !!item.children?.length &&
    !!onResetStepProgress &&
    !item.sectionSkipped &&
    hasResolvedLeaf(item);
  const resetStepIds = React.useMemo(() => collectVisibleLeafIds(item), [item]);
  // Whether the next actionable leaf sits somewhere inside this
  // row's subtree. Parents on that path stay at full opacity so the
  // section containing the recommended row does not look disabled.
  const containsNext =
    !!nextActionableId &&
    !!item.children?.some(function walk(child: ResolvedChecklistItem): boolean {
      if (child.id === nextActionableId) return true;
      return !!child.children?.some(walk);
    });
  const containsActionableLeaf = !!item.children?.some((child) =>
    hasActionableLeaf(child, isActionWired, sectionDisabled)
  );
  // Soft-dim every resolved/static row that is neither actionable nor
  // on the path to the recommended row. Alternative available rows stay
  // legible because independent sections can be started in any order.
  const dim =
    item.locked ||
    sectionDisabled ||
    (!isNext &&
      !containsNext &&
      !containsActionableLeaf &&
      item.status !== 'skipped' &&
      !isActionable);
  const unresolvedDependencies =
    item.dependencies?.filter((dependency) => !dependency.satisfied) ?? [];
  const hasDependencyInfo = item.locked && unresolvedDependencies.length > 0;
  const hasInfo = !!item.description || !!item.estimatedTime || hasDependencyInfo;

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

  const handleSkipSectionClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (item.phase) onSkipSection?.(item.phase);
    },
    [item.phase, onSkipSection]
  );

  const handleUnskipSectionClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (item.phase) onUnskipSection?.(item.phase);
    },
    [item.phase, onUnskipSection]
  );

  const rowClassName = (variant: 'done' | 'skipped' | 'actionable' | 'static') =>
    cn(
      CHECKLIST_CONTROL_GRID_CLASS,
      'items-start rounded-md py-1',
      variant === 'actionable' && 'cursor-pointer hover:bg-muted/50'
    );

  const renderLabel = (variant: 'done' | 'skipped' | 'actionable' | 'static') => (
    <span
      className={cn(
        'text-body-sm flex-1 leading-5',
        variant === 'done' && 'text-muted-foreground line-through',
        variant === 'skipped' && 'text-muted-foreground',
        variant === 'actionable' && 'text-foreground',
        variant === 'static' && 'text-foreground'
      )}
    >
      {item.title}
    </span>
  );

  const renderDependencyInfo = () =>
    hasDependencyInfo ? (
      <div className="text-caption leading-snug text-muted-foreground">
        <p className="font-medium text-foreground">Depends on:</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {unresolvedDependencies.map((dependency) => (
            <li key={dependency.id}>
              {dependency.resolution === 'completed' ? 'Complete' : 'Complete or skip'} "
              {dependency.title}" first.
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const dimClassName = dim ? 'opacity-50 transition-opacity' : undefined;

  const renderMarkerAndLabel = (variant: 'done' | 'skipped' | 'actionable' | 'static') => {
    const markerAndLabel = (
      <span
        className={cn(
          'flex min-w-0 flex-1 items-start gap-2',
          isChild && 'pl-6',
          dimClassName,
          hasDependencyInfo &&
            'rounded-control cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
        tabIndex={hasDependencyInfo ? 0 : undefined}
        data-testid={hasDependencyInfo ? `coordinator-onboarding-lock-hover-${item.id}` : undefined}
      >
        <ChecklistMarker status={item.status} />
        {renderLabel(variant)}
      </span>
    );

    if (!hasDependencyInfo) return markerAndLabel;
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{markerAndLabel}</TooltipTrigger>
          <TooltipContent side="left" className="max-w-[240px]">
            {renderDependencyInfo()}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderSkipButton = () =>
    canSkip ? (
      <button
        type="button"
        onClick={handleSkipClick}
        className={cn(
          'text-caption rounded-control flex h-6 flex-shrink-0 items-center px-1.5 text-muted-foreground',
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
          'text-caption rounded-control flex h-6 flex-shrink-0 items-center px-1.5 font-medium text-primary',
          'hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
        data-testid={`coordinator-onboarding-unskip-step-${item.id}`}
      >
        Do now
      </button>
    ) : null;

  const renderSectionSkipButton = () =>
    canSkipSection ? (
      <button
        type="button"
        onClick={handleSkipSectionClick}
        className={cn(
          'text-caption rounded-control flex h-6 flex-shrink-0 items-center px-1.5 text-muted-foreground',
          'hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
        data-testid={`coordinator-onboarding-skip-section-${item.id}`}
      >
        Later
      </button>
    ) : null;

  const renderSectionUnskipButton = () =>
    canUnskipSection ? (
      <button
        type="button"
        onClick={handleUnskipSectionClick}
        className={cn(
          'text-caption rounded-control flex h-6 flex-shrink-0 items-center px-1.5 font-medium text-primary',
          'hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
        data-testid={`coordinator-onboarding-unskip-section-${item.id}`}
      >
        Do now
      </button>
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
              aria-label={
                item.locked ? `Why is "${item.title}" locked?` : `What is "${item.title}"?`
              }
              className="border-muted-foreground/60 text-muted-foreground/60"
              data-testid={`coordinator-onboarding-info-${item.id}`}
            />
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[220px]">
            <div className="flex flex-col gap-1.5">
              {item.description || item.estimatedTime ? (
                <p className="text-caption leading-snug">
                  {item.description}
                  {item.description && item.estimatedTime ? (
                    <span className="text-muted-foreground"> · {item.estimatedTime}</span>
                  ) : item.estimatedTime ? (
                    <span className="text-muted-foreground">{item.estimatedTime}</span>
                  ) : null}
                </p>
              ) : null}
              {hasDependencyInfo ? renderDependencyInfo() : null}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : null;

  const rowBody = (variant: 'done' | 'skipped' | 'actionable' | 'static') => (
    <div className={rowClassName(variant)}>
      {renderMarkerAndLabel(variant)}
      <span className="flex h-6 items-center justify-center gap-1">
        <span className={cn('flex h-6 items-center justify-center gap-1', dimClassName)}>
          {renderResetSectionButton()}
          {renderSkipButton()}
          {renderSectionSkipButton()}
        </span>
        {renderUnskipButton()}
        {renderSectionUnskipButton()}
      </span>
      <span className={cn('flex h-6 items-center justify-center', dimClassName)}>
        {renderInfoTooltip()}
      </span>
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
        data-status={item.locked ? 'locked' : undefined}
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
              isOnCall={isOnCall}
              onSkipStep={onSkipStep}
              onUnskipStep={onUnskipStep}
              onSkipSection={onSkipSection}
              onUnskipSection={onUnskipSection}
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
