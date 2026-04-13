'use client';

import React, { useState, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/UI/tabs';
import { LiveActionsViewer } from './LiveActions';
import { DashboardsPane } from './Dashboards';
import { AssistantProfileChatPanel } from './Profile/AssistantProfileChatPanel';
import { MemoryPane } from './Memory';
import { Button } from '@/components/UI/button';
import { Loader2, Phone, Video, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import type { AssistantActionActions } from '@/types/assistants/action';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { DashboardPaneData } from '@/types/assistants/dashboard';
import type { ChatMessage, CallPill } from '@/types/assistants/chat';
import {
  type SpendingGateStatus,
  DEFAULT_SPENDING_GATE_STATUS,
} from '@/types/assistants/spendingGate';

const TAB_TRIGGER_CLASS = [
  'h-full rounded-none border-b-2 border-transparent bg-transparent',
  'px-1 text-xs font-medium text-muted-foreground',
  'shadow-none transition-colors hover:text-foreground',
  'data-[state=active]:border-primary data-[state=active]:bg-transparent',
  'data-[state=active]:text-foreground data-[state=active]:shadow-none',
].join(' ');

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
  onAssistantReply?: (assistantId: string) => void;
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
  onAssistantReply,
}: RightPaneContainerProps) {
  const [hasActiveAction, setHasActiveAction] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleActiveActionChange = useCallback((active: boolean) => {
    setHasActiveAction(active);
  }, []);

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
  const isAnotherCallActive = activeCallAssistantId !== null && !isInThisCall;
  const isSpendingBlocked = spendingGate.isBlocked && !isInThisCall;
  const isCallButtonDisabled = isAnotherCallActive || isSpendingBlocked;

  const callButtonTooltip = (type: 'audio' | 'video') =>
    isInThisCall && isConnectingCall
      ? 'Connecting call...'
      : isInThisCall
        ? 'Return to call'
        : isSpendingBlocked
          ? spendingGate.blockedMessage || 'Spending limit reached'
          : isAnotherCallActive
            ? 'Another call is in progress'
            : type === 'audio'
              ? 'Start audio call'
              : 'Start video call';

  return (
    <Tabs defaultValue="chat" className="flex h-full flex-col">
      <div className="flex shrink-0 items-end justify-center gap-6 border-b border-border px-4 py-2">
        <TabsList className="h-7 gap-6 rounded-none bg-transparent p-0">
          <TabsTrigger value="chat" className={TAB_TRIGGER_CLASS} data-testid="right-pane-tab-chat">
            Chat
          </TabsTrigger>
          <TabsTrigger
            value="actions"
            className={TAB_TRIGGER_CLASS}
            data-testid="right-pane-tab-actions"
          >
            Actions
          </TabsTrigger>
          <TabsTrigger
            value="dashboards"
            className={TAB_TRIGGER_CLASS}
            data-testid="right-pane-tab-dashboards"
          >
            Dashboards
          </TabsTrigger>
          <TabsTrigger
            value="memory"
            className={TAB_TRIGGER_CLASS}
            data-testid="right-pane-tab-memory"
          >
            Memory
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="chat"
        className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        forceMount
      >
        <div className="flex h-full w-full flex-col">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-body text-strong truncate">
              Chat with {assistant.firstName} {assistant.surname}
            </span>
            <div className="flex items-center gap-0.5">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setSearchOpen(true)}
                      data-testid="chat-search-trigger"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Search conversation</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onStartCall(assistant, 'audio')}
                      disabled={isCallButtonDisabled}
                      data-testid="call-audio-button"
                    >
                      {isInThisCall && isConnectingCall ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Phone className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{callButtonTooltip('audio')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onStartCall(assistant, 'video')}
                      disabled={isCallButtonDisabled}
                      data-testid="call-video-button"
                    >
                      <Video className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{callButtonTooltip('video')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            <AssistantProfileChatPanel
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
              onAssistantReply={onAssistantReply}
              isCallConnected={isInThisCall && isCallConnected}
              searchOpen={searchOpen}
              onSearchOpenChange={setSearchOpen}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent
        value="actions"
        className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        forceMount
      >
        <LiveActionsViewer
          assistant={assistant}
          actions={actions}
          className="h-full"
          onHasActiveActionChange={handleActiveActionChange}
        />
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
    </Tabs>
  );
}
