'use client';

import React, { useState, useCallback } from 'react';
import { Tabs, TabsContent } from '@/components/UI/tabs';
import { LiveActionsViewer } from './LiveActions';
import { DashboardsPane } from './Dashboards';
import { TasksPane } from './Tasks';
import { IntegrationsPane } from './Integrations';
import { ChatWithInfoPanel } from './Chat/ChatWithInfoPanel';
import type { AssistantActionActions } from '@/types/assistants/action';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';
import type { DashboardPaneData } from '@/types/assistants/dashboard';
import type { ChatMessage, CallPill } from '@/types/assistants/chat';
import {
  type SpendingGateStatus,
  DEFAULT_SPENDING_GATE_STATUS,
} from '@/types/assistants/spendingGate';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';

const TAB_CONTENT_CLASS = 'min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden';

/**
 * Right-pane tab identifiers. Kept as a string-literal union so the
 * persistence layer (`Main`'s `paneState`) and the rail's section config
 * stay typed end-to-end. The active tab is owned by the rail; this
 * container renders the matching body.
 */
export type RightPaneTab = 'chat' | 'tasks' | 'dashboards' | 'integrations' | 'actions';

/**
 * What the right pane is showing. `secondary`/`splitRatio` remain on the
 * persisted shape for backwards-compatible hydration of older layouts,
 * but the assistants surface renders a single pane (the rail owns
 * navigation, so a redundant in-pane split was retired).
 */
export interface RightPaneState {
  primary: { tab: RightPaneTab };
  secondary: { tab: RightPaneTab } | null;
  splitRatio: number;
}

export const DEFAULT_RIGHT_PANE_STATE: RightPaneState = {
  primary: { tab: 'chat' },
  secondary: null,
  splitRatio: 0.5,
};

interface RightPaneContainerProps {
  assistant: Assistant | null;
  actions: AssistantActionActions | null;
  dashboardActions: {
    getMetadata: (assistant: Assistant) => Promise<DashboardPaneData>;
    getTileContent: (assistant: Assistant, tileToken: string) => Promise<string | null>;
  } | null;
  assistantActions: AssistantActions;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories: Record<string, CallPill[]>;
  setCallPillHistories: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  userEmail: string | null | undefined;
  currentUserId?: string | null;
  isFirstView?: boolean;
  preHireChat?: ChatMessage[];
  onFirstViewCompleted?: () => void;
  onStartCall: (assistant: Assistant, callType: 'video' | 'audio') => void;
  activeCallAssistantId: string | null;
  isCallConnected: boolean;
  isConnectingCall: boolean;
  userTimezone?: string | null;
  canWrite?: boolean;
  spendingGate?: SpendingGateStatus;
  /** Page-level chat SSE health — rendered in the panel header. */
  chatStreamConnectionStatus: ChatStreamConnectionStatus;
  /** Force a reconnect of the page-level chat SSE. */
  reconnectChatStream: () => void;
  /**
   * Monotonic counter of inbound frames for the currently-open assistant;
   * drives the panel's typing-indicator clear.
   */
  chatStreamActivitySignal: number;
  /**
   * Active-tab state, lifted to `Main` so the rail can drive navigation
   * and observe which tab the user is looking at.
   */
  paneState: RightPaneState;
  onPaneStateChange: (next: RightPaneState) => void;
  /** Open the Edit Profile dialog for the given assistant (wired from Main). */
  onEditAssistant?: (assistant: Assistant) => void;
  /** Open the Contact Manager dialog for the given assistant (wired from Main). */
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  /** True iff the user has sent ≥1 message in this assistant's chat. */
  hasUserMessage?: boolean;
  /** True iff this assistant has ≥1 historical call recorded. */
  hasHistoricalCall?: boolean;
  /** True iff the logged-in user has a phone number on their profile. */
  hasUserPhoneNumber?: boolean;
  /** Latest user-message timestamp in this chat (drives prefill done-detection). */
  latestUserMessageAt?: Date | null;
  /** User's own phone number for chat prefill personalisation. */
  userPhoneNumber?: string | null;
  /** Open the logged-in user's account settings page. Optional `tab`
   *  mirrors the /account `?tab=` query param so callers can deep-link
   *  to a specific section (e.g. `'contact-info'`). */
  onOpenUserSettings?: (tab?: string) => void;
  /** True iff this assistant has outstanding setup work — drives the
   *  dot on the chat header's profile toggle. */
  hasIncompleteOnboarding?: boolean;
  /**
   * One-shot request id that seeds the assistant info panel open at its
   * maximum available width.
   */
  infoPanelFocusLayoutRequest?: number;
  /**
   * Coordinator-only handler bag forwarded down to the info panel.
   * When the active assistant is the canonical Coordinator and it's
   * still in onboarding mode, the info panel surfaces a third
   * "Onboarding" sub-tab whose action rows are wired from here.
   * Ignored for non-coordinator assistants. */
  coordinatorOnboarding?: {
    onStartOnboardingStep?: (stepId: string) => void;
    onTriggerReferenceStep?: (stepId: string) => void;
    onAddWhatsappNumber?: () => void;
    onAddPhoneNumber?: () => void;
    onConnectSlack?: () => void;
    onConnectDiscord?: () => void;
    onConnectWorkspace?: () => void;
    onConnectApps?: () => void;
    onActNow?: () => void;
    onScheduleTask?: () => void;
    /** Marks a coordinator onboarding step complete when the matching
     * domain data lands (a secret connected → ``apps``, a task created →
     * ``schedule``, an action running → ``act``). Provided only when the
     * rendered assistant is the canonical Coordinator, so another
     * assistant's panes can't tick off its steps. */
    onStepComplete?: (stepId: string) => void;
  };
  /**
   * Renderer for the docked call surface (the
   * ``AssistantCommunicationDialog`` in ``docked`` mode). Threaded
   * straight through to ``ChatWithInfoPanel`` which stacks it above
   * the chat panel; passed by ``Main`` only when a call is active for
   * *this* assistant and hasn't been popped out.
   */
  renderDockedCall?: () => React.ReactNode;
}

