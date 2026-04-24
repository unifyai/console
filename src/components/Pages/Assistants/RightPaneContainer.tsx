'use client';

import React, { useState, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/UI/tabs';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Columns2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveActionsViewer } from './LiveActions';
import { DashboardsPane } from './Dashboards';
import { MemoryPane } from './Memory';
import { TasksPane } from './Tasks';
import { SecretsPane } from './Secrets';
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

const TAB_TRIGGER_CLASS = [
  'h-full shrink-0 whitespace-nowrap rounded-none border-b-2 border-transparent bg-transparent',
  'px-1 text-xs font-medium text-muted-foreground',
  'shadow-none transition-colors hover:text-foreground',
  'data-[state=active]:border-primary data-[state=active]:bg-transparent',
  'data-[state=active]:text-foreground data-[state=active]:shadow-none',
].join(' ');

/**
 * Right-pane tab identifiers. Kept as a string-literal union so the split
 * state and persistence layer can stay typed end-to-end.
 */
export type RightPaneTab = 'chat' | 'tasks' | 'dashboards' | 'memory' | 'secrets' | 'actions';

export const RIGHT_PANE_TABS: ReadonlyArray<{ id: RightPaneTab; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'dashboards', label: 'Dashboards' },
  { id: 'memory', label: 'Memory' },
  { id: 'secrets', label: 'Secrets' },
  { id: 'actions', label: 'Actions' },
];

/**
 * Two-slot layout describing what the right pane is showing. `secondary`
 * is `null` when the pane is in single-view mode; `splitRatio` (0–1) is
 * the fraction of the pane width occupied by the primary slot when split.
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

const SPLIT_MIN_RATIO = 0.2;
const SPLIT_MAX_RATIO = 0.8;

/**
 * Picks a sensible default for the secondary slot when the user clicks
 * "split" — Actions is the most common partner to Chat (their original
 * pre-tabs side-by-side layout); for any other primary we default to
 * Chat so the user keeps the conversation visible while inspecting.
 */
function getDefaultSecondaryTab(primary: RightPaneTab): RightPaneTab {
  return primary === 'chat' ? 'actions' : 'chat';
}

