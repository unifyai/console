'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
import { ChatSidePanel } from '@/components/Pages/Assistants/Chat/ChatSidePanel';
import {
  AssistantInfoSidePanelContent,
  type AssistantInfoSidePanelContentProps,
} from '@/components/Pages/Assistants/Profile/AssistantInfoSidePanelContent';
import {
  ASSISTANT_INFO_PANEL_OPEN_REQUEST_EVENT,
  ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT,
  consumePendingInfoPanelOpen,
  publishAssistantInfoPanelVisibility,
  type AssistantInfoPanelOpenRequestDetail,
  type AssistantInfoPanelToggleRequestDetail,
} from '@/lib/assistants/infoPanelVisibility';
import type { Assistant } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';
import { matchesBelowBreakpoint } from '@/constants/breakpoints';
import { useMatchesBelow } from '@/hooks/Common/useMobile';
import { Sheet, SheetContent } from '@/components/UI/sheet';
import { Button } from '@/components/UI/button';
import { Pencil, X } from 'lucide-react';

const INFO_PANEL_OPEN_KEY = 'console:assistants:info-panel-open';
const INFO_PANEL_WIDTH_KEY = 'console:assistants:info-panel-width';
const INFO_PANEL_DEFAULT_WIDTH = 360;
const INFO_PANEL_MIN_WIDTH = 280;
const INFO_PANEL_MIN_MAIN_WIDTH = 280;

function clampInfoPanelWidth(width: number, maxWidth = Number.POSITIVE_INFINITY): number {
  return Math.min(maxWidth, Math.max(INFO_PANEL_MIN_WIDTH, Math.round(width)));
}

function isMobileInfoPanelViewport(): boolean {
  return matchesBelowBreakpoint('mobile');
}

function readInfoPanelOpen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(INFO_PANEL_OPEN_KEY);
    return raw === null ? true : raw !== 'false';
  } catch {
    return true;
  }
}

/** Coordinator onboarding panel starts closed until the user opens it explicitly. */
function readCoordinatorOnboardingInfoPanelOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(INFO_PANEL_OPEN_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

function writeInfoPanelOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INFO_PANEL_OPEN_KEY, open ? 'true' : 'false');
  } catch {
    /* best-effort persistence */
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
    /* width persistence is optional */
  }
}

export interface ChatDraftSeed {
  text: string;
  nonce: number;
}

export type AssistantInfoPanelCoordinatorOnboarding = NonNullable<
  AssistantInfoSidePanelContentProps['coordinatorOnboarding']
> & {
  onStepComplete?: (stepId: string) => void;
};

export interface AssistantInfoPanelLayoutContext {
  draftSeed: ChatDraftSeed | null;
  startAudioCall: () => void;
  isCallButtonDisabled: boolean;
  callButtonTooltip: string;
}

interface AssistantInfoPanelLayoutProps {
  assistant: Assistant | null;
  children: (context: AssistantInfoPanelLayoutContext) => React.ReactNode;
  currentUserId?: string | null;
  userEmail?: string | null;
  userPhoneNumber?: string | null;
  onStartCall: (assistant: Assistant, callType: 'video' | 'audio') => void;
  activeCallAssistantId: string | null;
  isConnectingCall: boolean;
  canWrite?: boolean;
  isSpendingBlocked?: boolean;
  spendingBlockedMessage?: string | null;
  onEditProfile?: (assistant: Assistant) => void;
  /** True while the profile edit dialog is opening for this assistant. */
  isEditProfileOpening?: boolean;
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  onOpenWorkspaceManager?: (assistant: Assistant) => void;
  onOpenBrainManager?: (assistant: Assistant) => void;
  onConnectDesktop?: (assistant: Assistant) => void;
  onOpenComputerUseManager?: (assistant: Assistant) => void;
  hasUserMessage?: boolean;
  hasHistoricalCall?: boolean;
  hasUserPhoneNumber?: boolean;
  latestUserMessageAt?: Date | null;
  onOpenUserSettings?: (tab?: string) => void;
  hasIncompleteOnboarding?: boolean;
  /** True while the Coordinator's onboarding state read is still in flight. */
  isOnboardingStatusPending?: boolean;
  infoPanelFocusLayoutRequest?: number;
  coordinatorOnboarding?: AssistantInfoPanelCoordinatorOnboarding;
  onOpenChatSection?: () => void;
  /** False when the assistants surface is hidden behind settings/admin routes. */
  isActiveSurface?: boolean;
}

