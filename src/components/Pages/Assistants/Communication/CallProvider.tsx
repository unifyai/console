'use client';

import * as React from 'react';
import { LogLevel, Room, setLogLevel } from 'livekit-client';
import { RoomContext } from '@livekit/components-react';
import { useAssistantCall } from '@/hooks/Assistants/useAssistantCall';
import { useIsCoordinatorIntroAudioPlaying } from './AssistantCommunicationDialog';
import { AssistantLiveKitAudioRenderer } from './AssistantLiveKitAudioRenderer';
import { VoiceEnrollmentFallbackDialog } from './VoiceEnrollmentFallbackDialog';
import type { AssistantActions } from '@/types/assistants/assistant';
import { useVoiceEnrollmentFallbackPrompt } from '@/hooks/Assistants/useVoiceEnrollmentFallbackPrompt';

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
  voiceSample?: string | null;
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
 * moves to /account, /organizations, etc. On /assistants the page renders the
 * docked / popped-out call surface; off /assistants only background audio
 * persists while the floating chat carries the visible UI.
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

  const isCoordinatorIntroAudioPlaying = useIsCoordinatorIntroAudioPlaying();

  const { activeCallAssistant } = call;
  const hasActiveCall = !!activeCallAssistant;
  const callLifecycleActive = call.isConnecting || call.isConnected;

  const voiceEnrollmentFallback = useVoiceEnrollmentFallbackPrompt({
    assistantId: activeCallAssistant?.agentId ?? null,
    callLifecycleActive,
    hasVoiceSample: !!userMeta.voiceSample,
  });

  React.useEffect(() => {
    onCallLifecycleChange?.(call.isConnecting || call.isConnected);
  }, [call.isConnecting, call.isConnected, onCallLifecycleChange]);

  return (
    <CallContext.Provider value={value}>
      {children}
      <VoiceEnrollmentFallbackDialog
        open={voiceEnrollmentFallback.open}
        onOpenChange={voiceEnrollmentFallback.onOpenChange}
        onEnrolled={voiceEnrollmentFallback.onEnrolled}
      />
      {hasActiveCall && activeCallAssistant && (
        <RoomContext.Provider value={room}>
          {!isCoordinatorIntroAudioPlaying && <AssistantLiveKitAudioRenderer />}
        </RoomContext.Provider>
      )}
    </CallContext.Provider>
  );
}
