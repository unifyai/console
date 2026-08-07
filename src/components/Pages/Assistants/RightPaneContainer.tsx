'use client';

import React, { useState, useCallback } from 'react';
import { Tabs, TabsContent } from '@/components/UI/tabs';
import { LiveActionsViewer } from './LiveActions';
import { CanvasPane } from './Canvas/CanvasPane';
import { DashboardsPane } from './Dashboards';
import { TasksPane } from './Tasks';
import { IntegrationsPane } from './Integrations';
import { WorkflowsPane } from './Workflows';
import { ChatWithInfoPanel } from './Chat/ChatWithInfoPanel';
import { AssistantDesktopPane } from './Desktop/AssistantDesktopPane';
import type {
  AssistantInfoPanelCoordinatorOnboarding,
  AssistantInfoPanelLayoutContext,
} from './Layout/AssistantInfoPanelLayout';
import type { AssistantActionActions } from '@/types/assistants/action';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { DashboardPaneData } from '@/types/assistants/dashboard';
import type { ChatMessage, CallPill, RequestSentAck } from '@/types/assistants/chat';
import {
  type SpendingGateStatus,
  DEFAULT_SPENDING_GATE_STATUS,
} from '@/types/assistants/spendingGate';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
import type { IntegrationGalleryFilters } from '@/components/Integrations';

const TAB_CONTENT_CLASS = 'min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden';

/**
 * Right-pane tab identifiers. Kept as a string-literal union so the
 * persistence layer (`Main`'s `paneState`) and the rail's section config
 * stay typed end-to-end. The active tab is owned by the rail; this
 * container renders the matching body.
 */
export type RightPaneTab =
  | 'chat'
  | 'tasks'
  | 'canvas'
  | 'dashboards'
  | 'workflows'
  | 'integrations'
  | 'actions'
  | 'desktop';

export type RightPaneIntegrationsState = Partial<
  Pick<IntegrationGalleryFilters, 'query' | 'category' | 'semanticCategory'>
>;

/**
 * What the right pane is showing. `secondary`/`splitRatio` remain on the
 * persisted shape for backwards-compatible hydration of older layouts,
 * but the assistants surface renders a single pane (the rail owns
 * navigation, so a redundant in-pane split was retired).
 */
export interface RightPaneState {
  primary: { tab: RightPaneTab; integrations?: RightPaneIntegrationsState };
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
  requestAckHistories?: Record<string, RequestSentAck[]>;
  userEmail: string | null | undefined;
  isFirstView?: boolean;
  preHireChat?: ChatMessage[];
  onFirstViewCompleted?: () => void;
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
  infoPanel: AssistantInfoPanelLayoutContext;
  /**
   * Coordinator-only handler bag. This container only uses the live
   * completion callback while Tasks / Actions / Integrations are mounted;
   * the shared side panel renders the checklist itself.
   */
  coordinatorOnboarding?: AssistantInfoPanelCoordinatorOnboarding;
  /**
   * Renderer for the docked call surface (the
   * ``AssistantCommunicationDialog`` in ``docked`` mode). Threaded
   * straight through to ``ChatWithInfoPanel`` which stacks it above
   * the chat panel; passed by ``Main`` only when a call is active for
   * *this* assistant and hasn't been popped out.
   */
  renderDockedCall?: () => React.ReactNode;
  /** Onboarding-only: show typing while the scripted chat opener is in flight. */
  forceCoordinatorChatIntroTyping?: boolean;
  /** True while a Brain section overlay hides the workspace pane (Actions SSE stays live). */
  workspacePaneObscured?: boolean;
  /** False when the assistants surface is hidden behind settings/admin routes. */
  isActiveSurface?: boolean;
  /** Reports root-level Actions SSE activity that arrived while Actions was inactive. */
  onActionsUnreadActivityChange?: (hasUnread: boolean) => void;
  /** Opens the Computer Use enable/disable manager from the Desktop upgrade state. */
  onOpenComputerUseManager?: (assistant: Assistant) => void;
}

