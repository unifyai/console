import * as React from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { toast } from 'sonner';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ConnectionDetails } from '@/types/assistants/call';
import { makeRoomName } from '@/utils/assistants/call-utils';

const ASSISTANT_JOIN_TIMEOUT = 60000; // 60 seconds
const ASSISTANT_REJOIN_TIMEOUT = 30000; // 30 seconds for rejoin
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const DESKTOP_READY_POLL_INTERVAL = 3000; // 3 seconds between desktop readiness checks

export function useAssistantCall(room: Room, assistantActions: AssistantActions) {
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [activeCallAssistant, setActiveCallAssistant] = React.useState<Assistant | null>(null);
  const [callType, setCallType] = React.useState<'video' | 'audio' | null>(null);
  const [isSpeakerMuted, setIsSpeakerMuted] = React.useState(false);
  const [isWaitingForAssistant, setIsWaitingForAssistant] = React.useState(false);
  const [waitingMessage, setWaitingMessage] = React.useState<string | null>(null);
  const [connectionError, setConnectionError] = React.useState<string | null>(null);
  const assistantJoinTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const assistantRejoinTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = React.useRef(false);
  const isRedispatchingRef = React.useRef(false);
  // Unique ID for each connection attempt - used to detect stale operations
  const connectionAttemptIdRef = React.useRef(0);

  // --- Remote Control State ---
  const [isDesktopReady, setIsDesktopReady] = React.useState(false);
  const desktopPollRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isRemoteControlActive, setIsRemoteControlActive] = React.useState(false);
  const [liveviewUrl, setLiveviewUrl] = React.useState<string | null>(null);
  const [isRemoteControlLoading, setIsRemoteControlLoading] = React.useState(false);
  const [isRemoteControlInteractive, setIsRemoteControlInteractive] = React.useState(false);
  const [isRemoteControlInteractiveLoading, setIsRemoteControlInteractiveLoading] =
    React.useState(false);

  const toggleSpeakerMute = React.useCallback(() => {
    setIsSpeakerMuted((prev) => !prev);
  }, []);

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

  const stopDesktopPoll = React.useCallback(() => {
    if (desktopPollRef.current) {
      clearInterval(desktopPollRef.current);
      desktopPollRef.current = null;
    }
  }, []);

  const stopRemoteControl = React.useCallback(() => {
    setIsRemoteControlActive(false);
    setLiveviewUrl(null);
    setIsRemoteControlInteractive(false);
  }, []);

  const onDisconnected = React.useCallback(() => {
    setIsConnected(false);
    setIsConnecting(false);
    setIsWaitingForAssistant(false);
    setWaitingMessage(null);
    setConnectionError(null);
    setConnectionDetails(null);
    setActiveCallAssistant(null);
    setCallType(null);
    setIsSpeakerMuted(false);
    isRedispatchingRef.current = false;
    stopRemoteControl();
    stopDesktopPoll();
    setIsDesktopReady(false);
    clearAssistantJoinTimeout();
  }, [clearAssistantJoinTimeout, stopRemoteControl, stopDesktopPoll]);

  const connect = React.useCallback(
    async (assistant: Assistant, type: 'video' | 'audio') => {
      // Increment connection attempt ID to invalidate any in-flight operations from previous attempts
      connectionAttemptIdRef.current += 1;
      const thisAttemptId = connectionAttemptIdRef.current;
      isCancelledRef.current = false;

      // Helper to check if this connection attempt is still valid
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
      try {
        // Delete any stale room from a previous failed attempt before creating a new one
        const expectedRoomName = makeRoomName(assistant.agentId, 'meet');
        await assistantActions.call.deleteRoom(expectedRoomName).catch(() => {});
        if (isStaleAttempt()) return;

        const assistantName = `${assistant.firstName}${assistant.surname}`;
        let connDetails: ConnectionDetails | null = null;

        // Retry loop for connection setup
        for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
          if (isStaleAttempt()) return;

          try {
            // Step 1: Get connection details for the user
            const details = await assistantActions.call.getConnectionDetails(
              assistant.agentId,
              assistantName
            );
            if (isStaleAttempt()) return;
            if ('detail' in details) {
              throw new Error(details.detail || 'Could not get call details.');
            }
            connDetails = details as ConnectionDetails;
            setConnectionDetails(connDetails);

            // Step 2: Dispatch the assistant to join the room
            const dispatchResult = await assistantActions.call.dispatchToCall(
              assistant.agentId,
              connDetails.roomName
            );
            if (isStaleAttempt()) return;
            if (dispatchResult.detail) {
              throw new Error(`Failed to dispatch assistant: ${dispatchResult.detail}`);
            }

            // If we get here, both steps succeeded
            break;
          } catch (err: any) {
            if (attempt > MAX_RETRIES) {
              throw err; // Rethrow on final attempt to trigger catch block below
            }

            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        if (!connDetails) return; // Should be covered by throw above, but safety check

        // Step 3: Connect the user's client
        await room.connect(connDetails.serverUrl, connDetails.token);
        if (isStaleAttempt()) {
          await room.disconnect();
          return;
        }

        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(type === 'video');
        setIsConnected(true);
        setIsConnecting(false); // User is connected, now wait for assistant

        if (room.numParticipants < 2) {
          // Check if assistant isn't already there
          setIsWaitingForAssistant(true);
          const timeoutDuration =
            (typeof window !== 'undefined' && (window as any)._TEST_ASSISTANT_JOIN_TIMEOUT) ||
            ASSISTANT_JOIN_TIMEOUT;
          assistantJoinTimeoutRef.current = setTimeout(() => {
            if (isStaleAttempt()) return;
            setConnectionError(`${assistant.firstName} is taking too long to join.`);
            setIsWaitingForAssistant(false);
          }, timeoutDuration);
        } else {
          setIsWaitingForAssistant(false); // Assistant was already present
        }
      } catch (e: any) {
        // Only handle error if this attempt is still the current one
        if (isStaleAttempt()) return;

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
    [room, assistantActions.call, onDisconnected]
  );

  const disconnect = React.useCallback(async () => {
    isCancelledRef.current = true;
    clearAssistantJoinTimeout();
    stopRemoteControl();

    // Delete the server-side room so it doesn't interfere with subsequent calls
    const assistantToClean = activeCallAssistantRef.current;
    if (assistantToClean) {
      assistantActions.call.deleteRoom(makeRoomName(assistantToClean.agentId, 'meet')).catch(() => {});
    }

    if (isConnecting) {
      setIsConnecting(false);
    }

    if (room.state !== 'disconnected') {
      await room.disconnect();
    } else {
      // If room wasn't even connecting, we still need to trigger cleanup.
      onDisconnected();
    }
  }, [room, clearAssistantJoinTimeout, stopRemoteControl, isConnecting, onDisconnected, assistantActions.call]);

  const retryConnection = React.useCallback(async () => {
    const assistantToRetry = activeCallAssistant;
    const callTypeToRetry = callType;
    if (!assistantToRetry || !callTypeToRetry) return;

    // Temporarily detach the main disconnect handler to prevent full UI teardown
    room.off(RoomEvent.Disconnected, onDisconnected);

    // Delete the stale room before disconnecting so the retry starts fresh
    await assistantActions.call.deleteRoom(makeRoomName(assistantToRetry.agentId, 'meet')).catch(() => {});

    await room.disconnect();

    // Manually reset only the states needed for a fresh connection attempt
    setIsConnected(false);
    setIsConnecting(false);
    setIsWaitingForAssistant(false);
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
      const result = await assistantActions.desktop.getLiveviewUrl(activeCallAssistant.agentId);
      if (result.liveviewUrl) {
        setLiveviewUrl(result.liveviewUrl);
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
      toast.error('The assistant could not share their screen. Please try again.', { id: toastId });
    } finally {
      setIsRemoteControlLoading(false);
    }
  }, [
    isRemoteControlActive,
    isRemoteControlInteractive,
    stopRemoteControl,
    assistantActions.desktop,
    activeCallAssistant,
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
    const assistantName = `${activeCallAssistant.firstName}${activeCallAssistant.surname}`;

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
          toast.error(
            `${activeCallAssistant.firstName} had trouble rejoining. Please try calling again.`
          );
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
    const onParticipantConnected = () => {
      setIsWaitingForAssistant(false);
      setWaitingMessage(null);
      isRedispatchingRef.current = false;
      clearAssistantJoinTimeout();
    };

    const onParticipantDisconnected = () => {
      // Only handle if we're in an active call and the disconnected participant is the assistant
      if (!isConnectedRef.current || !activeCallAssistantRef.current) return;

      // Check if the room now has fewer than 2 participants (user alone)
      if (room.numParticipants < 2) {
        const firstName = activeCallAssistantRef.current.firstName;
        setWaitingMessage(`${firstName} disconnected, waiting for them to rejoin...`);
        setIsWaitingForAssistant(true);

        // Try to redispatch the assistant
        redispatchAssistant();

        // Set a timeout for the assistant to rejoin
        const timeoutDuration =
          (typeof window !== 'undefined' && (window as any)._TEST_ASSISTANT_REJOIN_TIMEOUT) ||
          ASSISTANT_REJOIN_TIMEOUT;

        assistantRejoinTimeoutRef.current = setTimeout(() => {
          if (isCancelledRef.current) return;
          if (isRedispatchingRef.current || room.numParticipants < 2) {
            // Assistant still hasn't rejoined — clean up server-side room before disconnecting
            isRedispatchingRef.current = false;
            const assistant = activeCallAssistantRef.current;
            if (assistant) {
              assistantActions.call.deleteRoom(makeRoomName(assistant.agentId, 'meet')).catch(() => {});
            }
            toast.error(
              `${firstName} couldn't rejoin the call. Please try calling again if needed.`
            );
            room.disconnect();
          }
        }, timeoutDuration);
      }
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      clearAssistantJoinTimeout();
    };
  }, [room, onDisconnected, clearAssistantJoinTimeout, redispatchAssistant, assistantActions.call]);

  // Poll for desktop VM readiness once the call is connected.
  // Uses recursive setTimeout (not setInterval) so the next check only
  // schedules after the current one completes, avoiding overlapping calls
  // into getLiveviewUrl which has its own internal retry loop.
  React.useEffect(() => {
    if (!isConnected || !activeCallAssistant) {
      stopDesktopPoll();
      return;
    }

    let cancelled = false;

    const scheduleCheck = () => {
      desktopPollRef.current = setTimeout(async () => {
        if (cancelled) return;
        try {
          const result = await assistantActions.desktop.getLiveviewUrl(
            activeCallAssistant.agentId,
          );
          if (!cancelled && result && 'liveviewUrl' in result && result.liveviewUrl) {
            setIsDesktopReady(true);
            return;
          }
        } catch {
          // VM not ready yet
        }
        if (!cancelled) scheduleCheck();
      }, DESKTOP_READY_POLL_INTERVAL);
    };

    // Immediate first check
    (async () => {
      try {
        const result = await assistantActions.desktop.getLiveviewUrl(
          activeCallAssistant.agentId,
        );
        if (!cancelled && result && 'liveviewUrl' in result && result.liveviewUrl) {
          setIsDesktopReady(true);
          return;
        }
      } catch {
        // VM not ready yet
      }
      if (!cancelled) scheduleCheck();
    })();

    return () => {
      cancelled = true;
      stopDesktopPoll();
    };
  }, [isConnected, activeCallAssistant, assistantActions.desktop, stopDesktopPoll]);

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
  };
}
