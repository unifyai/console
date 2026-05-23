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
import { motion } from 'framer-motion';
import { Activity, ListTodo, Loader2, MessageSquare, Phone, Plug2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';
import { AssistantProfileChatPanel } from '@/components/Pages/Assistants/Profile/AssistantProfileChatPanel';
import { ChatMessageBubble } from '@/components/Chat/ChatMessageBubble';
import { CoordinatorOnboardingSidebar } from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingSidebar';
import { useCoordinatorOnboardingContext } from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingContext';
import { useCoordinatorOnboarding } from '@/hooks/Assistants/useCoordinatorOnboarding';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { ChatMessage, CallPill } from '@/types/assistants/chat';
import type { SpendingGateStatus } from '@/types/assistants/spendingGate';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';

type OnboardingPickerChoice = 'call' | 'chat' | null;

/**
 * Identifiers for the right-section tabs that accumulate as the user
 * progresses through onboarding. Order in the tab strip mirrors the
 * design wireframe: Actions | Tasks | Integrations (left → right),
 * each appearing once its unlocking step has been touched.
 */
type RightSectionTab = 'actions' | 'tasks' | 'integrations';

/** How long the artificial "coordinator is typing…" indicator
 * lingers before we reveal the chat surface and its seeded greeting.
 * Long enough to read as intentional, short enough that it never
 * blocks a motivated user. */
const TYPING_INDICATOR_MS = 1_500;

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
   * docked call surface replaces the chat surface in the main pane;
   * the parent is responsible for actually mounting the call UI via
   * ``renderDockedCall`` below. */
  isCoordinatorCallActive?: boolean;
  /** Renders the docked ``AssistantCommunicationDialog`` inline. The
   * parent owns the RoomContext + call props and pipes them through
   * here so the dialog mounts inside this surface instead of as a
   * fullscreen overlay. Required whenever
   * ``isCoordinatorCallActive`` is true. */
  renderDockedCall?: () => React.ReactNode;
  onStartCall: (assistant: Assistant, callType: 'video' | 'audio') => Promise<void> | void;
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

  // Ephemeral per-session choice: a reload always returns to the
  // picker so a resumed onboarding lets the user re-decide between
  // call and chat. Persisting this on Coordinator/State was the
  // earlier design; we removed it on purpose.
  const [choice, setChoice] = React.useState<OnboardingPickerChoice>(null);

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
  }, [markStepEngaged, renderIntegrationsPane]);

  const handleOpenTasks = React.useCallback(() => {
    if (!renderTasksPane) return;
    markStepEngaged('task');
    setActiveRightTab('tasks');
  }, [markStepEngaged, renderTasksPane]);

  const handleOpenActions = React.useCallback(() => {
    if (!renderActionsPane) return;
    markStepEngaged('guide');
    setActiveRightTab('actions');
  }, [markStepEngaged, renderActionsPane]);

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

  const handleStartCall = React.useCallback(async () => {
    if (isStartingCall || isCoordinatorCallActive) return;
    setIsStartingCall(true);
    try {
      // ``choice`` is set so the picker hides immediately — there's
      // typically a brief window between this click and the parent
      // flipping ``isCoordinatorCallActive`` to true, and we don't
      // want the picker to flash back in.
      setChoice('call');
      await onStartCall(coordinator, 'audio');
    } finally {
      setIsStartingCall(false);
    }
  }, [coordinator, isCoordinatorCallActive, isStartingCall, onStartCall]);

  const handlePickChat = React.useCallback(() => {
    setChoice('chat');
  }, []);

  // When a docked call ends (parent flips ``isCoordinatorCallActive``
  // back to false), the user lands without an active surface. If
  // they had clicked Start Call (``choice === 'call'``) reset back
  // to the picker so they can re-pick — they may want to text-chat
  // or re-dial. Skipped when the user picked chat, since the chat
  // surface remains the right fallback.
  const prevCallActiveRef = React.useRef(isCoordinatorCallActive);
  React.useEffect(() => {
    const wasActive = prevCallActiveRef.current;
    prevCallActiveRef.current = isCoordinatorCallActive;
    if (wasActive && !isCoordinatorCallActive && choice === 'call') {
      setChoice(null);
    }
  }, [isCoordinatorCallActive, choice]);

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
  if (!isCoordinatorCallActive && choice === null) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-background"
        data-testid="coordinator-onboarding"
      >
        <CoordinatorOnboardingPicker
          onStartCall={handleStartCall}
          onPickChat={handlePickChat}
          isStartingCall={isStartingCall}
        />
      </div>
    );
  }

  // ── Post-picker phase: main surface + onboarding sidebar ──────
  // The sidebar is a fixed 380px column on tablet/desktop —
  // matching the long-term ``ChatSidePanel`` width so the layout
  // doesn't jolt when the page swaps to the base /assistants shell
  // after onboarding. On narrow viewports the sidebar collapses
  // and the main surface goes full width; the skip affordance is
  // unreachable there, but onboarding doesn't target mobile anyway.
  // Main-pane selection priority (top wins):
  //   1. Active call → docked call surface
  //   2. ``choice === 'call'`` but not yet active → typing
  //      placeholder; the parent's call setup will flip
  //      ``isCoordinatorCallActive`` shortly and we'll re-render
  //   3. ``choice === 'chat'`` → chat surface
  const mainPane =
    isCoordinatorCallActive && renderDockedCall ? (
      renderDockedCall()
    ) : (
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
      />
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
  const showTasks = !!engagedStepIds?.has('task') && !!renderTasksPane;
  const showActions = !!engagedStepIds?.has('guide') && !!renderActionsPane;
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

  return (
    <div className="flex h-full w-full bg-background" data-testid="coordinator-onboarding">
      {/* Center container (chat + onboarding sidebar). When the
       * right section is open we use a 2:1 flex-grow ratio so chat
       * gets twice the remaining width as the right pane,
       * matching the wireframe. */}
      <div className={cn('flex min-w-0 flex-col', hasRightSection ? 'flex-[2]' : 'flex-1')}>
        {hasRightSection && (
          <OnboardingPanelTabHeader
            label={mainPaneTabLabel}
            Icon={MainPaneTabIcon}
            testId="coordinator-onboarding-chat-tab"
          />
        )}
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1">{mainPane}</div>
          <aside
            className="hidden h-full w-[380px] flex-shrink-0 border-l md:flex"
            data-testid="coordinator-onboarding-sidebar"
          >
            <CoordinatorOnboardingSidebar
              onSkip={handleSkipOnboarding}
              isSkipping={isSkipping}
              onConnectWorkspace={onConnectWorkspace ? handleConnectWorkspace : undefined}
              onConnectApps={renderIntegrationsPane ? handleOpenIntegrations : undefined}
              onAssignTask={renderTasksPane ? handleOpenTasks : undefined}
              onWatchAndGuide={renderActionsPane ? handleOpenActions : undefined}
              onHireSpecialist={onHireSpecialist ? handleHireSpecialist : undefined}
            />
          </aside>
        </div>
      </div>
      {hasRightSection && (
        <aside
          className="hidden h-full min-w-0 flex-1 flex-col border-l md:flex"
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
        </aside>
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

/* ─── Picker (Start Call / I'd rather chat) ─────────────────────────────── */

interface CoordinatorOnboardingPickerProps {
  onStartCall: () => void;
  onPickChat: () => void;
  isStartingCall: boolean;
}

function CoordinatorOnboardingPicker({
  onStartCall,
  onPickChat,
  isStartingCall,
}: CoordinatorOnboardingPickerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="align-center flex max-w-md flex-col items-center gap-6 px-6 text-center"
      data-testid="coordinator-onboarding-picker"
    >
      <CoordinatorLogoAvatar className="h-20 w-20 rounded-full pt-2" logoClassName="h-10 w-10" />
      <p className="text-h3 font-medium text-foreground">
        Your Coordinator is calling to onboard you
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button
          size="lg"
          onClick={onStartCall}
          disabled={isStartingCall}
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
}: CoordinatorOnboardingChatSurfaceProps) {
  // Hold the real chat panel back briefly so the seeded greeting
  // arrives behind a "typing…" hint rather than appearing instantly.
  // We only do this once per mount — subsequent renders (e.g. a
  // skip-onboarding toggle, then re-entry) would re-fire the
  // typing pause, which is desired UX.
  const [isTypingPlaceholderVisible, setIsTypingPlaceholderVisible] = React.useState(true);
  React.useEffect(() => {
    const handle = window.setTimeout(
      () => setIsTypingPlaceholderVisible(false),
      TYPING_INDICATOR_MS
    );
    return () => window.clearTimeout(handle);
  }, []);

  if (isTypingPlaceholderVisible) {
    // Mirror the real chat panel's outer shell + spacing so the
    // typing bubble appears in the exact position the first assistant
    // message will land in once the panel mounts — top of the
    // scrollable area, left-aligned, same horizontal padding.
    const photoSrc = coordinator.signedProfilePhotoUrl || coordinator.profilePhoto || undefined;
    return (
      <div
        className="mx-auto flex h-full w-full max-w-3xl flex-col bg-background"
        data-testid="coordinator-onboarding-chat"
      >
        <div className="flex-1 overflow-hidden px-3 md:px-6">
          <div className="space-y-6 py-4" data-testid="coordinator-onboarding-typing">
            <ChatMessageBubble
              message=""
              isUser={false}
              assistantPhoto={photoSrc}
              assistantName={assistantDisplayName(coordinator)}
              isCoordinator={coordinator.isCoordinator}
              isLoading
              index={0}
            />
          </div>
        </div>
      </div>
    );
  }

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
      />
    </div>
  );
}
