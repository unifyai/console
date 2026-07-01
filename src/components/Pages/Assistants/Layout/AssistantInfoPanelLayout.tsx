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
  ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT,
  publishAssistantInfoPanelVisibility,
  type AssistantInfoPanelToggleRequestDetail,
} from '@/lib/assistants/infoPanelVisibility';
import type { Assistant } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';

const INFO_PANEL_OPEN_KEY = 'console:assistants:info-panel-open';
const INFO_PANEL_WIDTH_KEY = 'console:assistants:info-panel-width';
const INFO_PANEL_DEFAULT_WIDTH = 360;
const INFO_PANEL_MIN_WIDTH = 320;
const INFO_PANEL_MIN_MAIN_WIDTH = 320;
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
  isInfoOpen: boolean;
  toggleInfo: () => void;
  showOnboardingDot: boolean;
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
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  hasUserMessage?: boolean;
  hasHistoricalCall?: boolean;
  hasUserPhoneNumber?: boolean;
  latestUserMessageAt?: Date | null;
  onOpenUserSettings?: (tab?: string) => void;
  hasIncompleteOnboarding?: boolean;
  infoPanelFocusLayoutRequest?: number;
  coordinatorOnboarding?: AssistantInfoPanelCoordinatorOnboarding;
  onOpenChatSection?: () => void;
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
  onOpenContactManager,
  hasUserMessage = false,
  hasHistoricalCall = false,
  hasUserPhoneNumber = false,
  latestUserMessageAt = null,
  onOpenUserSettings,
  hasIncompleteOnboarding = false,
  infoPanelFocusLayoutRequest = 0,
  coordinatorOnboarding,
  onOpenChatSection,
}: AssistantInfoPanelLayoutProps) {
  const { voiceCalls } = useFeatures();
  const { canOpenAssistantChat } = useAssistantPermissions();
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);
  const infoPanelContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [infoPanelWidth, setInfoPanelWidth] = React.useState(INFO_PANEL_DEFAULT_WIDTH);
  const [isResizingInfoPanel, setIsResizingInfoPanel] = React.useState(false);
  const [draftSeed, setDraftSeed] = React.useState<ChatDraftSeed | null>(null);
  const draftNonceRef = React.useRef(0);
  const seededInfoFocusLayoutRequestRef = React.useRef(0);
  const initializedForRef = React.useRef<string | null>(null);

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

    window.addEventListener(ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT, onToggleRequest);
    return () => {
      window.removeEventListener(ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT, onToggleRequest);
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

    setIsInfoOpen(readInfoPanelOpen());
  }, [
    assistant?.agentId,
    assistant?.isCoordinator,
    hasIncompleteOnboarding,
    infoPanelFocusLayoutRequest,
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

  React.useEffect(() => {
    if (!assistant?.agentId) return;
    publishAssistantInfoPanelVisibility({
      assistantId: assistant.agentId,
      isOpen: isInfoOpen,
      isCoordinatorOnboarding: assistant.isCoordinator === true && hasIncompleteOnboarding,
    });
  }, [assistant?.agentId, assistant?.isCoordinator, hasIncompleteOnboarding, isInfoOpen]);

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

  const showOnboardingDot = hasIncompleteOnboarding && !!onOpenUserSettings;

  const context = React.useMemo<AssistantInfoPanelLayoutContext>(
    () => ({
      isInfoOpen,
      toggleInfo,
      showOnboardingDot,
      draftSeed,
      startAudioCall,
      isCallButtonDisabled,
      callButtonTooltip,
    }),
    [
      callButtonTooltip,
      draftSeed,
      isCallButtonDisabled,
      isInfoOpen,
      showOnboardingDot,
      startAudioCall,
      toggleInfo,
    ]
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
          isInfoOpen: false,
          toggleInfo: noop,
          showOnboardingDot: false,
          draftSeed,
          startAudioCall: noop,
          isCallButtonDisabled: true,
          callButtonTooltip: 'Unavailable',
        }
  );

  if (!assistant || !canOpenAssistantChat(assistant)) {
    return <div className="flex h-full min-h-0 w-full">{mainContent}</div>;
  }

  return (
    <div ref={infoPanelContainerRef} className="flex h-full min-h-0 w-full">
      <div className={cn('flex min-w-0 flex-1 flex-col', isInfoOpen && 'hidden sm:flex')}>
        {mainContent}
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
            onClose={closeInfo}
            onOpenContactManager={onOpenContactManager}
            roadmap={roadmap}
            canWrite={canWrite}
            coordinatorOnboarding={coordinatorOnboarding}
            onStartCall={onStartCall}
            isStartCallDisabled={isCallButtonDisabled}
            startCallTooltip={callButtonTooltip}
          />
        </ChatSidePanel>
      )}
    </div>
  );
}
