'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Phone, Search, Loader2, PanelRight } from 'lucide-react';
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
// Info-panel open/closed persistence
// ---------------------------------------------------------------------------

/**
 * The info side panel's open/closed state is a single global preference
 * shared across every assistant, so toggling it for one assistant carries
 * over when switching to another. We persist one boolean rather than a
 * per-assistant set: the panel defaults *open* (no stored value → open) so
 * a brand-new assistant — including the moment right after hiring — shows
 * the panel without any extra bookkeeping.
 *
 * Two cases deliberately override this global preference at switch time
 * without mutating it: mobile always starts closed (the panel would cover
 * the chat), and the Coordinator's onboarding panel starts closed (it is
 * request-driven). See the init effect below.
 *
 * Stored under a stable key so it survives reloads and propagates across
 * tabs on the next mount.
 */
const INFO_PANEL_OPEN_KEY = 'console:assistants:info-panel-open';
const INFO_PANEL_WIDTH_KEY = 'console:assistants:info-panel-width';
const INFO_PANEL_DEFAULT_WIDTH = 360;
const INFO_PANEL_MIN_WIDTH = 320;
const INFO_PANEL_MIN_CHAT_WIDTH = 320;
const MOBILE_INFO_PANEL_MEDIA_QUERY = '(max-width: 639px)';

function clampInfoPanelWidth(width: number, maxWidth = Number.POSITIVE_INFINITY): number {
  return Math.min(maxWidth, Math.max(INFO_PANEL_MIN_WIDTH, Math.round(width)));
}

function isMobileInfoPanelViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_INFO_PANEL_MEDIA_QUERY).matches;
}

function readInfoPanelOpen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(INFO_PANEL_OPEN_KEY);
    // Absent value → never toggled → default open.
    return raw === null ? true : raw !== 'false';
  } catch {
    return true;
  }
}

function writeInfoPanelOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INFO_PANEL_OPEN_KEY, open ? 'true' : 'false');
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
 * Chat tab body: hosts the conversation panel plus an inline profile
 * side panel, with a toolbar (search + call + profile toggle) directly
 * beneath the section header.
 *
 * The profile panel sits in the same flex row as the chat (not a modal
 * sheet), so on desktop the chat stays interactive beside it and on
 * mobile the panel claims the full row width.
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
   * One-shot request id for the onboarding-focused chat/info shape:
   * the assistant info panel opens and grows to its maximum width inside
   * the chat row.
   */
  infoPanelFocusLayoutRequest?: number;
  /**
   * Coordinator-only handler bag forwarded to the info panel so the
   * "Onboarding" sub-tab on the coordinator's info panel can wire
   * its action rows. Ignored entirely for non-coordinator
   * assistants. See ``AssistantInfoSidePanelContent`` for details.
   */
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
  infoPanelFocusLayoutRequest = 0,
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

  // The open/closed choice is a single global preference persisted in
  // localStorage, so an explicit toggle from the header button (or the
  // panel's close affordance) sticks across reloads, tabs, and — most
  // importantly — switching between assistants.
  const setIsInfoOpenAndPersist = React.useCallback((next: boolean) => {
    setIsInfoOpen(next);
    writeInfoPanelOpen(next);
  }, []);
  const toggleInfo = React.useCallback(
    () => setIsInfoOpenAndPersist(!isInfoOpen),
    [isInfoOpen, setIsInfoOpenAndPersist]
  );
  const closeInfo = React.useCallback(
    () => setIsInfoOpenAndPersist(false),
    [setIsInfoOpenAndPersist]
  );

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

  const seededInfoFocusLayoutRequestRef = React.useRef(0);

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
    if (isMobileInfoPanelViewport()) {
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

  // Seed the panel from the global open/closed preference. Switching
  // between assistants re-runs this against the same shared preference,
  // so the open/closed choice carries over from one assistant to the
  // next (rather than being remembered per-assistant).
  //
  // Two cases sidestep the global preference without mutating it:
  //   - Mobile: the panel claims the full viewport width (the chat is
  //     hidden behind it), so opening by default would hide the chat
  //     the user came to use. We always start closed and let the user
  //     toggle in explicitly; the global preference is left untouched so
  //     resizing back to desktop restores it.
  //   - The Coordinator's onboarding focus layout (fresh reload / intro
  //     completion) is request-driven: while a request is pending we
  //     defer to the focus effect below, which opens and maximizes the
  //     panel. Ordinary switches to the Coordinator fall through to the
  //     shared preference like any other assistant.
  const initializedForRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!assistant.agentId) return;
    if (initializedForRef.current === assistant.agentId) return;
    initializedForRef.current = assistant.agentId;

    // A pending onboarding focus-layout request (fresh reload / intro
    // completion) owns opening *and* maximizing the panel; defer to that
    // effect instead of seeding from the global preference here. This is
    // the one path that biases the Coordinator's panel open regardless of
    // the shared preference.
    const isCoordinatorOnboardingPanel =
      assistant.isCoordinator === true && hasIncompleteOnboarding;
    const hasPendingInfoFocusLayoutRequest =
      infoPanelFocusLayoutRequest > 0 &&
      seededInfoFocusLayoutRequestRef.current !== infoPanelFocusLayoutRequest;
    if (isCoordinatorOnboardingPanel && hasPendingInfoFocusLayoutRequest) return;

    // Mobile always starts closed: the panel claims the full viewport
    // width there (covering the chat the user came to use). The global
    // preference is left untouched so resizing back to desktop restores
    // it. The breakpoint matches the Tailwind `sm` boundary used by the
    // layout below (`hidden sm:flex`).
    if (isMobileInfoPanelViewport()) {
      setIsInfoOpen(false);
      return;
    }

    // Everything else — including the Coordinator on an ordinary switch —
    // mirrors the single global open/closed preference (which defaults
    // open), so an explicit toggle carries across assistants.
    setIsInfoOpen(readInfoPanelOpen());
  }, [
    assistant.agentId,
    assistant.isCoordinator,
    hasIncompleteOnboarding,
    infoPanelFocusLayoutRequest,
  ]);

  React.useLayoutEffect(() => {
    if (infoPanelFocusLayoutRequest <= 0) return;
    if (assistant.isCoordinator !== true || !hasIncompleteOnboarding) return;
    if (seededInfoFocusLayoutRequestRef.current === infoPanelFocusLayoutRequest) return;

    // On mobile the focus layout would cover the docked call/chat surface,
    // so we consume the request without auto-opening the panel.
    if (isMobileInfoPanelViewport()) {
      seededInfoFocusLayoutRequestRef.current = infoPanelFocusLayoutRequest;
      setIsInfoOpen(false);
      return;
    }

    // Open transiently for the onboarding focus layout at the default
    // inspector width — the chat stays the dominant column beside it (per
    // the redesign, the profile is a fixed-width side panel, not a takeover).
    // We deliberately don't persist here: this is a request-driven override
    // of the global preference, not the user choosing to open the panel, so
    // it must not flip the shared open/closed state for every other assistant.
    setIsInfoOpen(true);
    setInfoPanelWidthWithinBounds(INFO_PANEL_DEFAULT_WIDTH);
    seededInfoFocusLayoutRequestRef.current = infoPanelFocusLayoutRequest;
  }, [
    assistant.isCoordinator,
    hasIncompleteOnboarding,
    infoPanelFocusLayoutRequest,
    setInfoPanelWidthWithinBounds,
  ]);

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
              : 'Call';

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
      {/* Chat pane + optional contained info side panel. The chat-scoped toolbar
          (search + call + profile toggle) lives inside the chat column so the
          search spans to the call icon and the controls sit at the chat/profile
          boundary rather than over the profile panel. */}
      <div ref={infoPanelContainerRef} className="flex min-h-0 flex-1">
        <div className={cn('flex min-w-0 flex-1 flex-col', isInfoOpen && 'hidden sm:flex')}>
          <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
            <div className="relative flex-1">
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
