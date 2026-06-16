'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Phone, Search, Loader2, IdCard } from 'lucide-react';
import { AssistantProfileChatPanel } from '@/components/Pages/Assistants/Profile/AssistantProfileChatPanel';
import { AssistantInfoSidePanelContent } from '@/components/Pages/Assistants/Profile/AssistantInfoSidePanelContent';
import { ChatSidePanel } from './ChatSidePanel';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';
import type { ChatMessage, CallPill } from '@/types/assistants/chat';
import type { SpendingGateStatus } from '@/types/assistants/spendingGate';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';

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
const INFO_PANEL_WIDTH_KEY = 'console:assistants:info-panel-width';
const INFO_PANEL_DEFAULT_WIDTH = 380;
const INFO_PANEL_MIN_WIDTH = 320;
const INFO_PANEL_MIN_CHAT_WIDTH = 320;

function clampInfoPanelWidth(width: number, maxWidth = Number.POSITIVE_INFINITY): number {
  return Math.min(maxWidth, Math.max(INFO_PANEL_MIN_WIDTH, Math.round(width)));
}

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

function readInfoPanelWidth(): number {
  if (typeof window === 'undefined') return INFO_PANEL_DEFAULT_WIDTH;
  try {
    const raw = window.localStorage.getItem(INFO_PANEL_WIDTH_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? clampInfoPanelWidth(parsed) : INFO_PANEL_DEFAULT_WIDTH;
  } catch {
    return INFO_PANEL_DEFAULT_WIDTH;
  }
}

function writeInfoPanelWidth(width: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INFO_PANEL_WIDTH_KEY, String(clampInfoPanelWidth(width)));
  } catch {
    /* quota / privacy mode — width persistence is optional */
  }
}