/**
 * Hosts the assistant's right-pane bodies (Chat / Actions / Dashboards /
 * Integrations / Tasks). The rail owns navigation and supplies the active
 * tab via `paneState.primary.tab`; each body force-mounts so per-tab
 * scroll/mount state survives switching. The Chat body owns its own
 * profile side panel (see `ChatWithInfoPanel`), so the profile surface
 * only appears on Chat.
 */
export function RightPaneContainer({
  assistant,
  actions,
  dashboardActions,
  assistantActions,
  chatHistories,
  setChatHistories,
  callPillHistories,
  setCallPillHistories,
  userEmail,
  currentUserId,
  isFirstView = false,
  preHireChat,
  onFirstViewCompleted,
  onStartCall,
  activeCallAssistantId,
  isCallConnected,
  isConnectingCall,
  userTimezone,
  canWrite = true,
  spendingGate = DEFAULT_SPENDING_GATE_STATUS,
  chatStreamConnectionStatus,
  reconnectChatStream,
  chatStreamActivitySignal,
  paneState,
  onPaneStateChange,
  onEditAssistant,
  onOpenContactManager,
  hasUserMessage,
  hasHistoricalCall,
  hasUserPhoneNumber,
  latestUserMessageAt,
  userPhoneNumber,
  onOpenUserSettings,
  hasIncompleteOnboarding,
  infoPanelFocusLayoutRequest = 0,
  coordinatorOnboarding,
  renderDockedCall,
}: RightPaneContainerProps) {
  // Tracks whether the live-actions stream is currently working, so the
  // dashboards pane can poll its tiles. The Actions body owns the
  // subscription and reports up.
  const [hasActiveAction, setHasActiveAction] = useState(false);
  const handleActiveActionChange = useCallback((active: boolean) => {
    setHasActiveAction(active);
  }, []);
  const { canOpenAssistantChat } = useAssistantPermissions();

  if (!assistant) {
    return (
      <div className="h-full w-full bg-background">
        <LiveActionsViewer
          assistant={null}
          actions={null}
          className="h-full"
          onHasActiveActionChange={handleActiveActionChange}
        />
      </div>
    );
  }

  if (!canOpenAssistantChat(assistant)) {
    return (
      <div
        data-testid="coordinator-private"
        className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center"
      >
        <p className="text-body-muted">T-W1N chat is private.</p>
        <p className="text-caption text-muted-foreground">
          Open T-W1N from this workspace to continue.
        </p>
      </div>
    );
  }

  const isInThisCall = activeCallAssistantId === assistant.agentId;
  const isSpendingBlocked = spendingGate.isBlocked && !isInThisCall;
  const activeTab = paneState.primary.tab;

  const handleTabChange = (next: string) => {
    onPaneStateChange({ ...paneState, primary: { tab: next as RightPaneTab } });
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex h-full w-full flex-col bg-background"
    >
      <TabsContent value="chat" className={TAB_CONTENT_CLASS} forceMount>
        <ChatWithInfoPanel
          assistant={assistant}
          assistantActions={assistantActions}
          chatHistories={chatHistories}
          setChatHistories={setChatHistories}
          callPillHistories={callPillHistories}
          setCallPillHistories={setCallPillHistories}
          userEmail={userEmail}
          currentUserId={currentUserId}
          userTimezone={userTimezone}
          isFirstView={isFirstView}
          preHireChat={preHireChat}
          onFirstViewCompleted={onFirstViewCompleted}
          spendingGate={spendingGate}
          chatStreamConnectionStatus={chatStreamConnectionStatus}
          reconnectChatStream={reconnectChatStream}
          chatStreamActivitySignal={chatStreamActivitySignal}
          onStartCall={onStartCall}
          activeCallAssistantId={activeCallAssistantId}
          isCallConnected={isCallConnected}
          isConnectingCall={isConnectingCall}
          isSpendingBlocked={isSpendingBlocked}
          spendingBlockedMessage={spendingGate.blockedMessage}
          onEditProfile={onEditAssistant}
          onOpenContactManager={onOpenContactManager}
          canWrite={canWrite}
          hasUserMessage={hasUserMessage}
          hasHistoricalCall={hasHistoricalCall}
          hasUserPhoneNumber={hasUserPhoneNumber}
          latestUserMessageAt={latestUserMessageAt}
          userPhoneNumber={userPhoneNumber}
          onOpenUserSettings={onOpenUserSettings}
          hasIncompleteOnboarding={hasIncompleteOnboarding}
          infoPanelFocusLayoutRequest={infoPanelFocusLayoutRequest}
          coordinatorOnboarding={coordinatorOnboarding}
          renderDockedCall={renderDockedCall}
        />
      </TabsContent>

      <TabsContent value="tasks" className={TAB_CONTENT_CLASS} forceMount>
        <TasksPane
          assistant={assistant}
          ownerId={assistant.userId}
          assistantId={assistant.agentId}
          onTasksCountChange={
            coordinatorOnboarding?.onStepComplete
              ? (count) => {
                  if (count > 0) coordinatorOnboarding.onStepComplete?.('schedule');
                }
              : undefined
          }
        />
      </TabsContent>

      <TabsContent value="dashboards" className={TAB_CONTENT_CLASS} forceMount>
        {dashboardActions ? (
          <DashboardsPane
            assistant={assistant}
            ownerId={assistant.userId}
            assistantId={assistant.agentId}
            getMetadata={dashboardActions.getMetadata}
            getTileContent={dashboardActions.getTileContent}
            shouldPoll={hasActiveAction}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-body-muted">Select an assistant to view dashboards.</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="integrations" className={TAB_CONTENT_CLASS} forceMount>
        <IntegrationsPane
          ownerId={assistant.userId}
          assistantId={assistant.agentId}
          secretActions={assistantActions.secret}
          canWrite={canWrite}
          isVisible={activeTab === 'integrations'}
          onSecretsCountChange={
            coordinatorOnboarding?.onStepComplete
              ? (count) => {
                  if (count > 0) coordinatorOnboarding.onStepComplete?.('apps');
                }
              : undefined
          }
        />
      </TabsContent>

      <TabsContent value="actions" className={TAB_CONTENT_CLASS} forceMount>
        <LiveActionsViewer
          assistant={assistant}
          actions={actions}
          className="h-full"
          onHasActiveActionChange={handleActiveActionChange}
        />
      </TabsContent>
    </Tabs>
  );
}
