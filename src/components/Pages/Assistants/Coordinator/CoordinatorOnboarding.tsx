'use client';

/**
 * CoordinatorOnboarding — the guided-view alternate of the assistants
 * page rendered while ``Coordinator/State.mode === 'onboarding'``.
 *
 * Surface selection (left pane only — the onboarding sidebar on the
 * right is constant once the picker has been answered):
 *
 *   - **Picker** (``choice === null`` AND no active call): a
 *     centered, full-width call-vs-chat prompt. No sidebar, no skip
 *     affordance. The picker decision is per-session and never
 *     persisted, so reloading mid-flow drops the user back here.
 *
 *   - **Docked call** (``isCoordinatorCallActive``): the
 *     ``AssistantCommunicationDialog`` rendered inline via the
 *     ``renderDockedCall`` slot, taking the place of the chat
 *     panel. Driven by the parent's call lifecycle — clicking
 *     "Start Call" in the picker triggers ``onStartCall`` and as
 *     soon as the parent flips ``isCoordinatorCallActive`` to true
 *     this surface shows. Hanging up flips it back to false and we
 *     fall through to whatever the picker/chat state requires.
 *
 *   - **Chat surface** (``choice === 'chat'`` AND no active call):
 *     a brief artificial typing pause followed by the normal
 *     ``AssistantProfileChatPanel`` so the seeded greeting reads as
 *     if the coordinator is typing it live.
 */

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ListTodo, Loader2, MessageSquare, Phone, Plug2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import { DroidCallAvatar } from '@/components/Pages/Assistants/Communication/DroidCallAvatar';
import { CoordinatorOnboardingCallIntro } from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingCallIntro';
import { COORDINATOR_ONBOARDING_INTRO_TRANSCRIPT } from '@/utils/assistants/coordinator-onboarding-intro';
import { AssistantProfileChatPanel } from '@/components/Pages/Assistants/Profile/AssistantProfileChatPanel';
import { CoordinatorOnboardingSidebar } from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingSidebar';
import { useCoordinatorOnboardingContext } from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingContext';
import { useCoordinatorOnboarding } from '@/hooks/Assistants/useCoordinatorOnboarding';
import { useCallSounds } from '@/hooks/Assistants/useCallSounds';
import { useIsMobile } from '@/hooks/Common/useMobile';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { notifyOnboardingSessionStarted } from '@/lib/client/coordinator';
import type {
  Assistant,
  AssistantActions,
  AssistantCallConnectOptions,
} from '@/types/assistants/assistant';
import type { ChatMessage, CallPill } from '@/types/assistants/chat';
import type { SpendingGateStatus } from '@/types/assistants/spendingGate';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';

type OnboardingPhase = 'picker' | 'intro' | 'startingCall' | 'call' | 'chat';
type IntroAvatarOffset = { x: number; y: number };

/**
 * Identifiers for the right-section tabs that accumulate as the user
 * progresses through onboarding. Order in the tab strip mirrors the
 * design wireframe: Actions | Tasks | Integrations (left → right),
 * each appearing once its unlocking step has been touched.
 */
type RightSectionTab = 'actions' | 'tasks' | 'integrations';
/** Unified tab identifier used by the mobile layout, where the
 * chat surface and the right-section panes live in the same tab
 * strip instead of being side-by-side columns. */
type MobileTab = 'chat' | RightSectionTab;

/** Hard timeout for the "coordinator is typing…" indicator.
 *
 * The typing bubble normally hides the moment the Coordinator's
 * first message lands in ``chatHistories`` (event-driven via
 * Pub/Sub → SSE). If the round-trip stalls — e.g. the user is on a
 * flaky connection or the orchestra-side emission silently dropped
 * — we still flip the bubble off after this fallback window so the
 * surface doesn't pretend the assistant is typing forever. Sized
 * to feel like a slow-but-real assistant response time. */
const TYPING_INDICATOR_FALLBACK_MS = 8_000;
const ONBOARDING_REVEAL_TRANSITION = {
  duration: 2.8,
  ease: [0.16, 1, 0.3, 1],
} as const;