/**
 * Chat tab body: hosts the conversation panel plus an inline assistant-info
 * side panel.
 *
 * The info panel is the *only* side surface here — actions live in their
 * own (split-able) right-pane tab now, and the page-level chat sub-header
 * keeps its call / info buttons regardless of split state. The
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
  currentUserId?: string | null;
  /** Drives the visibility of every edit affordance the info side
   *  panel surfaces (profile pencil, Contact Info "Edit" button,
   *  per-channel "Add …" CTAs). Defaults to `true`. */
  canWrite?: boolean;
  /**
   * Setup-roadmap wiring. When `onOpenUserSettings` is provided, the
   * info panel surfaces an Onboarding tab with the post-hire checklist.
   * The other props feed step-completion detection (hasUserMessage /
   * hasHistoricalCall / phone-on-profile / latest-msg timestamp) and
   * chat-prefill text personalisation.
   */
  hasUserMessage?: boolean;
  hasHistoricalCall?: boolean;
  hasUserPhoneNumber?: boolean;
  latestUserMessageAt?: Date | null;
  userPhoneNumber?: string | null;
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
   * assistants), and ignored entirely when `onOpenUserSettings`
   * isn't provided — i.e. for non-owners who can't see the panel.
   */
  hasIncompleteOnboarding?: boolean;
  /**
   * Forces the chat/info split into its most onboarding-focused shape:
   * the assistant info panel stays open and grows to its maximum
   * width inside the chat row.
   */
  forceInfoPanelFocusLayout?: boolean;
  /**
   * Coordinator-only handler bag forwarded to the info panel so the
   * "Onboarding" sub-tab on the coordinator's info panel can wire
   * its action rows. Ignored entirely for non-coordinator
   * assistants. See ``AssistantInfoSidePanelContent`` for details.
   */
  coordinatorOnboarding?: {
    onConnectWorkspace?: () => void;
    onConnectApps?: () => void;
    onActNow?: () => void;
    onScheduleTask?: () => void;
  };
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
  onStartCall,
  activeCallAssistantId,
  isCallConnected,
  isConnectingCall,
  isSpendingBlocked,
  spendingBlockedMessage,
  onEditProfile,
  onOpenContactManager,
  currentUserId,
  canWrite = true,
  hasUserMessage = false,
  hasHistoricalCall = false,
  hasUserPhoneNumber = false,
  latestUserMessageAt = null,
  userPhoneNumber,
  onOpenUserSettings,
  hasIncompleteOnboarding = false,
  forceInfoPanelFocusLayout = false,
  coordinatorOnboarding,
  renderDockedCall,
}: ChatWithInfoPanelProps) {
  // The dot is only meaningful when the panel actually exposes the
  // Onboarding tab — for non-owners (who don't get the tab) we
  // wouldn't want a hint pointing at a panel that has nothing to act
  // on. The same prop pair also gates the roadmap memo below, so this
  // check keeps both surfaces in lockstep.
  const showOnboardingDot = hasIncompleteOnboarding && !!onOpenUserSettings;
  const searchDisplayName = assistant.isCoordinator
    ? assistantDisplayName(assistant)
    : assistant.firstName || assistantDisplayName(assistant);
  const [searchOpen, setSearchOpen] = React.useState(false);
  // Default-closed; the assistant-id init effect below flips it open
  // for any assistant the user hasn't explicitly dismissed the panel
  // for. Starting closed avoids a one-frame flash for assistants we
  // know are dismissed.
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);
  const infoPanelContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [infoPanelWidth, setInfoPanelWidth] = React.useState(INFO_PANEL_DEFAULT_WIDTH);
  const [isResizingInfoPanel, setIsResizingInfoPanel] = React.useState(false);

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
  const toggleInfo = React.useCallback(() => {
    if (forceInfoPanelFocusLayout && isInfoOpen) return;
    setIsInfoOpenAndPersist(!isInfoOpen);
  }, [forceInfoPanelFocusLayout, isInfoOpen, setIsInfoOpenAndPersist]);
  const closeInfo = React.useCallback(() => {
    if (forceInfoPanelFocusLayout) return;
    setIsInfoOpenAndPersist(false);
  }, [forceInfoPanelFocusLayout, setIsInfoOpenAndPersist]);

  React.useEffect(() => {
    setInfoPanelWidth(readInfoPanelWidth());
  }, []);

  const getInfoPanelMaxWidth = React.useCallback(() => {
    const container = infoPanelContainerRef.current;
    if (!container) return Number.POSITIVE_INFINITY;
    const { width } = container.getBoundingClientRect();
    return Math.max(INFO_PANEL_MIN_WIDTH, width - INFO_PANEL_MIN_CHAT_WIDTH);
  }, []);

  const setInfoPanelWidthWithinBounds = React.useCallback(
    (width: number) => {
      const next = clampInfoPanelWidth(width, getInfoPanelMaxWidth());
      setInfoPanelWidth(next);
      writeInfoPanelWidth(next);
    },
    [getInfoPanelMaxWidth]
  );

  React.useEffect(() => {
    if (!forceInfoPanelFocusLayout) return;

    setIsInfoOpenAndPersist(true);

    const maximizeInfoPanel = () => {
      const maxWidth = getInfoPanelMaxWidth();
      if (!Number.isFinite(maxWidth)) return;
      setInfoPanelWidthWithinBounds(maxWidth);
    };

    maximizeInfoPanel();

    const container = infoPanelContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(maximizeInfoPanel);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [
    forceInfoPanelFocusLayout,
    getInfoPanelMaxWidth,
    setInfoPanelWidthWithinBounds,
    setIsInfoOpenAndPersist,
  ]);

  const handleInfoPanelResizeKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setInfoPanelWidthWithinBounds(infoPanelWidth + 24);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setInfoPanelWidthWithinBounds(infoPanelWidth - 24);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setInfoPanelWidthWithinBounds(INFO_PANEL_MIN_WIDTH);
      } else if (e.key === 'End') {
        e.preventDefault();
        setInfoPanelWidthWithinBounds(getInfoPanelMaxWidth());
      }
    },
    [getInfoPanelMaxWidth, infoPanelWidth, setInfoPanelWidthWithinBounds]
  );

  const handleInfoPanelResizeStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const container = infoPanelContainerRef.current;
      if (!container) return;

      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const maxWidth = Math.max(INFO_PANEL_MIN_WIDTH, rect.width - INFO_PANEL_MIN_CHAT_WIDTH);
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      let nextWidth = clampInfoPanelWidth(infoPanelWidth, maxWidth);

      setIsResizingInfoPanel(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        nextWidth = clampInfoPanelWidth(rect.right - ev.clientX, maxWidth);
        setInfoPanelWidth(nextWidth);
      };

      const onUp = () => {
        setIsResizingInfoPanel(false);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        writeInfoPanelWidth(nextWidth);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [infoPanelWidth]
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
      onOpenUserSettings
        ? {
            hasUserMessage,
            hasHistoricalCall,
            hasUserPhoneNumber,
            latestUserMessageAt,
            userEmail,
            userPhoneNumber,
            onStartCall,
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
      // The Coordinator's onboarding checklist lives in this card, and a
      // phone has no room for a side-by-side panel — so surface the card
      // full-width by default while onboarding is still outstanding,
      // mirroring the old onboarding layout's always-visible checklist.
      // Other assistants (and a finished Coordinator) keep chat-first.
      // A prior dismissal is still honoured so it doesn't fight the user.
      const dismissed = readInfoPanelDismissed();
      const surfaceCoordinatorOnboarding =
        assistant.isCoordinator === true &&
        hasIncompleteOnboarding &&
        !dismissed.has(assistant.agentId);
      setIsInfoOpen(surfaceCoordinatorOnboarding);
      return;
    }
    const dismissed = readInfoPanelDismissed();
    setIsInfoOpen(!dismissed.has(assistant.agentId));
  }, [assistant.agentId, assistant.isCoordinator, hasIncompleteOnboarding]);

  const { voiceCalls } = useFeatures();
  const isInThisCall = activeCallAssistantId === assistant.agentId;
  const isAnotherCallActive = activeCallAssistantId !== null && !isInThisCall;
  // Disable the call button whenever ANY call is active —
  // same-assistant in another slot (the docked call lives in the
  // primary slot only, see ``RightPaneContainer``) or a different
  // assistant entirely. The compose path is unreachable in both
  // cases, and leaving the buttons enabled implied "click to do
  // something" when there was nothing to do.
  const isCallButtonDisabled =
    !voiceCalls || isAnotherCallActive || isInThisCall || (isSpendingBlocked && !isInThisCall);

  const callButtonTooltip = () =>
    !voiceCalls
      ? "Voice calls aren't enabled on this deployment"
      : isInThisCall && isConnectingCall
        ? 'Connecting call...'
        : isInThisCall
          ? 'Call in progress'
          : isSpendingBlocked && !isInThisCall
            ? spendingBlockedMessage || 'Spending limit reached'
            : isAnotherCallActive
              ? 'Another call is in progress'
              : 'Start call';

  const startAudioCall = React.useCallback(() => {
    onStartCall(assistant, 'audio');
  }, [assistant, onStartCall]);

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
      onAssistantAvatarStartCall={startAudioCall}
      isAssistantAvatarStartCallDisabled={isCallButtonDisabled}
      assistantAvatarStartCallTooltip={callButtonTooltip()}
    />
  );
  const infoPanelStyle = React.useMemo<React.CSSProperties>(
    () => ({ ['--chat-side-panel-width']: `${infoPanelWidth}px` }) as React.CSSProperties,
    [infoPanelWidth]
  );

  return (
    <div className="flex h-full w-full flex-col">
      {/* Sub-header: chat search + call button + info toggle.
          `py-2` (rather than `py-1.5`) is load-bearing in split mode —
          it matches the LiveActionsHeader's vertical padding so that
          when Chat is in one slot and Actions in the other, the bottom
          border of each pane's sub-header lands on the same Y. */}
      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            readOnly
            className="h-7 w-full cursor-text rounded-md border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder={`Search chat with ${searchDisplayName}…`}
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
                    onClick={startAudioCall}
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
                <p>{callButtonTooltip()}</p>
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
      <div ref={infoPanelContainerRef} className="flex min-h-0 flex-1">
        <div className={cn('flex min-w-0 flex-1 flex-col', isInfoOpen && 'hidden sm:flex')}>
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

        {isInfoOpen && (
          <ChatSidePanel
            ariaLabel="Assistant info"
            onClose={closeInfo}
            style={infoPanelStyle}
            testId="assistant-info-sheet"
          >
            <div
              role="separator"
              aria-label="Resize assistant info panel"
              aria-orientation="vertical"
              aria-valuemin={INFO_PANEL_MIN_WIDTH}
              aria-valuenow={infoPanelWidth}
              tabIndex={0}
              onKeyDown={handleInfoPanelResizeKeyDown}
              onPointerDown={handleInfoPanelResizeStart}
              className={cn(
                'absolute inset-y-0 -left-1 z-20 hidden w-2 cursor-col-resize touch-none bg-transparent transition-colors duration-200 sm:block',
                'before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border before:content-[""]',
                'hover:bg-primary/20 focus-visible:bg-primary/20 active:bg-primary/40 focus-visible:outline-none',
                isResizingInfoPanel && 'bg-primary/40'
              )}
              data-testid="assistant-info-panel-resize-handle"
            />
            <AssistantInfoSidePanelContent
              assistant={assistant}
              currentUserId={currentUserId}
              onEditProfile={onEditProfile}
              onOpenContactManager={onOpenContactManager}
              roadmap={roadmap}
              canWrite={canWrite}
              coordinatorOnboarding={coordinatorOnboarding}
              onStartCall={onStartCall}
              isStartCallDisabled={isCallButtonDisabled}
              startCallTooltip={callButtonTooltip()}
            />
          </ChatSidePanel>
        )}
      </div>
    </div>
  );
}