interface RightPaneContainerProps {
  assistant: Assistant | null;
  actions: AssistantActionActions | null;
  dashboardActions: {
    getMetadata: (ownerId: string, assistantId: string) => Promise<DashboardPaneData>;
    getTileContent: (
      ownerId: string,
      assistantId: string,
      tileToken: string
    ) => Promise<string | null>;
  } | null;
  assistantActions: AssistantActions;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories: Record<string, CallPill[]>;
  setCallPillHistories: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  userEmail: string | null | undefined;
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
   * Two-slot pane state, lifted so `Main` can observe which tab(s) the
   * user is actually looking at (drives unread-badge suppression for the
   * Chat slot whether it lives in primary or secondary).
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
  /** Open the local-install instructions dialog (used by the setup roadmap). */
  onShowInstallInstructions?: (assistant: Assistant) => void;
  /** Open the logged-in user's account settings page. Optional `tab`
   *  mirrors the /account `?tab=` query param so callers can deep-link
   *  to a specific section (e.g. `'contact-info'`). */
  onOpenUserSettings?: (tab?: string) => void;
  /** True iff this assistant has outstanding setup work — drives the
   *  dot on the chat header's "Assistant info" button. */
  hasIncompleteOnboarding?: boolean;
}

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
  onShowInstallInstructions,
  onOpenUserSettings,
  hasIncompleteOnboarding,
}: RightPaneContainerProps) {
  // Tracks whether the live-actions stream is currently working, so the
  // dashboards pane can poll its tiles. Hoisted here because either pane
  // (or both, if split shows actions twice) feeds it; the actions tab
  // body owns the actual subscription.
  const [hasActiveAction, setHasActiveAction] = useState(false);
  const handleActiveActionChange = useCallback((active: boolean) => {
    setHasActiveAction(active);
  }, []);

  // --- Splitter resize ---
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [isResizingSplit, setIsResizingSplit] = React.useState(false);

  const handleSplitResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setIsResizingSplit(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: MouseEvent) => {
        const ratio = (ev.clientX - rect.left) / rect.width;
        const clamped = Math.min(SPLIT_MAX_RATIO, Math.max(SPLIT_MIN_RATIO, ratio));
        onPaneStateChange({ ...paneState, splitRatio: clamped });
      };
      const onUp = () => {
        setIsResizingSplit(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [onPaneStateChange, paneState]
  );

  if (!assistant) {
    return (
      <LiveActionsViewer
        assistant={null}
        actions={null}
        className="h-full"
        onHasActiveActionChange={handleActiveActionChange}
      />
    );
  }

  const isInThisCall = activeCallAssistantId === assistant.agentId;
  const isSpendingBlocked = spendingGate.isBlocked && !isInThisCall;

  // Each slot renders its own tab strip + force-mounted bodies via
  // `renderPane`; this keeps the per-slot scroll / mount state stable
  // when the user switches tabs within a slot, without leaking state
  // across slots.
  const renderPane = (
    slot: 'primary' | 'secondary',
    tab: RightPaneTab,
    options: { canSplit: boolean; canClose: boolean }
  ) => {
    const { canSplit, canClose } = options;

    const onTabChange = (next: string) => {
      const nextTab = next as RightPaneTab;
      if (slot === 'primary') {
        onPaneStateChange({ ...paneState, primary: { tab: nextTab } });
      } else {
        onPaneStateChange({ ...paneState, secondary: { tab: nextTab } });
      }
    };

    const handleSplit = () =>
      onPaneStateChange({
        ...paneState,
        secondary: { tab: getDefaultSecondaryTab(paneState.primary.tab) },
      });

    // Closing the *primary* slot in split mode promotes the secondary
    // into the primary position, so the user keeps whichever pane they
    // wanted to focus on. Closing the *secondary* simply drops it.
    const handleClose = () => {
      if (slot === 'primary' && paneState.secondary) {
        onPaneStateChange({
          ...paneState,
          primary: paneState.secondary,
          secondary: null,
        });
      } else {
        onPaneStateChange({ ...paneState, secondary: null });
      }
    };

    return (
      <Tabs
        value={tab}
        onValueChange={onTabChange}
        className="flex h-full min-w-0 flex-1 flex-col"
        data-slot={slot}
      >
        <div
          // Identical chrome on both slots so the bottom border reads as
          // one continuous line across the splitter. The vertical splitter
          // (rendered below) is what tells the two panes apart visually.
          //
          // `items-end` is load-bearing: the active TabsTrigger draws a
          // 2px primary underline that needs to sit flush with this row's
          // 1px bottom border for the "active tab continues the line"
          // effect. `items-center` would float the underline mid-row.
          className="flex shrink-0 items-end justify-between gap-2 border-b border-border px-3 py-2"
        >
          <div className="flex min-w-0 flex-1 items-end overflow-x-auto">
            <TabsList className="h-7 flex-nowrap gap-6 rounded-none bg-transparent p-0">
              {RIGHT_PANE_TABS.map(({ id, label }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className={TAB_TRIGGER_CLASS}
                  // Primary slot keeps the legacy `right-pane-tab-{id}` id
                  // so existing e2e selectors (and the demo) keep working;
                  // the secondary slot uses an explicit prefix so tests
                  // can target a specific pane when split.
                  data-testid={
                    slot === 'primary' ? `right-pane-tab-${id}` : `right-pane-secondary-tab-${id}`
                  }
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canSplit && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="hidden h-6 w-6 sm:inline-flex"
                      onClick={handleSplit}
                      data-testid="right-pane-split-button"
                      aria-label="Split pane"
                    >
                      <Columns2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Open another tab side by side</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {canClose && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleClose}
                      data-testid={`right-pane-close-${slot}`}
                      aria-label={slot === 'primary' ? 'Close left pane' : 'Close right pane'}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>
                      {slot === 'primary'
                        ? 'Close this pane (right pane stays)'
                        : 'Close this pane (left pane stays)'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <TabsContent
          value="chat"
          className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          forceMount
        >
          <ChatWithInfoPanel
            assistant={assistant}
            assistantActions={assistantActions}
            chatHistories={chatHistories}
            setChatHistories={setChatHistories}
            callPillHistories={callPillHistories}
            setCallPillHistories={setCallPillHistories}
            userEmail={userEmail}
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
            onShowInstallInstructions={onShowInstallInstructions}
            onOpenUserSettings={onOpenUserSettings}
            hasIncompleteOnboarding={hasIncompleteOnboarding}
          />
        </TabsContent>

        <TabsContent
          value="tasks"
          className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          forceMount
        >
          <TasksPane ownerId={assistant.userId} assistantId={assistant.agentId} />
        </TabsContent>

        <TabsContent
          value="dashboards"
          className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          forceMount
        >
          {dashboardActions ? (
            <DashboardsPane
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

        <TabsContent
          value="memory"
          className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          forceMount
        >
          <MemoryPane ownerId={assistant.userId} assistantId={assistant.agentId} />
        </TabsContent>

        <TabsContent
          value="secrets"
          className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          forceMount
        >
          <SecretsPane
            ownerId={assistant.userId}
            assistantId={assistant.agentId}
            secretActions={assistantActions.secret}
            canWrite={canWrite}
          />
        </TabsContent>

        <TabsContent
          value="actions"
          className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          forceMount
        >
          {/* Only the *primary* actions tab feeds the dashboards-poll
              signal. Wiring both would double-count benign no-ops, and
              the two slots' streams are equivalent (same controller
              shape, same data) so picking one is enough. */}
          <LiveActionsViewer
            assistant={assistant}
            actions={actions}
            className="h-full"
            onHasActiveActionChange={slot === 'primary' ? handleActiveActionChange : undefined}
          />
        </TabsContent>
      </Tabs>
    );
  };

  const hasSplit = paneState.secondary !== null;
  const splitRatio = Math.min(SPLIT_MAX_RATIO, Math.max(SPLIT_MIN_RATIO, paneState.splitRatio));

  return (
    <div ref={splitContainerRef} className="flex h-full w-full">
      <div
        className="flex h-full min-w-0 flex-col"
        style={{ width: hasSplit ? `${splitRatio * 100}%` : '100%' }}
      >
        {renderPane('primary', paneState.primary.tab, {
          // Split button only appears when not already split.
          canSplit: !hasSplit,
          // Either pane is closable when split — closing the primary
          // promotes the secondary into the primary slot (handled in
          // `handleClose`).
          canClose: hasSplit,
        })}
      </div>

      {hasSplit && paneState.secondary && (
        <>
          {/* Splitter handle — 6px wide hit area with a 1px visible
              line drawn dead-center via a `before:` pseudo-element.
              This keeps the divider visually balanced between the two
              panes (instead of hugging the left edge as a `border-l`
              would) and decouples the line's color from the wider
              hover/active accent that paints the whole strip. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize split"
            onMouseDown={handleSplitResizeStart}
            className={cn(
              'relative h-full w-1.5 flex-shrink-0 cursor-col-resize bg-transparent transition-colors duration-200',
              'before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border before:content-[""]',
              'hover:bg-primary/20 active:bg-primary/40',
              isResizingSplit && 'bg-primary/40'
            )}
            data-testid="right-pane-splitter"
            style={{ zIndex: 20 }}
          />
          <div
            className="flex h-full min-w-0 flex-col"
            style={{ width: `${(1 - splitRatio) * 100}%` }}
          >
            {renderPane('secondary', paneState.secondary.tab, {
              canSplit: false,
              canClose: true,
            })}
          </div>
        </>
      )}
    </div>
  );
}