interface CoordinatorOnboardingProps {
  coordinator: Assistant;
  assistantActions: AssistantActions;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories: Record<string, CallPill[]>;
  setCallPillHistories: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  userEmail: string | null | undefined;
  userTimezone?: string | null;
  spendingGate?: SpendingGateStatus;
  chatStreamConnectionStatus: ChatStreamConnectionStatus;
  reconnectChatStream: () => void;
  chatStreamActivitySignal: number;
  isCallConnected: boolean;
  /** True while the parent is hosting an active (connecting or
   * connected) call session for *this* Coordinator. When true the
   * docked call surface is stacked above the chat surface in the main
   * pane; the parent is responsible for actually mounting the call UI
   * via ``renderDockedCall`` below. */
  isCoordinatorCallActive?: boolean;
  /** Renders the docked ``AssistantCommunicationDialog`` inline. The
   * parent owns the RoomContext + call props and pipes them through
   * here so the dialog mounts inside this surface instead of as a
   * fullscreen overlay. Required whenever
   * ``isCoordinatorCallActive`` is true. */
  renderDockedCall?: () => React.ReactNode;
  onStartCall: (
    assistant: Assistant,
    callType: 'video' | 'audio',
    options?: AssistantCallConnectOptions
  ) => Promise<void> | void;
  /** Opens the workspace OAuth dialog (``AssistantWorkspaceManager``)
   * for this Coordinator. Hung off the "Give your coordinator
   * access to your workspace" sub-item. Wired up from the parent
   * so the dialog mounts at the page root and is reachable from
   * elsewhere (e.g. the assistant list dropdown) without duplicate
   * state. */
  onConnectWorkspace?: () => void;
  /** Renders the Integrations pane body when the user opens the
   * "Connect your coordinator with your apps" step. The parent owns
   * the pane's actions + ownership context and pipes the configured
   * ``IntegrationsPane`` through here so this surface can dock it
   * as a third panel next to the onboarding sidebar — the onboarding
   * equivalent of the right-pane split on the base /assistants page.
   * Unset means the sub-item degrades to a static checklist entry. */
  renderIntegrationsPane?: () => React.ReactNode;
  /** Renders the Tasks pane body when the user reaches the "Assign
   * a task or try these workflows" sub-step. The Tasks tab joins
   * Integrations in the right section as a sibling tab — the
   * onboarding equivalent of accumulating right-pane tabs on the
   * base /assistants page. Unset means the sub-item degrades to a
   * static checklist entry. */
  renderTasksPane?: () => React.ReactNode;
  /** Renders the live Actions viewer body when the user reaches
   * the "Watch and guide me through it" sub-step. The Actions tab
   * joins Tasks + Integrations in the right section as a sibling
   * tab; same accumulation pattern as the others. Unset means the
   * sub-item degrades to a static checklist entry. */
  renderActionsPane?: () => React.ReactNode;
  /** Engages the "Hire your first specialist assistant" sub-step.
   * The parent is expected to (a) open the assistant-hire dialog
   * and (b) swap to the base /assistants layout so the user sees
   * the final view they're about to live in — list on the left,
   * coordinator selected, with the hire dialog popped on top. We
   * deliberately do *not* mark the row complete on click: the row
   * only counts as done when an assistant has actually been hired,
   * at which point the parent flips the Coordinator out of
   * ``onboarding`` mode and the entire onboarding surface
   * unmounts. Unset means the sub-item degrades to a static
   * checklist entry. */
  onHireSpecialist?: () => void;
  /** Invoked after the Coordinator is promoted to ``working`` so the
   * page layout can swap back to the full /assistants shell without
   * waiting on a query refetch. */
  onOnboardingComplete?: () => void;
}

