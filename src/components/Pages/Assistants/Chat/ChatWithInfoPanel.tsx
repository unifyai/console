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
import { useCoordinatorActivity } from '@/hooks/Assistants/useCoordinatorActivity';
import type { CoordinatorActivityRow } from '@/types/assistants/coordinatorActivity';

// ---------------------------------------------------------------------------
// Per-assistant info-panel dismissal persistence
// ---------------------------------------------------------------------------

/**
 * Default the info side panel *open* for any assistant the user
 * hasn't explicitly closed it for. We persist the set of dismissed
 * agentIds rather than the set of opened ones so the default for a
 * brand-new assistant — including the moment right after hiring —
 * is "open" without any extra bookkeeping (no entry in the set →
 * not dismissed → open).
 *
 * Stored as a JSON array under a stable key so it survives reloads
 * and (because of the underlying `storage` event) propagates across
 * tabs viewing the same assistant.
 */
const INFO_PANEL_DISMISSED_KEY = 'console:assistants:info-panel-dismissed';

function readInfoPanelDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(INFO_PANEL_DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((x): x is string => typeof x === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function writeInfoPanelDismissed(set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INFO_PANEL_DISMISSED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* quota / privacy mode — silently degrade to in-memory only */
  }
}

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
  onCoordinatorActivity?: (activity: CoordinatorActivityRow) => void;
  /** Drives the visibility of every edit affordance the info side
   *  panel surfaces (profile pencil, Contact Info "Edit" button,
   *  per-channel "Add …" CTAs). Defaults to `true`. */
  canWrite?: boolean;
  /**
   * Setup-roadmap wiring. When `onShowInstallInstructions` is
   * provided, the info panel surfaces an Onboarding tab with the
   * post-hire checklist. The other props feed step-completion
   * detection (hasUserMessage / hasHistoricalCall / phone-on-profile
   * / latest-msg timestamp) and chat-prefill text personalisation.
   */
  hasUserMessage?: boolean;
  hasHistoricalCall?: boolean;
  hasUserPhoneNumber?: boolean;
  latestUserMessageAt?: Date | null;
  userPhoneNumber?: string | null;
  onShowInstallInstructions?: (assistant: Assistant) => void;
  /** Open the logged-in user's account settings (e.g. /account).
   *  Optional `tab` deep-links into a specific account-page section
   *  (e.g. `'contact-info'` for the phone-on-profile roadmap step). */
  onOpenUserSettings?: (tab?: string) => void;
  /**
   * Owner-side hint that the assistant still has outstanding setup
   * work in the Onboarding tab. Surfaced as a tiny accent dot on the
   * "Assistant info" button so the user notices the panel needs
   * attention without us having to auto-pop it on every visit.
   *
   * Computed at the page level (single source of truth across all
   * assistants), and ignored entirely when `onShowInstallInstructions`
   * isn't provided — i.e. for non-owners who can't see the panel.
   */
  hasIncompleteOnboarding?: boolean;
  /**
   * Coordinator-only handler bag forwarded to the info panel so the
   * "Onboarding" sub-tab on the coordinator's info panel can wire
   * its action rows. Ignored entirely for non-coordinator
   * assistants. See ``AssistantInfoSidePanelContent`` for details.
   */
  coordinatorOnboarding?: {
    onConnectWorkspace?: () => void;
    onConnectApps?: () => void;
    onAssignTask?: () => void;
    onWatchAndGuide?: () => void;
    onHireSpecialist?: () => void;
  };
  /**
   * When a call with *this* assistant is active and not popped out,
   * the parent supplies a renderer for the docked
   * ``AssistantCommunicationDialog`` (in ``docked`` mode). We swap
   * it in for the chat panel while leaving the chat sub-header and
   * the assistant-info side panel untouched, so the user can still
   * toggle the info panel and the layout doesn't reflow around the
   * call.
   *
   * Undefined means "render the regular chat" — either no call is
   * active for this assistant, or the user popped the call out and
   * the page-level modal/floating dialog is showing it instead.
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
  onStartCall,
  activeCallAssistantId,
  isCallConnected,
  isConnectingCall,
  isSpendingBlocked,
  spendingBlockedMessage,
  onEditProfile,
  onOpenContactManager,
  onCoordinatorActivity,
  canWrite = true,
  hasUserMessage = false,
  hasHistoricalCall = false,
  hasUserPhoneNumber = false,
  latestUserMessageAt = null,
  userPhoneNumber,
  onShowInstallInstructions,
  onOpenUserSettings,
  hasIncompleteOnboarding = false,
  coordinatorOnboarding,
  renderDockedCall,
}: ChatWithInfoPanelProps) {
  // The dot is only meaningful when the panel actually exposes the
  // Onboarding tab — for non-owners (who don't get the tab) we
  // wouldn't want a hint pointing at a panel that has nothing to act
  // on. The same prop pair also gates the roadmap memo below, so this
  // check keeps both surfaces in lockstep.
  const showOnboardingDot =
    hasIncompleteOnboarding && !!onShowInstallInstructions && !!onOpenUserSettings;
  const coordinatorActivity = useCoordinatorActivity({
    assistant,
    enabled: assistant.isCoordinator === true,
    onActivity: onCoordinatorActivity,
  });
  const [searchOpen, setSearchOpen] = React.useState(false);
  // Default-closed; the assistant-id init effect below flips it open
  // for any assistant the user hasn't explicitly dismissed the panel
  // for. Starting closed avoids a one-frame flash for assistants we
  // know are dismissed.
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);

  // Track per-assistant dismissal across the session and across tabs.
  // The set lives in localStorage so closing the panel for assistant
  // X stays closed on the next visit, while a brand-new assistant
  // (never dismissed) auto-opens. Any explicit toggle from the
  // header button mutates this set so the choice sticks.
  const setIsInfoOpenAndPersist = React.useCallback(
    (next: boolean) => {
      setIsInfoOpen(next);
      if (typeof window === 'undefined' || !assistant.agentId) return;
      try {
        const dismissed = readInfoPanelDismissed();
        if (next) dismissed.delete(assistant.agentId);
        else dismissed.add(assistant.agentId);
        writeInfoPanelDismissed(dismissed);
      } catch {
        /* localStorage unavailable; in-memory state still works */
      }
    },
    [assistant.agentId]
  );
  const toggleInfo = React.useCallback(
    () => setIsInfoOpenAndPersist(!isInfoOpen),
    [isInfoOpen, setIsInfoOpenAndPersist]
  );
  const closeInfo = React.useCallback(
    () => setIsInfoOpenAndPersist(false),
    [setIsInfoOpenAndPersist]
  );

  // Draft seed plumbing for the roadmap "Say hi" step. We push a
  // `{ text, nonce }` object into the chat panel; bumping the nonce
  // is what triggers the panel's effect to overwrite `inputValue`,
  // so re-applying the same suggestion still works (and we don't
  // permanently bind the input value to an external prop).
  const [draftSeed, setDraftSeed] = React.useState<{ text: string; nonce: number } | null>(null);
  const draftNonceRef = React.useRef(0);
  const seedChatDraft = React.useCallback((text: string) => {
    draftNonceRef.current += 1;
    setDraftSeed({ text, nonce: draftNonceRef.current });
    // Close the info panel on mobile so the chat is unobstructed when
    // we focus its composer. On desktop the panel sits beside the chat
    // (not over it), so we leave it open.
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) {
      setIsInfoOpen(false);
    }
  }, []);

  const roadmap = React.useMemo(
    () =>
      onShowInstallInstructions && onOpenUserSettings
        ? {
            hasUserMessage,
            hasHistoricalCall,
            hasUserPhoneNumber,
            latestUserMessageAt,
            userEmail,
            userPhoneNumber,
            onStartCall,
            onShowInstallInstructions,
            onOpenUserSettings,
            onSeedChatDraft: seedChatDraft,
          }
        : undefined,
    [
      hasUserMessage,
      hasHistoricalCall,
      hasUserPhoneNumber,
      latestUserMessageAt,
      userEmail,
      userPhoneNumber,
      onStartCall,
      onShowInstallInstructions,
      onOpenUserSettings,
      seedChatDraft,
    ]
  );

  // Default the info panel open for any assistant the user hasn't
  // explicitly dismissed it for (tracked per agentId in localStorage).
  // This subsumes the previous "first view after hiring" auto-open —
  // a freshly hired assistant has no entry in the dismissed set, so
  // it still opens by default — but also surfaces the panel on
  // subsequent visits to assistants the user has never closed it for.
  //
  // Mobile is the exception: the panel claims the full viewport
  // width there (the chat is hidden behind it), so opening by default
  // would hide the chat the user came to use. On mobile we always
  // start closed and let the user toggle in explicitly. We don't
  // touch the dismissed set in that case so resizing back to desktop
  // restores the user's persisted choice.
  //
  // Switching between assistants re-evaluates against the dismissed
  // set, so each assistant remembers its own state without any one
  // assistant's dismissal leaking across the list.
  const initializedForRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!assistant.agentId) return;
    if (initializedForRef.current === assistant.agentId) return;
    initializedForRef.current = assistant.agentId;
    if (typeof window === 'undefined') {
      setIsInfoOpen(true);
      return;
    }
    // Mobile breakpoint matches the Tailwind `sm` boundary used by
    // the layout below (`hidden sm:flex`) so the auto-open rule and
    // the responsive layout agree on what counts as "mobile".
    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    if (isMobile) {
      setIsInfoOpen(false);
      return;
    }
    const dismissed = readInfoPanelDismissed();
    setIsInfoOpen(!dismissed.has(assistant.agentId));
  }, [assistant.agentId]);

  const isInThisCall = activeCallAssistantId === assistant.agentId;
  const isAnotherCallActive = activeCallAssistantId !== null && !isInThisCall;
  // Disable the call buttons whenever ANY call is active —
  // same-assistant in another slot (the docked call lives in the
  // primary slot only, see ``RightPaneContainer``) or a different
  // assistant entirely. The compose path is unreachable in both
  // cases, and leaving the buttons enabled implied "click to do
  // something" when there was nothing to do.
  const isCallButtonDisabled =
    isAnotherCallActive || isInThisCall || (isSpendingBlocked && !isInThisCall);

  const callButtonTooltip = (type: 'audio' | 'video') =>
    isInThisCall && isConnectingCall
      ? 'Connecting call...'
      : isInThisCall
        ? 'Call in progress'
        : isSpendingBlocked && !isInThisCall
          ? spendingBlockedMessage || 'Spending limit reached'
          : isAnotherCallActive
            ? 'Another call is in progress'
            : type === 'audio'
              ? 'Start audio call'
              : 'Start video call';

  const isDockedCall = !!renderDockedCall;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Sub-header: chat search + call buttons + info toggle.
          `py-2` (rather than `py-1.5`) is load-bearing in split mode —
          it matches the LiveActionsHeader's vertical padding so that
          when Chat is in one slot and Actions in the other, the bottom
          border of each pane's sub-header lands on the same Y.
          Suppressed while a call is docked into this slot — the call
          surface owns its own header (with the popout / hangup
          controls) and the call's bottom toolbar replaces the
          composer, so the sub-header would just stack redundant
          chrome above it. The user can still toggle the assistant
          info panel by popping the call out first. */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 border-b px-3 py-2',
          isDockedCall && 'hidden'
        )}
      >
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
                <div className="relative">
                  <Button
                    type="button"
                    variant={isInfoOpen ? 'primary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={toggleInfo}
                    data-testid="assistant-info-button"
                    aria-label={
                      showOnboardingDot ? 'Assistant info — setup incomplete' : 'Assistant info'
                    }
                    aria-pressed={isInfoOpen}
                  >
                    <IdCard className="h-4 w-4" />
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
                <p>{showOnboardingDot ? 'Assistant info — setup incomplete' : 'Assistant info'}</p>
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
          {renderDockedCall ? (
            renderDockedCall()
          ) : (
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
            />
          )}
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
              roadmap={roadmap}
              onSeedChatDraft={seedChatDraft}
              canWrite={canWrite}
              onCoordinatorActivity={onCoordinatorActivity}
              coordinatorActivity={coordinatorActivity}
              coordinatorOnboarding={coordinatorOnboarding}
            />
          </ChatSidePanel>
        )}
      </div>
    </div>
  );
}
