import * as React from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { toast } from 'sonner';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ConnectionDetails } from '@/types/assistants/call';

const ASSISTANT_JOIN_TIMEOUT = 60000; // 60 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

export function useAssistantCall(room: Room, assistantActions: AssistantActions) {
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [activeCallAssistant, setActiveCallAssistant] = React.useState<Assistant | null>(null);
  const [callType, setCallType] = React.useState<'video' | 'audio' | null>(null);
  const [isSpeakerMuted, setIsSpeakerMuted] = React.useState(false);
  const [isWaitingForAssistant, setIsWaitingForAssistant] = React.useState(false);
  const [connectionError, setConnectionError] = React.useState<string | null>(null);
  const assistantJoinTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = React.useRef(false);

  // --- Remote Control State ---
  const [isRemoteControlActive, setIsRemoteControlActive] = React.useState(false);
  const [liveviewUrl, setLiveviewUrl] = React.useState<string | null>(null);
  const [isRemoteControlLoading, setIsRemoteControlLoading] = React.useState(false);
  const [isRemoteControlInteractive, setIsRemoteControlInteractive] = React.useState(false);

  const toggleSpeakerMute = React.useCallback(() => {
    setIsSpeakerMuted((prev) => !prev);
  }, []);

  const clearAssistantJoinTimeout = React.useCallback(() => {
    if (assistantJoinTimeoutRef.current) {
      clearTimeout(assistantJoinTimeoutRef.current);
      assistantJoinTimeoutRef.current = null;
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
    setConnectionError(null);
    setConnectionDetails(null);
    setActiveCallAssistant(null);
    setCallType(null);
    setIsSpeakerMuted(false);
    stopRemoteControl(); // Clean up remote control state
    clearAssistantJoinTimeout();
  }, [clearAssistantJoinTimeout, stopRemoteControl]);

  const connect = React.useCallback(
    async (assistant: Assistant, type: 'video' | 'audio') => {
      isCancelledRef.current = false;

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
        const assistantName = `${assistant.firstName}${assistant.surname}`;
        let connDetails: ConnectionDetails | null = null;

        // Retry loop for connection setup
        for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
          if (isCancelledRef.current) return;

          try {
            // Step 1: Get connection details for the user
            const details = await assistantActions.call.getConnectionDetails(
              assistant.agentId,
              assistantName
            );
            if (isCancelledRef.current) return;
            if ('detail' in details) {
              throw new Error(details.detail || 'Could not get call details.');
            }
            connDetails = details as ConnectionDetails;
            setConnectionDetails(connDetails);

            // Step 2: Dispatch the assistant to join the room
            const dispatchResult = await assistantActions.call.dispatchToCall(
              assistant.agentId,
              assistantName,
              connDetails.roomName
            );
            if (isCancelledRef.current) return;
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
        if (isCancelledRef.current) {
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
            if (isCancelledRef.current) return;
            setConnectionError(`${assistant.firstName} is taking too long to join.`);
            setIsWaitingForAssistant(false);
          }, timeoutDuration);
        } else {
          setIsWaitingForAssistant(false); // Assistant was already present
        }
      } catch (e: any) {
        setIsConnecting(false);
        if (isCancelledRef.current) {
          /* no-op */
        } else {
          toast.error(`Failed to start call. Please try again.`);
          setError(`Failed to start call: ${e.message}`);
        }
        // Ensure we disconnect if we were partially connected (e.g. mic permission failed)
        if (room.state !== 'disconnected') {
          room.disconnect().catch(console.error);
        }
        onDisconnected();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, assistantActions.call, clearAssistantJoinTimeout, onDisconnected]
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
  ]);

  const toggleRemoteControl = React.useCallback(async () => {
    if (!activeCallAssistant) return;

    if (isRemoteControlActive) {
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
        setIsRemoteControlInteractive(false); // Start in view-only mode
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
  }, [isRemoteControlActive, stopRemoteControl, assistantActions.desktop, activeCallAssistant]);

  const toggleRemoteControlInteractive = React.useCallback(async () => {
    if (!isRemoteControlActive || !activeCallAssistant) return;

    const nextState = !isRemoteControlInteractive;
    const eventType = nextState ? 'pause_actor' : 'resume_actor';
    const message = nextState ? 'user is taking over' : 'user is handing back control';

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
    }
  }, [
    isRemoteControlActive,
    isRemoteControlInteractive,
    activeCallAssistant,
    assistantActions.desktop,
  ]);

  React.useEffect(() => {
    const onParticipantConnected = () => {
      setIsWaitingForAssistant(false);
      clearAssistantJoinTimeout();
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      clearAssistantJoinTimeout();
    };
  }, [room, onDisconnected, clearAssistantJoinTimeout]);

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
    connectionError,
    retryConnection,
    // Remote control exports
    isRemoteControlActive,
    liveviewUrl,
    isRemoteControlLoading,
    toggleRemoteControl,
    isRemoteControlInteractive,
    toggleRemoteControlInteractive,
  };
}