export function CoordinatorOnboarding({
  coordinator,
  assistantActions,
  chatHistories,
  setChatHistories,
  callPillHistories,
  setCallPillHistories,
  userEmail,
  userTimezone,
  spendingGate,
  chatStreamConnectionStatus,
  reconnectChatStream,
  chatStreamActivitySignal,
  isCallConnected,
  isCoordinatorCallActive = false,
  renderDockedCall,
  onStartCall,
  onConnectWorkspace,
  renderIntegrationsPane,
  renderTasksPane,
  renderActionsPane,
  onHireSpecialist,
  onOnboardingComplete,
}: CoordinatorOnboardingProps) {
  const { updateState } = useCoordinatorOnboarding(coordinator.agentId);
  // Voice calls require LiveKit (Console-owned). Without it the picker's
  // "Start Call" is shown disabled (with a reason) and chat is the only path.
  const { voiceCalls } = useFeatures();
  // Shared checklist state lives in the page-level provider so
  // both ``completedStepIds`` and ``engagedStepIds`` survive the
  // gradual ↔ info-panel layout swap. The checklist body reads
  // ``completedStepIds`` directly from the context; right-section
  // tab visibility uses the engagement signal so opening a row
  // unlocks the tab immediately while the row itself stays pending
  // until the underlying real-world state lands (e.g. a connected
  // integration token shows up — see ``Main.tsx`` for the
  // observation wiring).
  const onboardingCtx = useCoordinatorOnboardingContext();
  // No local ``markStepCompleted`` thin-wrapper anymore: every
  // completion path in this surface is now data-observed at the
  // page level (Main.tsx) rather than fired here. Engagement is
  // still tracked locally because it's per-click.
  const markStepEngaged = React.useCallback(
    (stepId: string) => {
      onboardingCtx?.markStepEngaged(stepId);
    },
    [onboardingCtx]
  );

  // Ephemeral per-session phase: a reload always returns to the
  // picker so a resumed onboarding lets the user re-decide between
  // call and chat. Persisting this on Coordinator/State was the
  // earlier design; we removed it on purpose.
  const [phase, setPhase] = React.useState<OnboardingPhase>('picker');
  const [introAvatarOffset, setIntroAvatarOffset] = React.useState<IntroAvatarOffset>({
    x: 0,
    y: -72,
  });
  const hasTriggeredCallStartRef = React.useRef(false);
  const isCoordinatorCallActiveRef = React.useRef(isCoordinatorCallActive);

  const [isStartingCall, setIsStartingCall] = React.useState(false);
  const [isSkipping, setIsSkipping] = React.useState(false);
  // Right-section tabs (Actions, Tasks, Integrations) accumulate as
  // the user progresses — visibility is derived from
  // ``completedStepIds`` so that *any* path that unlocks a step
  // (real action, hardcoded debug seed, future backend snapshot)
  // automatically exposes the corresponding tab. Once unlocked a tab
  // stays available for the rest of the session; users return to the
  // 2-pane layout only by reloading or by skipping onboarding.
  //
  // ``activeRightTab`` is the tab whose pane is currently rendered;
  // the most-recently-engaged tab is selected by default, and the
  // user can switch via the tab strip when more than one is open.
  const [activeRightTab, setActiveRightTab] = React.useState<RightSectionTab>('integrations');
  // Mobile-only: which tab is showing in the unified ``Chat |
  // Integrations | Tasks | Actions`` strip we render on narrow
  // viewports. Defaults to ``'chat'`` so a fresh mobile session
  // lands on the conversation (or call) just like desktop. The
  // auto-engage effect below also drives this so a newly-unlocked
  // right-section tab pops to the front on mobile — the user
  // wouldn't otherwise see the panel that just opened, since on
  // mobile the right section isn't a separate column.
  const [activeMobileTab, setActiveMobileTab] = React.useState<MobileTab>('chat');
  const isMobile = useIsMobile();
  const { startRinging: startPickerRinging, stopRinging: stopPickerRinging } = useCallSounds();
  const isPickerVisible = !isCoordinatorCallActive && phase === 'picker';

  React.useEffect(() => {
    if (!isPickerVisible) {
      stopPickerRinging();
      return;
    }

    startPickerRinging();
    return stopPickerRinging;
  }, [isPickerVisible, startPickerRinging, stopPickerRinging]);

  // Workspace OAuth is engagement-only on click — the dialog
  // opens but the step stays pending until ``Assistant.email`` +
  // ``.emailProvider`` actually land on the Coordinator row.
  // Completion observation lives in ``Main.tsx`` so it fires once
  // for both this surface and the info-panel checklist, and also
  // picks up users who connected on a previous session.
  const handleConnectWorkspace = React.useCallback(() => {
    markStepEngaged('workspace');
    onConnectWorkspace?.();
  }, [markStepEngaged, onConnectWorkspace]);

  // The "Connect apps / Assign task / Watch and guide" rows are
  // engagement-only on click: clicking unlocks the right-section
  // tab so the user can interact with the surface, but the row
  // stays pending until the real underlying state lands. Real
  // completion is observed at the page level (Main.tsx) by
  // watching the Integrations / Tasks / LiveActions data and
  // calling ``markStepCompleted`` from the count-change callbacks
  // wired onto the rendered panes.
  const handleOpenIntegrations = React.useCallback(() => {
    if (!renderIntegrationsPane) return;
    markStepEngaged('apps');
    setActiveRightTab('integrations');
    setActiveMobileTab('integrations');
  }, [markStepEngaged, renderIntegrationsPane]);

  // "Ask your coordinator to do something now" → opens the live
  // Actions panel so the user watches the one-off job run. Engages
  // the ``act`` step; completion is observed at the page level off
  // the live-actions feed.
  const handleActNow = React.useCallback(() => {
    if (!renderActionsPane) return;
    markStepEngaged('act');
    setActiveRightTab('actions');
    setActiveMobileTab('actions');
  }, [markStepEngaged, renderActionsPane]);

  // "Schedule a task for later" → opens the Tasks panel. Engages the
  // ``schedule`` step; completion is observed when a scheduled task
  // lands in the Tasks context.
  const handleScheduleTask = React.useCallback(() => {
    if (!renderTasksPane) return;
    markStepEngaged('schedule');
    setActiveRightTab('tasks');
    setActiveMobileTab('tasks');
  }, [markStepEngaged, renderTasksPane]);

  // Auto-engage the right-section steps as soon as their
  // prerequisite completes, so the corresponding panel pops open
  // without making the user click the checklist row. The contract
  // mirrors what the click handlers above do (markStepEngaged +
  // setActiveRightTab) so the panel surfaces, becomes the active
  // tab, and the step row itself stays pending until the real
  // underlying state lands. Gated on the renderer being wired so
  // we don't auto-engage a step whose panel this surface can't
  // mount. We also gate on the step not already being engaged or
  // complete to avoid bouncing the active tab around on resumed
  // sessions where the user has already moved past the step.
  const completedStepIds = onboardingCtx?.completedStepIds;
  const engagedStepIdsForAutoOpen = onboardingCtx?.engagedStepIds;
  React.useEffect(() => {
    if (!completedStepIds || !engagedStepIdsForAutoOpen) return;
    const autoEngage = (
      stepId: 'apps' | 'act' | 'schedule',
      prereqId: string,
      tab: RightSectionTab,
      hasRenderer: boolean,
      // Whether to also switch the active tab to ``tab``. We focus
      // when reaching a step *primes* the user for an action they're
      // about to take (open Integrations to connect, open Actions to
      // ask for work). We deliberately DON'T focus when reaching
      // ``schedule``: that step completes the moment the user's first
      // action *starts running*, and stealing focus to the Tasks
      // panel right then would yank them away from watching the very
      // action they just kicked off. The Tasks tab still appears
      // (engaged); the checklist "Next" pill + coordinator narration
      // point them to it when they're ready.
      focus: boolean
    ) => {
      if (!hasRenderer) return;
      if (!completedStepIds.has(prereqId)) return;
      if (completedStepIds.has(stepId)) return;
      if (engagedStepIdsForAutoOpen.has(stepId)) return;
      onboardingCtx?.markStepEngaged(stepId);
      if (focus) {
        setActiveRightTab(tab);
        setActiveMobileTab(tab);
      }
    };
    // Engage order follows the new step flow: connect apps →
    // act now (Actions panel) → schedule a task (Tasks panel).
    autoEngage('apps', 'workspace', 'integrations', !!renderIntegrationsPane, true);
    autoEngage('act', 'apps', 'actions', !!renderActionsPane, true);
    autoEngage('schedule', 'act', 'tasks', !!renderTasksPane, false);
  }, [
    completedStepIds,
    engagedStepIdsForAutoOpen,
    onboardingCtx,
    renderActionsPane,
    renderIntegrationsPane,
    renderTasksPane,
  ]);

  // Hire-specialist is the final structural milestone: clicking
  // hands control back to the parent, which is expected to swap to
  // the base /assistants layout and pop the hire dialog on top. We
  // never mark the row complete locally — completion only happens
  // when an actual hire lands, at which point the parent flips the
  // Coordinator out of ``onboarding`` mode and the onboarding
  // surface unmounts entirely.
  const handleHireSpecialist = React.useCallback(() => {
    onHireSpecialist?.();
  }, [onHireSpecialist]);

  // Snapshot of completed step ids passed to Unity at picker time.
  // Lives behind a ref so picker handlers don't rerun whenever the
  // checklist progresses — the snapshot is captured at click time
  // and that's the one Unity should see.
  const completedStepIdsRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    if (!onboardingCtx) return;
    completedStepIdsRef.current = Array.from(onboardingCtx.completedStepIds);
  }, [onboardingCtx]);

  // Fire the chat picker-resolution event so Unity opens the text
  // session with the right kind of message (intro on a fresh
  // transcript, recap on a resumed one). Best-effort: the chat
  // surface still mounts even if the event POST fails — the user
  // can always send a message themselves to unblock things. The
  // call path deliberately skips this: the spoken intro owns that
  // first turn, and sending a parallel text while on a call feels
  // like the coordinator droid is talking over itself.
  const notifySessionStarted = React.useCallback(
    (medium: 'chat' | 'call') => {
      const snapshot = completedStepIdsRef.current;
      void notifyOnboardingSessionStarted(
        coordinator.agentId,
        medium,
        snapshot.length > 0 ? snapshot : undefined
      );
    },
    [coordinator.agentId]
  );

  const triggerCoordinatorCallStart = React.useCallback(async () => {
    if (hasTriggeredCallStartRef.current || isCoordinatorCallActiveRef.current) return;
    hasTriggeredCallStartRef.current = true;
    setIsStartingCall(true);
    try {
      await onStartCall(coordinator, 'audio', {
        suppressRinging: true,
        openingConfig: {
          mode: 'simulated',
          simulatedUtterance: COORDINATOR_ONBOARDING_INTRO_TRANSCRIPT,
          source: 'coordinator_droid_onboarding_intro',
        },
      });
    } catch (error) {
      console.error('[CoordinatorOnboarding] Failed to start intro call:', error);
      hasTriggeredCallStartRef.current = false;
      setPhase('picker');
    } finally {
      setIsStartingCall(false);
    }
  }, [coordinator, onStartCall]);

  const handleStartCall = React.useCallback(
    (avatarOffset: IntroAvatarOffset) => {
      if (phase !== 'picker' || isCoordinatorCallActive) return;
      setIntroAvatarOffset(avatarOffset);
      setPhase('intro');
    },
    [isCoordinatorCallActive, phase]
  );

  const handleIntroFinished = React.useCallback(() => {
    setPhase(isCoordinatorCallActiveRef.current ? 'call' : 'startingCall');
  }, []);

  const handlePickChat = React.useCallback(() => {
    setPhase('chat');
    notifySessionStarted('chat');
  }, [notifySessionStarted]);

  React.useEffect(() => {
    isCoordinatorCallActiveRef.current = isCoordinatorCallActive;
    if (isCoordinatorCallActive && phase === 'startingCall') {
      setPhase('call');
    }
  }, [isCoordinatorCallActive, phase]);

  // When a docked call ends (parent flips ``isCoordinatorCallActive``
  // back to false), the user lands without an active surface. If the
  // call path had taken over, reset back to the picker so they can
  // re-pick — they may want to text-chat or re-dial. Skipped when
  // the user picked chat, since the chat surface remains the right
  // fallback.
  const prevCallActiveRef = React.useRef(isCoordinatorCallActive);
  React.useEffect(() => {
    const wasActive = prevCallActiveRef.current;
    prevCallActiveRef.current = isCoordinatorCallActive;
    if (wasActive && !isCoordinatorCallActive && (phase === 'call' || phase === 'startingCall')) {
      hasTriggeredCallStartRef.current = false;
      setPhase('picker');
    }
  }, [isCoordinatorCallActive, phase]);

  const handleSkipOnboarding = React.useCallback(async () => {
    if (isSkipping) return;
    setIsSkipping(true);
    try {
      const next = await updateState({ mode: 'working', clearOnboardingStep: true });
      if (next?.mode === 'working') {
        onOnboardingComplete?.();
      }
    } finally {
      setIsSkipping(false);
    }
  }, [isSkipping, onOnboardingComplete, updateState]);

  // ── Picker phase ──────────────────────────────────────────────
  // Picker shows only when nothing else is committed: no call is
  // alive, the user hasn't picked chat, and they haven't just hit
  // Start Call (``choice === 'call'`` covers the connecting window
  // before the parent flips ``isCoordinatorCallActive`` to true).
  if (isPickerVisible) {
    return (
      <div
        className="brand-page-stencil-bg flex h-full w-full items-center justify-center bg-background"
        data-testid="coordinator-onboarding"
      >
        <CoordinatorOnboardingPicker
          voiceCalls={voiceCalls}
          onStartCall={handleStartCall}
          onPickChat={handlePickChat}
          isStartingCall={isStartingCall}
        />
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <AnimatePresence mode="wait">
        <CoordinatorOnboardingCallIntro
          initialAvatarOffset={introAvatarOffset}
          onReadyToStartCall={triggerCoordinatorCallStart}
          onFinished={handleIntroFinished}
        />
      </AnimatePresence>
    );
  }

  // ── Post-picker phase: main surface + onboarding sidebar ──────
  // The sidebar is a fixed 380px column on tablet/desktop —
  // matching the long-term ``ChatSidePanel`` width so the layout
  // doesn't jolt when the page swaps to the base /assistants shell
  // after onboarding. On narrow viewports the sidebar collapses
  // and the main surface goes full width; the skip affordance is
  // unreachable there, but onboarding doesn't target mobile anyway.
  const chatSurface = (
    <CoordinatorOnboardingChatSurface
      coordinator={coordinator}
      assistantActions={assistantActions}
      chatHistories={chatHistories}
      setChatHistories={setChatHistories}
      callPillHistories={callPillHistories}
      setCallPillHistories={setCallPillHistories}
      userEmail={userEmail}
      userTimezone={userTimezone}
      spendingGate={spendingGate}
      chatStreamConnectionStatus={chatStreamConnectionStatus}
      reconnectChatStream={reconnectChatStream}
      chatStreamActivitySignal={chatStreamActivitySignal}
      isCallConnected={isCallConnected}
      showTypingPlaceholder={phase === 'chat'}
    />
  );

  const mainPane =
    isCoordinatorCallActive && renderDockedCall ? (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <motion.div
          initial={false}
          animate={{ y: 0 }}
          className="min-h-0 flex-1 border-b"
          data-testid="coordinator-call-docked-region"
        >
          {renderDockedCall()}
        </motion.div>
        <motion.div
          initial={false}
          animate={{ y: 0 }}
          className="min-h-0 flex-1"
          data-testid="coordinator-chat-during-call-region"
        >
          {chatSurface}
        </motion.div>
      </div>
    ) : (
      chatSurface
    );

  // Layout proportions match the progressive-build wireframe:
  //
  //   - 2-pane (no right section opened): the left container is
  //     full-width; chat takes ``flex-1`` and the sidebar a fixed
  //     380px on the right.
  //   - 3-pane (right section open): the left container takes 2/3
  //     of the page (chat ``flex-1`` + 380px sidebar) and the
  //     right section the remaining 1/3. A single "Chat" (or
  //     "Call") header band sits across the top of the left
  //     container, treating chat + sidebar as a single tab group —
  //     this is what the wireframe calls out as "progressively
  //     building the full layout of the base assistants page".
  //   - 4-region (hire-specialist clicked): handled by the parent —
  //     this surface unmounts in favour of the base /assistants
  //     shell, so the user sees the post-onboarding layout (list ▸
  //     chat ▸ right pane) with the hire dialog popped on top.
  //
  // The right section is itself tabbed: Actions, Tasks, and
  // Integrations accumulate as the user progresses. Visibility is
  // driven by ``engagedStepIds`` (not the stricter
  // ``completedStepIds``) so opening a row unlocks its tab the
  // moment the user clicks it, even before the underlying real
  // action lands. Once engaged the tab stays available, matching
  // the "progressively building the full /assistants layout" arc.
  const engagedStepIds = onboardingCtx?.engagedStepIds;
  const showIntegrations = !!engagedStepIds?.has('apps') && !!renderIntegrationsPane;
  const showActions = !!engagedStepIds?.has('act') && !!renderActionsPane;
  const showTasks = !!engagedStepIds?.has('schedule') && !!renderTasksPane;
  const hasRightSection = showIntegrations || showTasks || showActions;

  // Label + icon track the active main-pane surface. We
  // deliberately keep a single tab whether the user is on chat or
  // call — both share the same column slot, and the label
  // disambiguates which is showing without forcing the user to
  // re-orient when the call ends. The Phone icon during an active
  // call matches the Start Call button on the picker; chat uses
  // the same icon as the base /assistants right-pane Chat tab.
  const mainPaneTabLabel = isCoordinatorCallActive ? 'Call' : 'Chat';
  const MainPaneTabIcon = isCoordinatorCallActive ? Phone : MessageSquare;

  // Resolve the visible right tab. If a tab gets closed (or was
  // never opened) but ``activeRightTab`` still points at it, fall
  // back to whichever tab is open — preferring the tab the user
  // most recently picked. The current UI has no close affordance,
  // so this is mostly defensive against future iterations where a
  // tab might be retractable.
  const isVisibleTab = (tab: RightSectionTab): boolean =>
    tab === 'actions' ? showActions : tab === 'tasks' ? showTasks : showIntegrations;
  const resolvedActiveRightTab: RightSectionTab = isVisibleTab(activeRightTab)
    ? activeRightTab
    : showActions
      ? 'actions'
      : showTasks
        ? 'tasks'
        : 'integrations';

  // The onboarding sidebar (checklist + skip footer) is identical
  // in desktop and mobile layouts; only its positioning differs.
  // Computing it once here keeps the two branches below from
  // duplicating prop wiring.
  const onboardingSidebar = (
    <CoordinatorOnboardingSidebar
      onSkip={handleSkipOnboarding}
      isSkipping={isSkipping}
      onConnectWorkspace={onConnectWorkspace ? handleConnectWorkspace : undefined}
      onConnectApps={renderIntegrationsPane ? handleOpenIntegrations : undefined}
      onActNow={renderActionsPane ? handleActNow : undefined}
      onScheduleTask={renderTasksPane ? handleScheduleTask : undefined}
      onHireSpecialist={onHireSpecialist ? handleHireSpecialist : undefined}
      // Drives the call- vs. chat-flavoured "Act now" suggestion
      // chips — same signal that labels the main pane Call/Chat.
      isOnCall={isCoordinatorCallActive}
    />
  );

  // ── Mobile layout ────────────────────────────────────────────
  // Narrow viewports collapse the desktop 2/3-pane split into a
  // vertical stack:
  //   1. Unified tab strip — Chat (or Call) plus any engaged
  //      right-section tabs (Integrations / Tasks / Actions).
  //   2. Active pane filling roughly 60% of the remaining height
  //      (mirrors the ~60/40 horizontal split on desktop where
  //      the 380px sidebar takes ~40% of a typical viewport).
  //   3. Checklist + Skip-onboarding footer in the remaining ~40%
  //      so the user keeps their progress in view without having
  //      to scroll past the chat.
  // We branch on ``useIsMobile`` rather than CSS-only because the
  // chat surface is a heavy component and we don't want to mount
  // it twice; the hook returns ``false`` during SSR + the very
  // first client render so the desktop layout is the safe default.
  if (isMobile) {
    // Resolve the active mobile tab against actual engagement —
    // if the selected tab got unmounted (engagement undone, etc.)
    // fall back to chat. We never strand the user on a hidden
    // tab.
    const isMobileTabVisible = (tab: MobileTab): boolean =>
      tab === 'chat'
        ? true
        : tab === 'actions'
          ? showActions
          : tab === 'tasks'
            ? showTasks
            : showIntegrations;
    const resolvedActiveMobileTab: MobileTab = isMobileTabVisible(activeMobileTab)
      ? activeMobileTab
      : 'chat';
    return (
      <div
        className="flex h-full w-full flex-col bg-background"
        data-testid="coordinator-onboarding"
      >
        <motion.div
          initial={{ y: -48 }}
          animate={{ y: 0 }}
          transition={ONBOARDING_REVEAL_TRANSITION}
        >
          <OnboardingMobileTabStrip
            activeTab={resolvedActiveMobileTab}
            onSelectTab={setActiveMobileTab}
            chatLabel={mainPaneTabLabel}
            ChatIcon={MainPaneTabIcon}
            showActions={showActions}
            showTasks={showTasks}
            showIntegrations={showIntegrations}
          />
        </motion.div>
        {/* Flex-col so the active pane (Tasks / Actions /
         *  Integrations) stretches to the container's full width.
         *  A row flex container would leave the child sized to
         *  its intrinsic width — fine for the chat surface (which
         *  carries ``w-full``) but not for the panes, which rely
         *  on their parent giving them a width. */}
        <div className="flex min-h-0 flex-[3] flex-col overflow-hidden">
          {resolvedActiveMobileTab === 'actions' && showActions
            ? renderActionsPane()
            : resolvedActiveMobileTab === 'tasks' && showTasks
              ? renderTasksPane()
              : resolvedActiveMobileTab === 'integrations' && showIntegrations
                ? renderIntegrationsPane()
                : mainPane}
        </div>
        <motion.aside
          initial={{ y: 220 }}
          animate={{ y: 0 }}
          transition={{ ...ONBOARDING_REVEAL_TRANSITION, delay: 0.55 }}
          className="flex min-h-0 flex-[2] flex-col border-t"
          data-testid="coordinator-onboarding-sidebar"
        >
          {onboardingSidebar}
        </motion.aside>
      </div>
    );
  }

  // ── Desktop layout ───────────────────────────────────────────
  return (
    <div className="flex h-full w-full bg-background" data-testid="coordinator-onboarding">
      {/* Center container (chat + onboarding sidebar). When the
       * right section is open we use a 2:1 flex-grow ratio so chat
       * gets twice the remaining width as the right pane,
       * matching the wireframe. */}
      <motion.div
        initial={isCoordinatorCallActive ? false : { x: -120 }}
        animate={{ x: 0 }}
        transition={ONBOARDING_REVEAL_TRANSITION}
        className={cn('flex min-w-0 flex-col', hasRightSection ? 'flex-[2]' : 'flex-1')}
      >
        {hasRightSection && (
          <OnboardingPanelTabHeader
            label={mainPaneTabLabel}
            Icon={MainPaneTabIcon}
            testId="coordinator-onboarding-chat-tab"
          />
        )}
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1">{mainPane}</div>
          <motion.aside
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            transition={{ ...ONBOARDING_REVEAL_TRANSITION, delay: 0.55 }}
            className="h-full w-[380px] flex-shrink-0 border-l"
            data-testid="coordinator-onboarding-sidebar"
          >
            {onboardingSidebar}
          </motion.aside>
        </div>
      </motion.div>
      {hasRightSection && (
        <motion.aside
          initial={{ x: 520 }}
          animate={{ x: 0 }}
          transition={{ ...ONBOARDING_REVEAL_TRANSITION, delay: 0.85 }}
          className="flex h-full min-w-0 flex-1 flex-col border-l"
          data-testid="coordinator-onboarding-right-section"
        >
          <OnboardingRightSectionTabs
            showActions={showActions}
            showTasks={showTasks}
            showIntegrations={showIntegrations}
            activeTab={resolvedActiveRightTab}
            onSelectTab={setActiveRightTab}
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            {resolvedActiveRightTab === 'actions' && showActions
              ? renderActionsPane()
              : resolvedActiveRightTab === 'tasks' && showTasks
                ? renderTasksPane()
                : showIntegrations
                  ? renderIntegrationsPane()
                  : null}
          </div>
        </motion.aside>
      )}
    </div>
  );
}

