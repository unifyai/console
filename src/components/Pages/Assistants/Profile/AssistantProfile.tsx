import * as React from 'react';
import { Button } from '@/components/UI/button';
import { Loader2, Phone, Video, Search } from 'lucide-react';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

import { ChatMessage, CallPill } from '@/types/assistants/chat';
import { AssistantProfileChatPanel } from './AssistantProfileChatPanel';
import { SpendingGateStatus, DEFAULT_SPENDING_GATE_STATUS } from '@/types/assistants/spendingGate';

interface AssistantProfilePanelProps {
  assistant: Assistant;
  assistantActions: AssistantActions;
  onClose: () => void;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories?: Record<string, CallPill[]>;
  setCallPillHistories?: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  userEmail: string | null | undefined;
  isFirstView?: boolean;
  preHireChat?: ChatMessage[];
  onFirstViewCompleted?: () => void;
  onStartCall: (assistant: Assistant, callType: 'video' | 'audio') => void;
  activeCallAssistantId: string | null;
  isCallConnected: boolean;
  isConnectingCall: boolean;
  userTimezone?: string | null;
  /** Whether the current user can edit this assistant */
  canWrite?: boolean;
  /** Spending gate status for blocking billable activity */
  spendingGate?: SpendingGateStatus;
  onAssistantReply?: (assistantId: string) => void;
}

export function AssistantProfilePanel({
  assistant,
  assistantActions,
  onClose,
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
}: AssistantProfilePanelProps) {
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

  const [searchOpen, setSearchOpen] = React.useState(false);

  if (!assistant) return null;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Header with assistant name and call buttons */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-body text-strong truncate">
          {assistant.firstName} {assistant.surname}
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

      {/* Chat panel takes full remaining height */}
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
  );
}
