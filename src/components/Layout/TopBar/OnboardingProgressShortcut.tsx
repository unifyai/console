'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { fetchAssistants } from '@/lib/client/assistant';
import { resolveCanonicalWorkspaceCoordinator } from '@/lib/assistants/coordinatorIdentity';
import { type OnboardingRender } from '@/lib/assistants/coordinatorState';
import { useCoordinatorOnboarding } from '@/hooks/Assistants/useCoordinatorOnboarding';
import { cn } from '@/lib/utils';
import { isAssistantInfoPanelShortcutPath } from '@/lib/navigation/appShellRoutes';
import {
  ASSISTANT_INFO_PANEL_VISIBILITY_EVENT,
  readAssistantInfoPanelVisibility,
  requestAssistantInfoPanelToggle,
  requestCoordinatorOnboardingPanel,
  type AssistantInfoPanelVisibilityDetail,
} from '@/lib/assistants/infoPanelVisibility';

const COORDINATOR_COMMUNICATION_SECTION_ID = 'communication';

export function coordinatorOnboardingProgress(render: OnboardingRender | null): {
  completed: number;
  total: number;
  pct: number;
} {
  if (!render) return { completed: 0, total: 0, pct: 0 };
  const communicationPhase = render.phases.find(
    (phase) => phase.id === COORDINATOR_COMMUNICATION_SECTION_ID
  );
  const communicationSteps = communicationPhase
    ? render.steps.filter((step) => step.phase === communicationPhase.phase)
    : [];
  const completed = communicationSteps.filter(
    (step) => step.status === 'done' || step.status === 'skipped'
  ).length;
  const placeholderSections = render.phases.filter(
    (phase) => phase.id !== COORDINATOR_COMMUNICATION_SECTION_ID
  ).length;
  const total = communicationSteps.length + placeholderSections;
  return {
    completed,
    total,
    pct: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

function useWorkspaceCoordinatorId(): string | null {
  const { activeWorkspace, currentUserId } = useWorkspace();
  const [coordinatorId, setCoordinatorId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const workspace =
      activeWorkspace?.type === 'organization'
        ? {
            type: 'organization' as const,
            organizationId: Number.isFinite(Number(activeWorkspace.id))
              ? Number(activeWorkspace.id)
              : null,
          }
        : { type: 'personal' as const, organizationId: null };

    const loadCoordinatorOnboarding = async () => {
      if (!currentUserId || !activeWorkspace) {
        setCoordinatorId(null);
        return;
      }
      const assistants = await fetchAssistants(workspace, true, { currentUserId });
      if (cancelled || !Array.isArray(assistants)) return;
      const coordinator = resolveCanonicalWorkspaceCoordinator(
        assistants,
        currentUserId,
        workspace
      );
      setCoordinatorId(coordinator?.agentId ?? null);
    };

    void loadCoordinatorOnboarding();
    const interval = window.setInterval(loadCoordinatorOnboarding, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeWorkspace, currentUserId]);

  return coordinatorId;
}

export function useCoordinatorOnboardingShortcutVisible(): boolean {
  const pathname = usePathname();
  const coordinatorId = useWorkspaceCoordinatorId();
  const { state: coordinatorOnboardingState } = useCoordinatorOnboarding(coordinatorId);
  const showOnAssistantPanelRoutes = isAssistantInfoPanelShortcutPath(pathname);

  const onboardingProgress = React.useMemo(
    () => coordinatorOnboardingProgress(coordinatorOnboardingState?.onboarding ?? null),
    [coordinatorOnboardingState?.onboarding]
  );

  return (
    showOnAssistantPanelRoutes &&
    !!coordinatorId &&
    coordinatorOnboardingState?.onboardingActive === true &&
    !!coordinatorOnboardingState.onboarding &&
    onboardingProgress.total > 0 &&
    onboardingProgress.completed < onboardingProgress.total
  );
}

/** Opens the workspace Coordinator onboarding panel when onboarding is in progress. */
export function OnboardingProgressShortcut({ className }: { className?: string }) {
  const coordinatorId = useWorkspaceCoordinatorId();
  const { state: coordinatorOnboardingState } = useCoordinatorOnboarding(coordinatorId);
  const [isOnboardingPanelOpen, setIsOnboardingPanelOpen] = React.useState(false);

  const onboardingProgress = React.useMemo(
    () => coordinatorOnboardingProgress(coordinatorOnboardingState?.onboarding ?? null),
    [coordinatorOnboardingState?.onboarding]
  );

  const showOnboardingShortcut = useCoordinatorOnboardingShortcutVisible();

  React.useEffect(() => {
    if (!coordinatorId) {
      setIsOnboardingPanelOpen(false);
      return;
    }

    const applyVisibilityDetail = (detail: AssistantInfoPanelVisibilityDetail) => {
      setIsOnboardingPanelOpen(
        detail.assistantId === coordinatorId && detail.isCoordinatorOnboarding && detail.isOpen
      );
    };
    const onVisibilityChange = (event: Event) => {
      applyVisibilityDetail((event as CustomEvent<AssistantInfoPanelVisibilityDetail>).detail);
    };

    window.addEventListener(ASSISTANT_INFO_PANEL_VISIBILITY_EVENT, onVisibilityChange);
    const currentVisibility = readAssistantInfoPanelVisibility();
    if (currentVisibility) applyVisibilityDetail(currentVisibility);

    return () => {
      window.removeEventListener(ASSISTANT_INFO_PANEL_VISIBILITY_EVENT, onVisibilityChange);
    };
  }, [coordinatorId]);

  const isShortcutActive = showOnboardingShortcut && isOnboardingPanelOpen;

  const openOnboarding = React.useCallback(() => {
    if (!coordinatorId) return;
    const currentVisibility = readAssistantInfoPanelVisibility();
    const canToggleCurrentPanel =
      currentVisibility?.assistantId === coordinatorId && currentVisibility.isCoordinatorOnboarding;
    if (canToggleCurrentPanel && requestAssistantInfoPanelToggle({ assistantId: coordinatorId })) {
      return;
    }

    requestCoordinatorOnboardingPanel(isShortcutActive ? 'close' : 'open', coordinatorId);
  }, [coordinatorId, isShortcutActive]);

  if (!showOnboardingShortcut) return null;

  return (
    <button
      type="button"
      onClick={openOnboarding}
      className={cn(
        'rounded-control flex h-8 min-w-[7.25rem] translate-y-0.5 flex-col justify-center gap-1 px-2 text-left transition-colors',
        'text-body-muted hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isShortcutActive &&
          'bg-primary-tint-10 text-primary ring-1 ring-primary-tint-40 hover:bg-primary-tint-20',
        className
      )}
      data-testid="top-nav-onboarding-shortcut"
      aria-label={`${isShortcutActive ? 'Close' : 'Open'} onboarding, ${onboardingProgress.pct}% complete`}
      aria-pressed={isShortcutActive}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-caption font-medium leading-none">Onboarding</span>
        <span className="text-caption tabular-nums leading-none">{onboardingProgress.pct}%</span>
      </span>
      <span className="h-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full bg-primary transition-all"
          style={{ width: `${onboardingProgress.pct}%` }}
        />
      </span>
    </button>
  );
}