/* ─── Panel tab header / strip (Chat, Integrations, Tasks) ─────────────── */

/**
 * Shared header strip used by the Chat column when the 3-pane
 * layout is active. Single non-interactive label with an icon to
 * mirror the visual treatment of the base /assistants right-pane
 * tab strip — onboarding is meant to feel like a slimmed-down
 * preview of that final layout. The chat column has nothing to
 * switch between within onboarding, so it renders as a static
 * label rather than an interactive tab.
 */
function OnboardingPanelTabHeader({
  label,
  Icon,
  testId,
}: {
  label: string;
  Icon: LucideIcon;
  testId: string;
}) {
  return (
    <div
      className="flex h-10 flex-shrink-0 items-center gap-1.5 border-b px-4"
      data-testid={testId}
    >
      <Icon className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
      <span className="text-label font-medium text-foreground">{label}</span>
    </div>
  );
}

/**
 * Tab strip for the right section. Accumulates Actions + Tasks +
 * Integrations tabs as the user progresses; clicking switches the
 * active pane. Render order matches the wireframe (Actions | Tasks
 * | Integrations, left → right) so newly-unlocked tabs slot in to
 * the left of the existing ones rather than re-ordering what the
 * user already had.
 *
 * Visual treatment mirrors the regular right-pane tab strip so the
 * onboarding view feels like a slimmed-down version of the same
 * container — primary-coloured underline on the active tab, muted
 * on the others.
 */