const noop = () => {};

export function AssistantInfoPanelLayout({
  assistant,
  children,
  currentUserId,
  userEmail,
  userPhoneNumber,
  onStartCall,
  activeCallAssistantId,
  isConnectingCall,
  canWrite = true,
  isSpendingBlocked = false,
  spendingBlockedMessage,
  onEditProfile,
  isEditProfileOpening = false,
  onOpenContactManager,
  onOpenWorkspaceManager,
  onOpenBrainManager,
  onConnectDesktop,
  onOpenComputerUseManager,
  hasUserMessage = false,
  hasHistoricalCall = false,
  hasUserPhoneNumber = false,
  latestUserMessageAt = null,
  onOpenUserSettings,
  hasIncompleteOnboarding = false,
  isOnboardingStatusPending = false,
  infoPanelFocusLayoutRequest = 0,
  coordinatorOnboarding,
  onOpenChatSection,
  isActiveSurface = true,
}: AssistantInfoPanelLayoutProps) {
  const { voiceCalls } = useFeatures();
  const { canOpenAssistantChat } = useAssistantPermissions();
  const isBelowShellCompact = useMatchesBelow('shellCompact');
  const useOverlayInfoPanel = isBelowShellCompact || !isActiveSurface;
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);
  const infoPanelContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [infoPanelWidth, setInfoPanelWidth] = React.useState(INFO_PANEL_DEFAULT_WIDTH);
  const [isResizingInfoPanel, setIsResizingInfoPanel] = React.useState(false);
  const [draftSeed, setDraftSeed] = React.useState<ChatDraftSeed | null>(null);
  const draftNonceRef = React.useRef(0);
  const seededInfoFocusLayoutRequestRef = React.useRef(0);
  const initializedForRef = React.useRef<string | null>(null);
  const focusProfileTabRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    setInfoPanelWidth(readInfoPanelWidth());
  }, []);

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

  const getInfoPanelMaxWidth = React.useCallback(() => {
    const container = infoPanelContainerRef.current;
    if (!container) return Number.POSITIVE_INFINITY;
    const { width } = container.getBoundingClientRect();
    return Math.max(INFO_PANEL_MIN_WIDTH, width - INFO_PANEL_MIN_MAIN_WIDTH);
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
    const assistantId = assistant?.agentId;
    if (!assistantId) return;
    const onToggleRequest = (event: Event) => {
      const detail = (event as CustomEvent<AssistantInfoPanelToggleRequestDetail>).detail;
      if (detail.assistantId !== assistantId) return;
      event.preventDefault();
      setIsInfoOpenAndPersist(!isInfoOpen);
    };
    const onOpenRequest = (event: Event) => {
      const detail = (event as CustomEvent<AssistantInfoPanelOpenRequestDetail>).detail;
      if (detail.assistantId !== assistantId) return;
      setIsInfoOpenAndPersist(true);
    };

    window.addEventListener(ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT, onToggleRequest);
    window.addEventListener(ASSISTANT_INFO_PANEL_OPEN_REQUEST_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener(ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT, onToggleRequest);
      window.removeEventListener(ASSISTANT_INFO_PANEL_OPEN_REQUEST_EVENT, onOpenRequest);
    };
  }, [assistant?.agentId, isInfoOpen, setIsInfoOpenAndPersist]);

  const seedChatDraft = React.useCallback(
    (text: string) => {
      draftNonceRef.current += 1;
      setDraftSeed({ text, nonce: draftNonceRef.current });
      onOpenChatSection?.();
      if (isMobileInfoPanelViewport()) {
        setIsInfoOpen(false);
      }
    },
    [onOpenChatSection]
  );

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

  React.useEffect(() => {
    if (!assistant?.agentId) return;
    if (initializedForRef.current === assistant.agentId) return;
    // The Coordinator's default is the opposite of every other assistant's, and
    // this runs once per assistant. Settling before the onboarding state read
    // lands would pick the generic default and never revisit it.
    if (assistant.isCoordinator === true && isOnboardingStatusPending) return;
    initializedForRef.current = assistant.agentId;

    const isCoordinatorOnboardingPanel =
      assistant.isCoordinator === true && hasIncompleteOnboarding;
    const hasPendingInfoFocusLayoutRequest =
      infoPanelFocusLayoutRequest > 0 &&
      seededInfoFocusLayoutRequestRef.current !== infoPanelFocusLayoutRequest;
    if (isCoordinatorOnboardingPanel && hasPendingInfoFocusLayoutRequest) return;

    if (isMobileInfoPanelViewport()) {
      setIsInfoOpen(false);
      return;
    }

    if (consumePendingInfoPanelOpen(assistant.agentId)) {
      setIsInfoOpenAndPersist(true);
      return;
    }

    if (isCoordinatorOnboardingPanel) {
      setIsInfoOpen(readCoordinatorOnboardingInfoPanelOpen());
      return;
    }

    setIsInfoOpen(readInfoPanelOpen());
  }, [
    assistant?.agentId,
    assistant?.isCoordinator,
    hasIncompleteOnboarding,
    isOnboardingStatusPending,
    infoPanelFocusLayoutRequest,
    setIsInfoOpenAndPersist,
  ]);

  React.useLayoutEffect(() => {
    if (!assistant) return;
    if (infoPanelFocusLayoutRequest === 0) return;
    if (assistant.isCoordinator !== true || !hasIncompleteOnboarding) return;
    if (seededInfoFocusLayoutRequestRef.current === infoPanelFocusLayoutRequest) return;

    seededInfoFocusLayoutRequestRef.current = infoPanelFocusLayoutRequest;

    if (infoPanelFocusLayoutRequest < 0) {
      setIsInfoOpenAndPersist(false);
      return;
    }

    setIsInfoOpenAndPersist(true);
    setInfoPanelWidthWithinBounds(INFO_PANEL_DEFAULT_WIDTH);
  }, [
    assistant,
    hasIncompleteOnboarding,
    infoPanelFocusLayoutRequest,
    setIsInfoOpenAndPersist,
    setInfoPanelWidthWithinBounds,
  ]);

  const showOnboardingDot = hasIncompleteOnboarding && !!onOpenUserSettings;

  React.useEffect(() => {
    if (!assistant?.agentId) return;
    publishAssistantInfoPanelVisibility({
      assistantId: assistant.agentId,
      isOpen: isInfoOpen,
      isCoordinatorOnboarding: assistant.isCoordinator === true && hasIncompleteOnboarding,
      showOnboardingDot,
    });
  }, [
    assistant?.agentId,
    assistant?.isCoordinator,
    hasIncompleteOnboarding,
    isInfoOpen,
    showOnboardingDot,
  ]);

  const isInThisCall = !!assistant && activeCallAssistantId === assistant.agentId;
  const isAnotherCallActive = activeCallAssistantId !== null && !isInThisCall;
  const isCallButtonDisabled =
    !assistant || !voiceCalls || isAnotherCallActive || isInThisCall || isSpendingBlocked;
  const callButtonTooltip = !voiceCalls
    ? "Voice calls aren't enabled on this deployment"
    : isInThisCall && isConnectingCall
      ? 'Connecting call...'
      : isInThisCall
        ? 'Call in progress'
        : isSpendingBlocked
          ? spendingBlockedMessage || 'Spending limit reached'
          : isAnotherCallActive
            ? 'Another call is in progress'
            : 'Call';
  const startAudioCall = React.useCallback(() => {
    if (!assistant) return;
    onStartCall(assistant, 'audio');
  }, [assistant, onStartCall]);

  const context = React.useMemo<AssistantInfoPanelLayoutContext>(
    () => ({
      draftSeed,
      startAudioCall,
      isCallButtonDisabled,
      callButtonTooltip,
    }),
    [callButtonTooltip, draftSeed, isCallButtonDisabled, startAudioCall]
  );

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
      const maxWidth = Math.max(INFO_PANEL_MIN_WIDTH, rect.width - INFO_PANEL_MIN_MAIN_WIDTH);
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

  const infoPanelStyle = React.useMemo<React.CSSProperties>(
    () => ({ ['--chat-side-panel-width']: `${infoPanelWidth}px` }) as React.CSSProperties,
    [infoPanelWidth]
  );

  const mainContent = children(
    assistant && canOpenAssistantChat(assistant)
      ? context
      : {
          draftSeed,
          startAudioCall: noop,
          isCallButtonDisabled: true,
          callButtonTooltip: 'Unavailable',
        }
  );

  if (!assistant || !canOpenAssistantChat(assistant)) {
    return <div className="flex h-full min-h-0 w-full">{mainContent}</div>;
  }

  const infoPanelBody = (
    <AssistantInfoSidePanelContent
      assistant={assistant}
      currentUserId={currentUserId}
      onClose={closeInfo}
      onEditProfile={onEditProfile}
      isEditProfileOpening={isEditProfileOpening}
      onOpenContactManager={onOpenContactManager}
      onOpenWorkspaceManager={onOpenWorkspaceManager}
      onOpenBrainManager={onOpenBrainManager}
      onConnectDesktop={onConnectDesktop}
      onOpenComputerUseManager={onOpenComputerUseManager}
      roadmap={roadmap}
      canWrite={canWrite}
      coordinatorOnboarding={coordinatorOnboarding}
      onStartCall={onStartCall}
      isStartCallDisabled={isCallButtonDisabled}
      startCallTooltip={callButtonTooltip}
      hideHeaderActions={useOverlayInfoPanel}
      onRegisterFocusProfileTab={(focusProfileTab) => {
        focusProfileTabRef.current = focusProfileTab;
      }}
    />
  );

  return (
    <div ref={infoPanelContainerRef} className="flex h-full min-h-0 w-full min-w-0">
      <div className="flex min-w-0 flex-1 flex-col">{mainContent}</div>

      {useOverlayInfoPanel ? (
        <Sheet
          open={isInfoOpen}
          onOpenChange={(open) => {
            if (!open) closeInfo();
          }}
        >
          <SheetContent
            side="right"
            className="flex w-full max-w-[min(100vw,28rem)] flex-col overflow-hidden p-0 sm:max-w-md [&>button.absolute]:hidden"
            data-testid="assistant-info-sheet"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-2 py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={closeInfo}
                aria-label="Close profile"
                data-testid="assistant-info-close"
              >
                <X className="h-4 w-4" />
              </Button>
              {canWrite ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => focusProfileTabRef.current?.()}
                  aria-label="Edit"
                  data-testid="assistant-info-edit-profile"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : (
                <span className="h-8 w-8 shrink-0" aria-hidden="true" />
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{infoPanelBody}</div>
          </SheetContent>
        </Sheet>
      ) : (
        isInfoOpen && (
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
                'hover:bg-primary-tint-20 focus-visible:bg-primary-tint-20 focus-visible:outline-none active:bg-primary-tint-40',
                isResizingInfoPanel && 'bg-primary-tint-40'
              )}
              data-testid="assistant-info-panel-resize-handle"
            />
            {infoPanelBody}
          </ChatSidePanel>
        )
      )}
    </div>
  );
}
