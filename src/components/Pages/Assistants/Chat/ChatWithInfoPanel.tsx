'use client';

import * as React from 'react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Phone, Search, Loader2, PanelRight } from 'lucide-react';
import { AssistantProfileChatPanel } from '@/components/Pages/Assistants/Profile/AssistantProfileChatPanel';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { ChatMessage, CallPill } from '@/types/assistants/chat';
import type { SpendingGateStatus } from '@/types/assistants/spendingGate';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import type { ChatDraftSeed } from '@/components/Pages/Assistants/Layout/AssistantInfoPanelLayout';

/**
 * Chat tab body: hosts the conversation panel and the chat-scoped toolbar.
 * The profile/onboarding panel is owned by the surrounding `/assistants`
 * layout so it can stay open while the user visits other rail sections.
 */
export interface ChatWithInfoPanelProps {
  assistant: Assistant;
  assistantActions: AssistantActions;

  // --- Chat props (passed through) ---
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories?: Record<string, CallPill[]>;
  setCallPillHistories?: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
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

  isInfoOpen: boolean;
  onToggleInfo: () => void;
  showOnboardingDot: boolean;
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
}

export function ChatWithInfoPanel({
  assistant,
  assistantActions,
  chatHistories,
  setChatHistories,
  callPillHistories,
  setCallPillHistories,
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
  isInfoOpen,
  onToggleInfo,
  showOnboardingDot,
  draftSeed,
  onStartAudioCall,
  isCallButtonDisabled,
  callButtonTooltip,
  renderDockedCall,
}: ChatWithInfoPanelProps) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const isInThisCall = activeCallAssistantId === assistant.agentId;

  const chatPanel = (
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
                        className="h-7 w-7"
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
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <Button
                        type="button"
                        variant={isInfoOpen ? 'primary' : 'ghost'}
                        size="icon"
                        className="h-7 w-7"
                        onClick={onToggleInfo}
                        data-testid="assistant-info-button"
                        aria-label={isInfoOpen ? 'Hide profile' : 'Show profile'}
                        aria-pressed={isInfoOpen}
                      >
                        <PanelRight className="h-4 w-4" />
                      </Button>
                      {showOnboardingDot && (
                        <span
                          data-testid="assistant-info-button-onboarding-dot"
                          aria-hidden="true"
                          // Pinned to the corner of the trigger; ring uses the
                          // chat header's bg so the dot reads as a notch on
                          // the icon rather than floating in space.
                          className="pointer-events-none absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background"
                        />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{isInfoOpen ? 'Hide profile' : 'Show profile'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {renderDockedCall ? (
              <>
                <div className="min-h-0 flex-1 border-b" data-testid="assistant-call-docked-region">
                  {renderDockedCall()}
                </div>
                <div className="min-h-0 flex-1" data-testid="assistant-chat-during-call-region">
                  {chatPanel}
                </div>
              </>
            ) : (
              chatPanel
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
