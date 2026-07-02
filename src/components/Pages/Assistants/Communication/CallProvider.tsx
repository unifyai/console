'use client';

import * as React from 'react';
import { LogLevel, Room, setLogLevel } from 'livekit-client';
import { RoomContext } from '@livekit/components-react';
import { useAssistantCall } from '@/hooks/Assistants/useAssistantCall';
import { useAppShellNavigation, useShellActivePath } from '@/lib/navigation/AppShellRouter';
import {
  AssistantCommunicationDialog,
  useIsCoordinatorIntroAudioPlaying,
} from './AssistantCommunicationDialog';
import { AssistantLiveKitAudioRenderer } from './AssistantLiveKitAudioRenderer';
import type { AssistantActions } from '@/types/assistants/assistant';

/**
 * The action subset the call engine needs. Mirrors the shape the standalone
 * fullscreen call page assembles: call + desktop drive the connection, chat is
 * used by the in-call chat panel, and assistant.update is kept for parity.
 */
export type CallProviderActions = Pick<AssistantActions, 'call' | 'desktop' | 'chat'> & {
  assistant: Pick<AssistantActions['assistant'], 'update'>;
  /** Live action events, so the call avatar can adopt its "working" pose while
   *  an `act` is in flight (the same stream the Actions pane consumes). */
  actions: NonNullable<AssistantActions['actions']>;
};

interface CallUserMeta {
  email: string | null | undefined;
  image: string | null | undefined;
}

type UseAssistantCallReturn = ReturnType<typeof useAssistantCall>;

export interface CallContextValue extends UseAssistantCallReturn {
  /** Whether an active call should dock into the /assistants chat slot
   *  (true) or float as a standalone window (false). Persists across page
   *  navigation so returning to /assistants restores the prior placement. */
  isDocked: boolean;
  popOut: () => void;
  redock: () => void;
}

const CallContext = React.createContext<CallContextValue | null>(null);

export function useCallContext(): CallContextValue {
  const ctx = React.useContext(CallContext);
  if (!ctx) throw new Error('useCallContext must be used within a CallProvider');
  return ctx;
}

/**
 * Owns the single LiveKit Room and the call lifecycle for the whole (home)
 * layout. Because the layout persists across client-side navigation between
 * (home) pages, a call started on /assistants stays connected as the user
 * moves to /account, /organizations, etc. Off /assistants the call shows here
 * as a small floating window; on /assistants the page renders its own
 * docked / popped-out surface from this same context.
 */
export function CallProvider({
  callActions,
  userMeta,
  children,
  onCallLifecycleChange,
}: {
  callActions: CallProviderActions;
  userMeta: CallUserMeta;
  children: React.ReactNode;
  onCallLifecycleChange?: (active: boolean) => void;
}) {
  const room = React.useMemo(() => {
    setLogLevel(LogLevel.warn);
    return new Room();
  }, []);

  const call = useAssistantCall(room, callActions);
  const [isDocked, setIsDocked] = React.useState(true);

  const popOut = React.useCallback(() => setIsDocked(false), []);
  const redock = React.useCallback(() => setIsDocked(true), []);

  // Once a call fully ends, snap back to docked so the next call starts in the
  // chat slot rather than surprise-floating from a leftover popped-out state.
  const { isConnecting, isConnected, connectionError } = call;
  React.useEffect(() => {
    if (connectionError) return;
    if (!isConnecting && !isConnected && !isDocked) {
      setIsDocked(true);
    }
  }, [isConnecting, isConnected, connectionError, isDocked]);

  const value = React.useMemo<CallContextValue>(
    () => ({ ...call, isDocked, popOut, redock }),
    [call, isDocked, popOut, redock]
  );

  const { navigateToAssistants } = useAppShellNavigation();
  const shellActivePath = useShellActivePath();
  const isCoordinatorIntroAudioPlaying = useIsCoordinatorIntroAudioPlaying();

  const { activeCallAssistant } = call;
  const hasActiveCall = !!activeCallAssistant;
  const showFloating = hasActiveCall && shellActivePath !== '/assistants';

  React.useEffect(() => {
    onCallLifecycleChange?.(call.isConnecting || call.isConnected);
  }, [call.isConnecting, call.isConnected, onCallLifecycleChange]);

  // Docking the floating window means going back to where the docked surface
  // lives, so the redock control returns the user to /assistants.
  const handleFloatingRedock = React.useCallback(() => {
    redock();
    navigateToAssistants();
  }, [redock, navigateToAssistants]);

  return (
    <CallContext.Provider value={value}>
      {children}
      {hasActiveCall && activeCallAssistant && (
        <RoomContext.Provider value={room}>
          {/* Single, persistent audio sink for the call. Living here (rather
           *  than inside whichever dialog instance is mounted) keeps audio
           *  continuous as the visible surface swaps during navigation. */}
          {!isCoordinatorIntroAudioPlaying && <AssistantLiveKitAudioRenderer />}
          {showFloating && (
            <AssistantCommunicationDialog
              isOpen
              defaultFloating
              chatDisabled
              onClose={call.disconnect}
              onRedock={handleFloatingRedock}
              assistant={activeCallAssistant}
              assistantActions={callActions}
              room={room}
              chatHistories={{}}
              setChatHistories={() => {}}
              isConnecting={call.isConnecting}
              userEmail={userMeta.email}
              userImage={userMeta.image}
              isWaitingForAssistant={call.isWaitingForAssistant}
              isAssistantPreparing={call.isAssistantPreparing}
              activeOpeningConfig={call.activeOpeningConfig}
              waitingMessage={call.waitingMessage}
              isCallConnected={call.isConnected}
              connectionError={call.connectionError}
              onRetry={call.retryConnection}
              isRemoteControlActive={call.isRemoteControlActive}
              liveviewUrl={call.liveviewUrl}
              isRemoteControlLoading={call.isRemoteControlLoading}
              toggleRemoteControl={call.toggleRemoteControl}
              isRemoteControlInteractive={call.isRemoteControlInteractive}
              isRemoteControlInteractiveLoading={call.isRemoteControlInteractiveLoading}
              toggleRemoteControlInteractive={call.toggleRemoteControlInteractive}
              isDesktopReady={call.isDesktopReady}
              callType={call.callType}
              isSpeakerMuted={call.isSpeakerMuted}
              onToggleSpeaker={call.toggleSpeakerMute}
              avatarMood={call.avatarMood}
              chatStreamConnectionStatus="connected"
              reconnectChatStream={() => {}}
              chatStreamActivitySignal={0}
            />
          )}
        </RoomContext.Provider>
      )}
    </CallContext.Provider>
  );
}
