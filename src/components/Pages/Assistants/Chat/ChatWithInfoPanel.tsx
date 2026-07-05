'use client';

import * as React from 'react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Phone, Search, Loader2 } from 'lucide-react';
import { AssistantProfileChatPanel } from '@/components/Pages/Assistants/Profile/AssistantProfileChatPanel';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { ChatMessage, CallPill, RequestSentAck } from '@/types/assistants/chat';
import type { SpendingGateStatus } from '@/types/assistants/spendingGate';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import { tabToolbarIconButtonClass } from '@/components/Pages/Assistants/Common/TabToolbar';
import type { ChatDraftSeed } from '@/components/Pages/Assistants/Layout/AssistantInfoPanelLayout';
import { useMatchesBelow } from '@/hooks/Common/useMobile';
import { cn } from '@/lib/utils';

/**
 * Chat tab body: hosts the conversation panel and the chat-scoped toolbar.
 * The profile/onboarding panel is owned by the surrounding `/assistants`
 * layout and toggled from the top navbar.
 */
export interface ChatWithInfoPanelProps {
  assistant: Assistant;
  assistantActions: AssistantActions;

  // --- Chat props (passed through) ---
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories?: Record<string, CallPill[]>;
  setCallPillHistories?: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  requestAckHistories?: Record<string, RequestSentAck[]>;
  userEmail: string | null | undefined;
  userTimezone?: string | null;
  isFirstView?: boolean;
  preHireChat?: ChatMessage[];
  onFirstViewCompleted?: () => void;
  spendingGate?: SpendingGateStatus;
  chatStreamConnectionStatus: ChatStreamConnectionStatus;
  reconnectChatStream: () => void;
  chatStreamActivitySignal: number;

  // --- Call props ---
  activeCallAssistantId: string | null;
  isCallConnected: boolean;
  isConnectingCall: boolean;

  draftSeed: ChatDraftSeed | null;
  onStartAudioCall: () => void;
  isCallButtonDisabled: boolean;
  callButtonTooltip: string;
  /**
   * When a call with *this* assistant is active and not popped out,
   * the parent supplies a renderer for the docked
   * ``AssistantCommunicationDialog`` (in ``docked`` mode). The call
   * is stacked above the chat so the text channel stays available
   * during the conversation.
   */
  renderDockedCall?: () => React.ReactNode;
  /** Onboarding-only: show typing while the scripted chat opener is in flight. */
  forceCoordinatorChatIntroTyping?: boolean;
}

export function ChatWithInfoPanel({
  assistant,
  assistantActions,
  chatHistories,
  setChatHistories,
  callPillHistories,
  setCallPillHistories,
  requestAckHistories,
  userEmail,
  userTimezone,
  isFirstView,
  preHireChat,
  onFirstViewCompleted,
  spendingGate,
  chatStreamConnectionStatus,
  reconnectChatStream,
  chatStreamActivitySignal,
  activeCallAssistantId,
  isCallConnected,
  isConnectingCall,
  draftSeed,
  onStartAudioCall,
  isCallButtonDisabled,
  callButtonTooltip,
  renderDockedCall,
  forceCoordinatorChatIntroTyping = false,
}: ChatWithInfoPanelProps) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const isInThisCall = activeCallAssistantId === assistant.agentId;
  const isBelowCompact = useMatchesBelow('compact');

  const chatPanel = (
    <AssistantProfileChatPanel
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
      isCallConnected={isInThisCall && isCallConnected}
      searchOpen={searchOpen}
      onSearchOpenChange={setSearchOpen}
      draftSeed={draftSeed}
      onAssistantAvatarStartCall={onStartAudioCall}
      isAssistantAvatarStartCallDisabled={isCallButtonDisabled}
      assistantAvatarStartCallTooltip={callButtonTooltip}
      forceTypingIndicator={forceCoordinatorChatIntroTyping}
    />
  );

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                readOnly
                className="h-7 w-full cursor-text rounded-md border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder={tabSearchPlaceholder('chat')}
                onFocus={(e) => {
                  e.currentTarget.blur();
                  setSearchOpen(true);
                }}
                onClick={() => setSearchOpen(true)}
                data-testid="chat-search-trigger"
                aria-label="Search conversation"
              />
            </div>
            <div className="flex items-center gap-0.5">
              {/* The call button stays visible even when voice calls aren't configured
              on the deployment — they're disabled with an explanatory tooltip
              instead of hidden. The span wrapper is load-bearing: a disabled
              Button has `pointer-events-none`, so the tooltip has to trigger
              off the span rather than the button. */}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={tabToolbarIconButtonClass}
                        onClick={onStartAudioCall}
                        disabled={isCallButtonDisabled}
                        data-testid="call-audio-button"
                      >
                        {isInThisCall && isConnectingCall ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Phone className="h-4 w-4" />
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{callButtonTooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Keep the chat panel at a stable tree position so its composer
                state survives hanging up (mount/unmount would reset inputValue). */}
            <div
              className={cn(
                'flex-col border-b',
                renderDockedCall
                  ? isBelowCompact
                    ? 'flex min-h-[40vh] shrink-0'
                    : 'flex min-h-0 flex-1'
                  : 'hidden'
              )}
              data-testid="assistant-call-docked-region"
              aria-hidden={!renderDockedCall}
            >
              {renderDockedCall?.()}
            </div>
            <div
              className="flex min-h-0 flex-1 flex-col"
              data-testid="assistant-chat-during-call-region"
            >
              {chatPanel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