interface OnboardingRightSectionTabsProps {
  showActions: boolean;
  showTasks: boolean;
  showIntegrations: boolean;
  activeTab: RightSectionTab;
  onSelectTab: (next: RightSectionTab) => void;
}

function OnboardingRightSectionTabs({
  showActions,
  showTasks,
  showIntegrations,
  activeTab,
  onSelectTab,
}: OnboardingRightSectionTabsProps) {
  const tabClass = (isActive: boolean) =>
    cn(
      'flex h-full shrink-0 items-center rounded-none border-b-2 border-transparent bg-transparent px-1 py-1 text-label font-medium text-muted-foreground transition-colors',
      'hover:text-foreground',
      isActive && 'border-primary text-foreground font-semibold'
    );

  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-4 border-b px-4">
      {showActions && (
        <button
          type="button"
          className={tabClass(activeTab === 'actions')}
          onClick={() => onSelectTab('actions')}
          data-testid="coordinator-onboarding-actions-tab"
          data-state={activeTab === 'actions' ? 'active' : 'inactive'}
        >
          <Activity className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Actions
        </button>
      )}
      {showTasks && (
        <button
          type="button"
          className={tabClass(activeTab === 'tasks')}
          onClick={() => onSelectTab('tasks')}
          data-testid="coordinator-onboarding-tasks-tab"
          data-state={activeTab === 'tasks' ? 'active' : 'inactive'}
        >
          <ListTodo className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Tasks
        </button>
      )}
      {showIntegrations && (
        <button
          type="button"
          className={tabClass(activeTab === 'integrations')}
          onClick={() => onSelectTab('integrations')}
          data-testid="coordinator-onboarding-integrations-tab"
          data-state={activeTab === 'integrations' ? 'active' : 'inactive'}
        >
          <Plug2 className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Integrations
        </button>
      )}
    </div>
  );
}

