'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Phone, Video, Search, Loader2, IdCard } from 'lucide-react';
import { AssistantProfileChatPanel } from '@/components/Pages/Assistants/Profile/AssistantProfileChatPanel';
import { AssistantInfoSidePanelContent } from '@/components/Pages/Assistants/Profile/AssistantInfoSidePanelContent';
import { ChatSidePanel } from './ChatSidePanel';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';
import type { ChatMessage, CallPill } from '@/types/assistants/chat';
import type { SpendingGateStatus } from '@/types/assistants/spendingGate';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';

/**
 * Chat tab body: hosts the conversation panel plus an inline assistant-info
 * side panel.
 *
 * The info panel is the *only* side surface here — actions live in their
 * own (split-able) right-pane tab now, and the page-level chat sub-header
 * keeps its call / video / info buttons regardless of split state. The
 * panel sits in the same flex row as the chat (not a modal sheet), so on
 * desktop the chat stays interactive beside it and on mobile the panel
 * claims the full row width.
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
  onStartCall: (assistant: Assistant, callType: 'video' | 'audio') => void;
  activeCallAssistantId: string | null;
  isCallConnected: boolean;
  isConnectingCall: boolean;
  isSpendingBlocked: boolean;
  spendingBlockedMessage?: string | null;

  // --- Assistant-contextual props for info side panel ---
  onEditProfile?: (assistant: Assistant) => void;
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
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
  onStartCall,
  activeCallAssistantId,
  isCallConnected,
  isConnectingCall,
  isSpendingBlocked,
  spendingBlockedMessage,
  onEditProfile,
  onOpenContactManager,
}: ChatWithInfoPanelProps) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);

  const toggleInfo = React.useCallback(() => setIsInfoOpen((prev) => !prev), []);
  const closeInfo = React.useCallback(() => setIsInfoOpen(false), []);

  // Auto-open the info panel the first time we land on a freshly hired
  // assistant — gives the user an immediate look at the contact details /
  // supervisor / job title we just provisioned. Tracked per assistantId
  // so dismissing it doesn't re-open on the next render, and switching
  // to another newly-hired assistant still triggers it.
  const autoOpenedForRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (isFirstView && assistant.agentId && autoOpenedForRef.current !== assistant.agentId) {
      autoOpenedForRef.current = assistant.agentId;
      setIsInfoOpen(true);
    }
  }, [isFirstView, assistant.agentId]);

  const isInThisCall = activeCallAssistantId === assistant.agentId;
  const isAnotherCallActive = activeCallAssistantId !== null && !isInThisCall;
  const isCallButtonDisabled = isAnotherCallActive || (isSpendingBlocked && !isInThisCall);

  const callButtonTooltip = (type: 'audio' | 'video') =>
    isInThisCall && isConnectingCall
      ? 'Connecting call...'
      : isInThisCall
        ? 'Return to call'
        : isSpendingBlocked && !isInThisCall
          ? spendingBlockedMessage || 'Spending limit reached'
          : isAnotherCallActive
            ? 'Another call is in progress'
            : type === 'audio'
              ? 'Start audio call'
              : 'Start video call';

  return (
    <div className="flex h-full w-full flex-col">
      {/* Sub-header: chat search + call buttons + info toggle.
          `py-2` (rather than `py-1.5`) is load-bearing in split mode —
          it matches the LiveActionsHeader's vertical padding so that
          when Chat is in one slot and Actions in the other, the bottom
          border of each pane's sub-header lands on the same Y. */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            readOnly
            className="h-7 w-full cursor-text rounded-md border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder={`Search chat with ${assistant.firstName}…`}
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
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={isInfoOpen ? 'primary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={toggleInfo}
                  data-testid="assistant-info-button"
                  aria-label="Assistant info"
                  aria-pressed={isInfoOpen}
                >
                  <IdCard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Assistant info</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Middle area: chat panel + optional contained info side panel.
          Same flex-row pattern we use elsewhere — desktop puts the panel
          beside chat (chat shrinks but stays interactive); mobile lets
          the panel claim the full width and the chat is hidden so the
          textarea doesn't peek through. */}
      <div className="flex min-h-0 flex-1">
        <div className={cn('flex min-w-0 flex-1 flex-col', isInfoOpen && 'hidden sm:flex')}>
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
          />
        </div>

        {isInfoOpen && (
          <ChatSidePanel
            ariaLabel="Assistant info"
            onClose={closeInfo}
            testId="assistant-info-sheet"
          >
            <AssistantInfoSidePanelContent
              assistant={assistant}
              onEditProfile={onEditProfile}
              onOpenContactManager={onOpenContactManager}
            />
          </ChatSidePanel>
        )}
      </div>
    </div>
  );
}