/**
 * Hosts the assistant's right-pane bodies (Chat / Actions / Dashboards /
 * Integrations / Tasks). The rail owns navigation and supplies the active
 * tab via `paneState.primary.tab`; each body force-mounts so per-tab
 * scroll/mount state survives switching. The shared `/assistants`
 * side-panel layout owns the profile/onboarding panel outside this tab host.
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
  requestAckHistories,
  userEmail,
  isFirstView = false,
  preHireChat,
  onFirstViewCompleted,
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
  infoPanel,
  coordinatorOnboarding,
  renderDockedCall,
  forceCoordinatorChatIntroTyping = false,
  workspacePaneObscured = false,
  isActiveSurface = true,
  onActionsUnreadActivityChange,
  onOpenComputerUseManager,
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

  const activeTab = paneState.primary.tab;
  const isActionsPaneVisible = activeTab === 'actions' && !workspacePaneObscured;

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
          requestAckHistories={requestAckHistories}
          userEmail={userEmail}
          userTimezone={userTimezone}
          isFirstView={isFirstView}
          preHireChat={preHireChat}
          onFirstViewCompleted={onFirstViewCompleted}
          spendingGate={spendingGate}
          chatStreamConnectionStatus={chatStreamConnectionStatus}
          reconnectChatStream={reconnectChatStream}
          chatStreamActivitySignal={chatStreamActivitySignal}
          activeCallAssistantId={activeCallAssistantId}
          isCallConnected={isCallConnected}
          isConnectingCall={isConnectingCall}
          draftSeed={infoPanel.draftSeed}
          onStartAudioCall={infoPanel.startAudioCall}
          isCallButtonDisabled={infoPanel.isCallButtonDisabled}
          callButtonTooltip={infoPanel.callButtonTooltip}
          renderDockedCall={renderDockedCall}
          forceCoordinatorChatIntroTyping={forceCoordinatorChatIntroTyping}
        />
      </TabsContent>

      <TabsContent value="tasks" className={TAB_CONTENT_CLASS} forceMount>
        <TasksPane
          assistant={assistant}
          ownerId={assistant.userId}
          assistantId={assistant.agentId}
          isVisible={activeTab === 'tasks'}
          isActiveSurface={isActiveSurface}
        />
      </TabsContent>

      <TabsContent value="canvas" className={TAB_CONTENT_CLASS} forceMount>
        <CanvasPane
          assistant={assistant}
          ownerId={assistant.userId}
          assistantId={assistant.agentId}
          isVisible={activeTab === 'canvas'}
          isActiveSurface={isActiveSurface}
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

      <TabsContent value="workflows" className={TAB_CONTENT_CLASS} forceMount>
        <WorkflowsPane
          assistant={assistant}
          ownerId={assistant.userId}
          assistantId={assistant.agentId}
          secretActions={assistantActions.secret}
          canWrite={canWrite}
          isVisible={activeTab === 'workflows'}
          isActiveSurface={isActiveSurface}
        />
      </TabsContent>

      <TabsContent value="integrations" className={TAB_CONTENT_CLASS} forceMount>
        <IntegrationsPane
          ownerId={assistant.userId}
          assistantId={assistant.agentId}
          secretActions={assistantActions.secret}
          canWrite={canWrite}
          isVisible={activeTab === 'integrations'}
          isActiveSurface={isActiveSurface}
          initialGalleryFilters={paneState.primary.integrations}
        />
      </TabsContent>

      <TabsContent value="desktop" className={TAB_CONTENT_CLASS} forceMount>
        <AssistantDesktopPane
          assistant={assistant}
          desktopActions={assistantActions.desktop}
          isVisible={activeTab === 'desktop'}
          isActiveSurface={isActiveSurface}
          canWrite={canWrite}
          onOpenComputerUseManager={onOpenComputerUseManager}
        />
      </TabsContent>

      <TabsContent value="actions" className={TAB_CONTENT_CLASS} forceMount>
        <LiveActionsViewer
          assistant={assistant}
          actions={actions}
          className="h-full"
          isPaneVisible={isActionsPaneVisible}
          onHasActiveActionChange={handleActiveActionChange}
          onUnreadLiveActivityChange={onActionsUnreadActivityChange}
        />
      </TabsContent>
    </Tabs>
  );
}