/**
 * Unified tab strip rendered at the top of the mobile onboarding
 * layout. Mirrors the visual treatment of ``OnboardingRightSectionTabs``
 * — underlined active tab, muted siblings — but extends it with a
 * leading ``Chat`` (or ``Call`` mid-call) tab so the user can flip
 * back to the conversation without a separate header band. Only
 * the chat tab is always present; the right-section tabs append
 * themselves as their underlying steps get engaged, mirroring
 * desktop's unlock-order behaviour.
 *
 * Render order: ``Chat | Actions | Tasks | Integrations`` —
 * matches the desktop right-section strip ordering so a user
 * resizing across the breakpoint sees their tabs stay roughly in
 * place (rather than reshuffling). Chat docks leftmost as the
 * default anchor for the session.
 */
interface OnboardingMobileTabStripProps {
  activeTab: MobileTab;
  onSelectTab: (next: MobileTab) => void;
  chatLabel: string;
  ChatIcon: LucideIcon;
  showActions: boolean;
  showTasks: boolean;
  showIntegrations: boolean;
}

function OnboardingMobileTabStrip({
  activeTab,
  onSelectTab,
  chatLabel,
  ChatIcon,
  showActions,
  showTasks,
  showIntegrations,
}: OnboardingMobileTabStripProps) {
  const tabClass = (isActive: boolean) =>
    cn(
      'flex h-full shrink-0 items-center rounded-none border-b-2 border-transparent bg-transparent px-1 py-1 text-label font-medium text-muted-foreground transition-colors',
      'hover:text-foreground',
      isActive && 'border-primary text-foreground font-semibold'
    );

  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-4 border-b px-4">
      <button
        type="button"
        className={tabClass(activeTab === 'chat')}
        onClick={() => onSelectTab('chat')}
        data-testid="coordinator-onboarding-mobile-chat-tab"
        data-state={activeTab === 'chat' ? 'active' : 'inactive'}
      >
        <ChatIcon className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
        {chatLabel}
      </button>
      {showActions && (
        <button
          type="button"
          className={tabClass(activeTab === 'actions')}
          onClick={() => onSelectTab('actions')}
          data-testid="coordinator-onboarding-mobile-actions-tab"
          data-state={activeTab === 'actions' ? 'active' : 'inactive'}
        >
          <Activity className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Actions
        </button>
      )}
      {showTasks && (
        <button
          type="button"
          className={tabClass(activeTab === 'tasks')}
          onClick={() => onSelectTab('tasks')}
          data-testid="coordinator-onboarding-mobile-tasks-tab"
          data-state={activeTab === 'tasks' ? 'active' : 'inactive'}
        >
          <ListTodo className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Tasks
        </button>
      )}
      {showIntegrations && (
        <button
          type="button"
          className={tabClass(activeTab === 'integrations')}
          onClick={() => onSelectTab('integrations')}
          data-testid="coordinator-onboarding-mobile-integrations-tab"
          data-state={activeTab === 'integrations' ? 'active' : 'inactive'}
        >
          <Plug2 className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
          Integrations
        </button>
      )}
    </div>
  );
}

