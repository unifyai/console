import * as React from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { toast } from 'sonner';
import {
  Assistant,
  AssistantActions,
  AssistantCallConnectOptions,
} from '@/types/assistants/assistant';
import { ConnectionDetails } from '@/types/assistants/call';
import { makeRoomName } from '@/utils/assistants/call-utils';
import { useDesktopReady } from '@/hooks/Assistants/useDesktopReady';
import { useCallSounds } from '@/hooks/Assistants/useCallSounds';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import type { CreatureMood } from '@/components/Brand/TeammateCreature';
import { DEFAULT_AVATAR_MOOD, parseMoodClassificationMessage } from '@/utils/assistants/droid-mood';

const ASSISTANT_JOIN_SLOW_THRESHOLD = 90000; // 90 seconds — soft warning, not an error
const ASSISTANT_REJOIN_TIMEOUT = 30000; // 30 seconds for rejoin
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

type AssistantReadyWaiter = {
  attemptId: number;
  resolve: () => void;
  reject: (error: Error) => void;
};

export function useAssistantCall(room: Room, assistantActions: AssistantActions) {
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [activeCallAssistant, setActiveCallAssistant] = React.useState<Assistant | null>(null);
  const [callType, setCallType] = React.useState<'video' | 'audio' | null>(null);
  const [isSpeakerMuted, setIsSpeakerMuted] = React.useState(false);
  const [isWaitingForAssistant, setIsWaitingForAssistant] = React.useState(false);
  const [isAssistantPreparing, setIsAssistantPreparing] = React.useState(false);
  const [waitingMessage, setWaitingMessage] = React.useState<string | null>(null);
  const [connectionError, setConnectionError] = React.useState<string | null>(null);
  const [avatarMood, setAvatarMood] = React.useState<CreatureMood>(DEFAULT_AVATAR_MOOD);
  const assistantJoinTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const assistantRejoinTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = React.useRef(false);
  const isRedispatchingRef = React.useRef(false);
  const moodTurnIndexRef = React.useRef(-1);
  const expectsReadyToSpeakRef = React.useRef(false);
  const assistantReadyWaiterRef = React.useRef<AssistantReadyWaiter | null>(null);
  // Unique ID for each connection attempt - used to detect stale operations
  const connectionAttemptIdRef = React.useRef(0);

  // --- Remote Control State ---
  const [isRemoteControlActive, setIsRemoteControlActive] = React.useState(false);
  const [liveviewUrl, setLiveviewUrl] = React.useState<string | null>(null);
  const [isRemoteControlLoading, setIsRemoteControlLoading] = React.useState(false);
  const [isRemoteControlInteractive, setIsRemoteControlInteractive] = React.useState(false);
  const [isRemoteControlInteractiveLoading, setIsRemoteControlInteractiveLoading] =
    React.useState(false);

  const { startRinging, stopRinging, setRingingMuted, playHangup } = useCallSounds();

  // Track whether we were truly connected so we only play hangup when appropriate
  const wasConnectedRef = React.useRef(false);

  const toggleSpeakerMute = React.useCallback(() => {
    setIsSpeakerMuted((prev) => !prev);
  }, []);

  React.useEffect(() => {
    setRingingMuted(isSpeakerMuted);
  }, [isSpeakerMuted, setRingingMuted]);

  const clearAssistantJoinTimeout = React.useCallback(() => {
    if (assistantJoinTimeoutRef.current) {
      clearTimeout(assistantJoinTimeoutRef.current);
      assistantJoinTimeoutRef.current = null;
    }
    if (assistantRejoinTimeoutRef.current) {
      clearTimeout(assistantRejoinTimeoutRef.current);
      assistantRejoinTimeoutRef.current = null;
    }
  }, []);

  const stopRemoteControl = React.useCallback(() => {
    setIsRemoteControlActive(false);
    setLiveviewUrl(null);
    setIsRemoteControlInteractive(false);
  }, []);

  const resolveAssistantReadyWaiter = React.useCallback((attemptId?: number) => {
    const waiter = assistantReadyWaiterRef.current;
    if (!waiter) return;
    if (attemptId !== undefined && waiter.attemptId !== attemptId) return;
    assistantReadyWaiterRef.current = null;
    waiter.resolve();
  }, []);

  const rejectAssistantReadyWaiter = React.useCallback((message: string, attemptId?: number) => {
    const waiter = assistantReadyWaiterRef.current;
    if (!waiter) return;
    if (attemptId !== undefined && waiter.attemptId !== attemptId) return;
    assistantReadyWaiterRef.current = null;
    waiter.reject(new Error(message));
  }, []);

  const onDisconnected = React.useCallback(() => {
    rejectAssistantReadyWaiter('Call disconnected before the assistant was ready.');
    stopRinging();
    if (wasConnectedRef.current) {
      playHangup();
    }
    wasConnectedRef.current = false;

    const disconnectingId = activeCallAssistantRef.current?.agentId;
    if (disconnectingId) {
      try {
        sessionStorage.removeItem(`desktop-ready-${disconnectingId}`);
      } catch {
        /* SSR-safe */
      }
    }

    setIsConnected(false);
    setIsConnecting(false);
    setIsWaitingForAssistant(false);
    setIsAssistantPreparing(false);
    setWaitingMessage(null);
    setConnectionError(null);
    setConnectionDetails(null);
    setActiveCallAssistant(null);
    setCallType(null);
    setIsSpeakerMuted(false);
    setAvatarMood(DEFAULT_AVATAR_MOOD);
    moodTurnIndexRef.current = -1;
    isRedispatchingRef.current = false;
    stopRemoteControl();
    clearAssistantJoinTimeout();
  }, [
    clearAssistantJoinTimeout,
    rejectAssistantReadyWaiter,
    stopRemoteControl,
    stopRinging,
    playHangup,
  ]);

  const connect = React.useCallback(
    async (
      assistant: Assistant,
      type: 'video' | 'audio',
      options?: AssistantCallConnectOptions
    ) => {
      resolveAssistantReadyWaiter();
      connectionAttemptIdRef.current += 1;
      const thisAttemptId = connectionAttemptIdRef.current;
      isCancelledRef.current = false;
      expectsReadyToSpeakRef.current =
        !options?.openingConfig ||
        options.openingConfig.mode === 'speak' ||
        options.openingConfig.mode === 'briefed';
      const shouldWaitForAssistantReady =
        options?.waitForAssistantReady === true && expectsReadyToSpeakRef.current;
      let readyToSpeakPromise: Promise<void> | null = null;

      const isStaleAttempt = () =>
        isCancelledRef.current || connectionAttemptIdRef.current !== thisAttemptId;

      if (room.state !== 'disconnected') {
        return;
      }
      if (!assistant) return;

      setIsConnecting(true);
      setCallType(type);
      setActiveCallAssistant(assistant);
      setError(null);
      setConnectionError(null);
      setAvatarMood(DEFAULT_AVATAR_MOOD);
      moodTurnIndexRef.current = -1;
      if (!options?.suppressRinging) {
        startRinging();
      }
      try {
        const expectedRoomName = makeRoomName(assistant.agentId, 'meet');

        // Fire-and-forget: clean up any stale room without blocking the connection flow
        assistantActions.call.deleteRoom(expectedRoomName).catch(() => {});

        const assistantName = assistantDisplayName(assistant);
        let connDetails: ConnectionDetails | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
          if (isStaleAttempt()) return;

          try {
            // Run getConnectionDetails and dispatchToCall in parallel.
            // The room name is deterministic (droid_{id}_meet), so dispatch
            // doesn't need to wait for connection details.
            const [details, dispatchResult] = await Promise.all([
              assistantActions.call.getConnectionDetails(assistant.agentId, assistantName),
              assistantActions.call.dispatchToCall(
                assistant.agentId,
                expectedRoomName,
                options?.openingConfig
              ),
            ]);
            if (isStaleAttempt()) return;

            if ('detail' in details) {
              throw new Error((details as any).detail || 'Could not get call details.');
            }
            connDetails = details as ConnectionDetails;
            setConnectionDetails(connDetails);

            if (dispatchResult.detail) {
              throw new Error(`Failed to dispatch assistant: ${dispatchResult.detail}`);
            }

            break;
          } catch (err: any) {
            if (attempt > MAX_RETRIES) {
              throw err;
            }

            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        if (!connDetails) return;

        if (connDetails.mode === 'dev') {
          setConnectionDetails(connDetails);
          stopRinging();
          setIsConnected(true);
          setIsConnecting(false);
          wasConnectedRef.current = true;
          setIsWaitingForAssistant(false);
          setIsAssistantPreparing(false);
        } else {
          if (shouldWaitForAssistantReady) {
            readyToSpeakPromise = new Promise((resolve, reject) => {
              assistantReadyWaiterRef.current = { attemptId: thisAttemptId, resolve, reject };
            });
          }

          await room.connect(connDetails.serverUrl, connDetails.token);
          if (isStaleAttempt()) {
            resolveAssistantReadyWaiter(thisAttemptId);
            await room.disconnect();
            return;
          }

          await Promise.all([
            room.localParticipant.setMicrophoneEnabled(true),
            room.localParticipant.setCameraEnabled(type === 'video'),
          ]);
          setIsConnected(true);
          setIsConnecting(false);
          wasConnectedRef.current = true;

          if (room.remoteParticipants.size < 1) {
            setIsWaitingForAssistant(true);
            setIsAssistantPreparing(false);
            const timeoutDuration =
              (typeof window !== 'undefined' && (window as any)._TEST_ASSISTANT_JOIN_TIMEOUT) ||
              ASSISTANT_JOIN_SLOW_THRESHOLD;
            assistantJoinTimeoutRef.current = setTimeout(() => {
              if (isStaleAttempt()) return;
              setWaitingMessage(
                `${assistantDisplayName(assistant)} is taking a bit longer than expected…`
              );
            }, timeoutDuration);
          } else {
            setIsWaitingForAssistant(false);
            setIsAssistantPreparing(expectsReadyToSpeakRef.current);
            stopRinging();
          }

          if (readyToSpeakPromise) {
            await readyToSpeakPromise;
          }
        }
      } catch (e: any) {
        // Only handle error if this attempt is still the current one
        if (isStaleAttempt()) return;

        resolveAssistantReadyWaiter(thisAttemptId);
        stopRinging();
        setIsConnecting(false);
        toast.error(`Failed to start call. Please try again.`);
        setError(`Failed to start call: ${e.message}`);
        // Clean up the server-side room so it doesn't interfere with subsequent attempts
        assistantActions.call.deleteRoom(makeRoomName(assistant.agentId, 'meet')).catch(() => {});
        // Ensure we disconnect if we were partially connected (e.g. mic permission failed)
        if (room.state !== 'disconnected') {
          room.disconnect().catch(console.error);
        }
        onDisconnected();
      }
    },
    [
      room,
      assistantActions.call,
      onDisconnected,
      startRinging,
      stopRinging,
      resolveAssistantReadyWaiter,
    ]
  );

  const disconnect = React.useCallback(async () => {
    isCancelledRef.current = true;
    clearAssistantJoinTimeout();
    stopRemoteControl();

    if (isConnecting) {
      setIsConnecting(false);
    }

    if (room.state !== 'disconnected') {
      await room.disconnect();
    } else {
      // If room wasn't even connecting, we still need to trigger cleanup.
      onDisconnected();
    }
  }, [room, clearAssistantJoinTimeout, stopRemoteControl, isConnecting, onDisconnected]);

  const retryConnection = React.useCallback(async () => {
    const assistantToRetry = activeCallAssistant;
    const callTypeToRetry = callType;
    if (!assistantToRetry || !callTypeToRetry) return;

    // Temporarily detach the main disconnect handler to prevent full UI teardown
    room.off(RoomEvent.Disconnected, onDisconnected);

    // Delete the stale room before disconnecting so the retry starts fresh
    await assistantActions.call
      .deleteRoom(makeRoomName(assistantToRetry.agentId, 'meet'))
      .catch(() => {});

    await room.disconnect();

    // Manually reset only the states needed for a fresh connection attempt
    setIsConnected(false);
    setIsConnecting(false);
    setIsWaitingForAssistant(false);
    setIsAssistantPreparing(false);
    setConnectionError(null);
    stopRemoteControl();
    clearAssistantJoinTimeout();

    // Re-attach the handler for subsequent, normal disconnects
    room.on(RoomEvent.Disconnected, onDisconnected);

    // Start the connection process again with the same assistant
    connect(assistantToRetry, callTypeToRetry);
  }, [
    activeCallAssistant,
    callType,
    room,
    connect,
    onDisconnected,
    clearAssistantJoinTimeout,
    stopRemoteControl,
    assistantActions.call,
  ]);

  const boundGetLiveviewUrl = React.useCallback(
    (id: string) =>
      assistantActions.desktop.getLiveviewUrl(
        id,
        activeCallAssistant?.userId ?? '',
        activeCallAssistant?.organizationId ?? null
      ),
    [assistantActions.desktop, activeCallAssistant?.userId, activeCallAssistant?.organizationId]
  );

  const { isDesktopReady, eventLiveviewUrl } = useDesktopReady(
    activeCallAssistant?.agentId,
    boundGetLiveviewUrl
  );

  const toggleRemoteControl = React.useCallback(async () => {
    if (!activeCallAssistant) return;

    if (isRemoteControlActive) {
      if (isRemoteControlInteractive) {
        assistantActions.desktop
          .sendSystemEvent(
            activeCallAssistant.agentId,
            'user_remote_control_stopped',
            'User released remote control of assistant desktop'
          )
          .catch(console.error);
      }
      assistantActions.desktop
        .sendSystemEvent(
          activeCallAssistant.agentId,
          'assistant_screen_share_stopped',
          'User disabled assistant screen sharing'
        )
        .catch(console.error);
      stopRemoteControl();
      return;
    }

    setIsRemoteControlLoading(true);
    const toastId = toast.loading('Starting assistant screen sharing...');

    try {
      let resolvedUrl: string | undefined;

      if (eventLiveviewUrl) {
        const built = await assistantActions.desktop.buildLiveviewUrl(
          eventLiveviewUrl,
          activeCallAssistant.userId,
          activeCallAssistant.organizationId ?? null
        );
        resolvedUrl = built.liveviewUrl;
      } else {
        const result = await assistantActions.desktop.getLiveviewUrl(
          activeCallAssistant.agentId,
          activeCallAssistant.userId,
          activeCallAssistant.organizationId ?? null
        );
        resolvedUrl = result.liveviewUrl;
      }

      if (resolvedUrl) {
        const healthy = await assistantActions.desktop.checkLiveviewHealth(resolvedUrl);
        if (!healthy) {
          throw new Error('Desktop is not reachable — it may still be starting up.');
        }
        setLiveviewUrl(resolvedUrl);
        setIsRemoteControlActive(true);
        setIsRemoteControlInteractive(false);
        assistantActions.desktop
          .sendSystemEvent(
            activeCallAssistant.agentId,
            'assistant_screen_share_started',
            'User enabled assistant screen sharing'
          )
          .catch(console.error);
        toast.success('Assistant screen sharing started.', { id: toastId });
      } else {
        throw new Error('Could not retrieve session URL.');
      }
    } catch (e: any) {
      console.error('[useAssistantCall] Toggle remote control failed:', e.message);
      toast.error('The assistant could not share their screen. Please try again.', {
        id: toastId,
      });
    } finally {
      setIsRemoteControlLoading(false);
    }
  }, [
    isRemoteControlActive,
    isRemoteControlInteractive,
    stopRemoteControl,
    assistantActions.desktop,
    activeCallAssistant,
    eventLiveviewUrl,
  ]);

  const toggleRemoteControlInteractive = React.useCallback(async () => {
    if (!isRemoteControlActive || !activeCallAssistant) return;

    const nextState = !isRemoteControlInteractive;
    const eventType = nextState ? 'user_remote_control_started' : 'user_remote_control_stopped';
    const message = nextState
      ? 'User took remote control of assistant desktop'
      : 'User released remote control of assistant desktop';

    setIsRemoteControlInteractiveLoading(true);
    try {
      const result = await assistantActions.desktop.sendSystemEvent(
        activeCallAssistant.agentId,
        eventType,
        message
      );
      if (result.detail) {
        throw new Error(result.detail);
      }
      // Only update the state if the webhook call was successful
      setIsRemoteControlInteractive(nextState);
      toast.info(nextState ? 'Interactive mode enabled.' : 'View-only mode enabled.');
    } catch (e: any) {
      console.error(
        `[useAssistantCall] Failed to toggle interactive mode to ${nextState}:`,
        e.message
      );
      toast.error(`Could not ${nextState ? 'enable' : 'disable'} interactive mode.`);
    } finally {
      setIsRemoteControlInteractiveLoading(false);
    }
  }, [
    isRemoteControlActive,
    isRemoteControlInteractive,
    activeCallAssistant,
    assistantActions.desktop,
  ]);

  // Helper function to redispatch assistant to the room
  const redispatchAssistant = React.useCallback(async () => {
    if (!activeCallAssistant || !connectionDetails || isRedispatchingRef.current) return;

    isRedispatchingRef.current = true;
    const displayName = assistantDisplayName(activeCallAssistant);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (isCancelledRef.current || !isRedispatchingRef.current) return;

      try {
        const dispatchResult = await assistantActions.call.dispatchToCall(
          activeCallAssistant.agentId,
          connectionDetails.roomName
        );

        if (dispatchResult.detail) {
          throw new Error(dispatchResult.detail);
        }

        // Dispatch succeeded, now wait for assistant to rejoin
        return;
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          // All retries failed
          isRedispatchingRef.current = false;
          toast.error(`${displayName} had trouble rejoining. Please try calling again.`);
          room.disconnect();
          return;
        }

        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }, [activeCallAssistant, connectionDetails, assistantActions.call, room]);

  // Store refs to current state for event handlers to avoid stale closures
  const isConnectedRef = React.useRef(isConnected);
  const activeCallAssistantRef = React.useRef(activeCallAssistant);

  React.useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  React.useEffect(() => {
    activeCallAssistantRef.current = activeCallAssistant;
  }, [activeCallAssistant]);

  React.useEffect(() => {
    const READY_FALLBACK_TIMEOUT = 10_000;
    let readyFallbackTimer: NodeJS.Timeout | null = null;

    const clearReadyFallbackTimer = () => {
      if (readyFallbackTimer) {
        clearTimeout(readyFallbackTimer);
        readyFallbackTimer = null;
      }
    };

    const clearJoinState = () => {
      setIsWaitingForAssistant(false);
      setWaitingMessage(null);
      setConnectionError(null);
      isRedispatchingRef.current = false;
      clearAssistantJoinTimeout();
      stopRinging();
    };

    const clearPreparingState = () => {
      setIsAssistantPreparing(false);
      clearReadyFallbackTimer();
    };

    const onDataReceived = (
      payload: Uint8Array,
      _participant?: any,
      _kind?: any,
      topic?: string
    ) => {
      if (topic !== 'agent_status') return;
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === 'ready_to_speak') {
          clearJoinState();
          clearPreparingState();
          resolveAssistantReadyWaiter();
          return;
        }
        const moodMessage = parseMoodClassificationMessage(data, moodTurnIndexRef.current);
        if (moodMessage) {
          moodTurnIndexRef.current = moodMessage.turnIndex;
          setAvatarMood(moodMessage.mood);
        }
      } catch {
        // ignore malformed data messages
      }
    };

    const onParticipantConnected = () => {
      clearJoinState();
      if (!expectsReadyToSpeakRef.current) {
        clearPreparingState();
        return;
      }
      setIsAssistantPreparing(true);
      clearReadyFallbackTimer();
      readyFallbackTimer = setTimeout(clearPreparingState, READY_FALLBACK_TIMEOUT);
    };

    const onParticipantDisconnected = () => {
      if (!isConnectedRef.current || !activeCallAssistantRef.current) return;

      if (room.remoteParticipants.size < 1) {
        const displayName = assistantDisplayName(activeCallAssistantRef.current);
        setWaitingMessage(`${displayName} disconnected, waiting for them to rejoin...`);
        setIsWaitingForAssistant(true);
        setIsAssistantPreparing(false);
        clearReadyFallbackTimer();

        // Try to redispatch the assistant
        redispatchAssistant();

        // Set a timeout for the assistant to rejoin
        const timeoutDuration =
          (typeof window !== 'undefined' && (window as any)._TEST_ASSISTANT_REJOIN_TIMEOUT) ||
          ASSISTANT_REJOIN_TIMEOUT;

        assistantRejoinTimeoutRef.current = setTimeout(() => {
          if (isCancelledRef.current) return;
          if (isRedispatchingRef.current || room.remoteParticipants.size < 1) {
            // Assistant still hasn't rejoined — clean up server-side room before disconnecting
            isRedispatchingRef.current = false;
            const assistant = activeCallAssistantRef.current;
            if (assistant) {
              assistantActions.call
                .deleteRoom(makeRoomName(assistant.agentId, 'meet'))
                .catch(() => {});
            }
            toast.error(
              `${displayName} couldn't rejoin the call. Please try calling again if needed.`
            );
            room.disconnect();
          }
        }, timeoutDuration);
      }
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      clearReadyFallbackTimer();
      clearAssistantJoinTimeout();
    };
  }, [
    room,
    onDisconnected,
    clearAssistantJoinTimeout,
    redispatchAssistant,
    assistantActions.call,
    stopRinging,
    resolveAssistantReadyWaiter,
  ]);

  // Ensure proper cleanup on component unmount
  React.useEffect(() => {
    return () => {
      if (room.state !== 'disconnected') {
        room.disconnect();
      }
    };
  }, [room]);

  return {
    room,
    connectionDetails,
    error,
    isConnected,
    isConnecting,
    activeCallAssistant,
    callType,
    isSpeakerMuted,
    toggleSpeakerMute,
    connect,
    disconnect,
    isWaitingForAssistant,
    isAssistantPreparing,
    waitingMessage,
    connectionError,
    retryConnection,
    // Remote control exports
    isDesktopReady,
    isRemoteControlActive,
    liveviewUrl,
    isRemoteControlLoading,
    toggleRemoteControl,
    isRemoteControlInteractive,
    isRemoteControlInteractiveLoading,
    toggleRemoteControlInteractive,
    avatarMood,
  };
}