/* ─── Picker (Start Call / I'd rather chat) ─────────────────────────────── */

interface CoordinatorOnboardingPickerProps {
  /** Whether voice calls are configured on this deployment (LiveKit). */
  voiceCalls: boolean;
  onStartCall: (avatarOffset: IntroAvatarOffset) => void;
  onPickChat: () => void;
  isStartingCall: boolean;
}

function CoordinatorOnboardingPicker({
  voiceCalls,
  onStartCall,
  onPickChat,
  isStartingCall,
}: CoordinatorOnboardingPickerProps) {
  const avatarRef = React.useRef<HTMLDivElement | null>(null);

  const handleStartCall = React.useCallback(() => {
    const rect = avatarRef.current?.getBoundingClientRect();
    const containerRect = avatarRef.current
      ?.closest('[data-testid="coordinator-onboarding"]')
      ?.getBoundingClientRect();
    const avatarOffset =
      rect && containerRect
        ? {
            x: rect.left + rect.width / 2 - (containerRect.left + containerRect.width / 2),
            y: rect.top + rect.height / 2 - (containerRect.top + containerRect.height / 2),
          }
        : { x: 0, y: -72 };
    onStartCall(avatarOffset);
  }, [onStartCall]);

  const startCallButton = (
    <Button
      size="lg"
      onClick={handleStartCall}
      disabled={isStartingCall || !voiceCalls}
      className={cn(!isStartingCall && voiceCalls && 'animate-onboarding-ring-pulse')}
      data-testid="coordinator-onboarding-start-call"
    >
      {isStartingCall ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Starting call…
        </>
      ) : (
        <>
          <Phone className="mr-2 h-4 w-4" />
          Start Call
        </>
      )}
    </Button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="align-center flex max-w-md flex-col items-center gap-6 px-6 text-center"
      data-testid="coordinator-onboarding-picker"
    >
      <div ref={avatarRef} className="h-32 w-32">
        <DroidCallAvatar creatureClassName="h-28 w-28" isSpeaking={false} />
      </div>
      <p className="text-h3 font-medium text-foreground">
        {voiceCalls
          ? 'Your coordinator droid is calling to onboard you'
          : 'Start onboarding with your coordinator droid'}
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        {voiceCalls ? (
          startCallButton
        ) : (
          // Keep the call option visible but disabled, with a reason. The span
          // wrapper lets the tooltip fire over the disabled button.
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">{startCallButton}</span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Voice calls aren&apos;t enabled on this deployment</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Button
          variant="link"
          onClick={onPickChat}
          disabled={isStartingCall}
          data-testid="coordinator-onboarding-pick-chat"
        >
          I&apos;d rather chat for now
        </Button>
      </div>
    </motion.div>
  );
}

/* ─── Chat surface (post-picker) ────────────────────────────────────────── */

interface CoordinatorOnboardingChatSurfaceProps {
  coordinator: Assistant;
  assistantActions: AssistantActions;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories: Record<string, CallPill[]>;
  setCallPillHistories: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  userEmail: string | null | undefined;
  userTimezone?: string | null;
  spendingGate?: SpendingGateStatus;
  chatStreamConnectionStatus: ChatStreamConnectionStatus;
  reconnectChatStream: () => void;
  chatStreamActivitySignal: number;
  isCallConnected: boolean;
  showTypingPlaceholder: boolean;
}

function CoordinatorOnboardingChatSurface({
  coordinator,
  assistantActions,
  chatHistories,
  setChatHistories,
  callPillHistories,
  setCallPillHistories,
  userEmail,
  userTimezone,
  spendingGate,
  chatStreamConnectionStatus,
  reconnectChatStream,
  chatStreamActivitySignal,
  isCallConnected,
  showTypingPlaceholder,
}: CoordinatorOnboardingChatSurfaceProps) {
  // Mount the real chat panel immediately so the input bar is
  // visible from the very first render — what we hold back is the
  // *appearance* of the seeded greeting, not the chat surface. The
  // chat panel already renders a typing bubble at the tail of its
  // message list when the assistant is replying; we co-opt that
  // affordance via ``forceTypingIndicator`` to keep a "typing…"
  // hint visible above an empty thread until the Coordinator's
  // opener actually arrives.
  //
  // Two ways the bubble hides:
  //   1. The Coordinator's first assistant message lands in
  //      ``chatHistories`` (event-driven via Pub/Sub → SSE — this
  //      is the happy path).
  //   2. A hard fallback timer fires so a slow / dropped
  //      Pub/Sub round-trip can't strand the indicator forever.
  const coordinatorAgentId = coordinator.agentId;
  const history = chatHistories[coordinatorAgentId];
  const hasAssistantMessage = React.useMemo(() => {
    if (!history) return false;
    return history.some((message) => message.role === 'assistant');
  }, [history]);

  // Remember the assistant-message count we saw on mount so we can
  // detect a *new* assistant message landing after the picker — the
  // page-level prefetch may have already populated previous turns
  // for a resumed session, but the recap line is the one we want
  // to gate on. ``initialAssistantCount`` is captured once and the
  // typing bubble flips off when the live count exceeds it.
  const initialAssistantCountRef = React.useRef<number | null>(null);
  if (initialAssistantCountRef.current === null && history !== undefined) {
    initialAssistantCountRef.current = history.filter(
      (message) => message.role === 'assistant'
    ).length;
  }

  const liveAssistantCount = React.useMemo(() => {
    if (!history) return 0;
    return history.filter((message) => message.role === 'assistant').length;
  }, [history]);

  const hasNewAssistantMessage =
    initialAssistantCountRef.current !== null &&
    liveAssistantCount > initialAssistantCountRef.current;

  const [hasFallbackElapsed, setHasFallbackElapsed] = React.useState(false);
  React.useEffect(() => {
    const handle = window.setTimeout(
      () => setHasFallbackElapsed(true),
      TYPING_INDICATOR_FALLBACK_MS
    );
    return () => window.clearTimeout(handle);
  }, []);

  // Hide the bubble as soon as a new opener arrives, OR after the
  // fallback timer fires. We deliberately keep it visible even if
  // ``hasAssistantMessage`` was already true at mount (e.g. resumed
  // onboarding with a prior recap line still in history) — the
  // user just picked chat again, so they're waiting for *this*
  // session's opener.
  const isTypingPlaceholderVisible =
    showTypingPlaceholder && !hasNewAssistantMessage && !hasFallbackElapsed;

  // Reference variable so eslint doesn't flag ``hasAssistantMessage``
  // as unused — kept around as a clear name for readers tracing the
  // hide logic above (counts on resumed sessions, etc.).
  void hasAssistantMessage;

  return (
    <div
      className="mx-auto flex h-full w-full max-w-3xl flex-col"
      data-testid="coordinator-onboarding-chat"
    >
      <AssistantProfileChatPanel
        assistant={coordinator}
        assistantActions={assistantActions}
        chatHistories={chatHistories}
        setChatHistories={setChatHistories}
        callPillHistories={callPillHistories}
        setCallPillHistories={setCallPillHistories}
        userEmail={userEmail}
        userTimezone={userTimezone}
        spendingGate={spendingGate}
        chatStreamConnectionStatus={chatStreamConnectionStatus}
        reconnectChatStream={reconnectChatStream}
        chatStreamActivitySignal={chatStreamActivitySignal}
        isCallConnected={isCallConnected}
        forceTypingIndicator={isTypingPlaceholderVisible}
      />
    </div>
  );
}
