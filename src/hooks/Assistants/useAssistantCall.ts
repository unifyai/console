import * as React from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { toast } from 'sonner';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ConnectionDetails } from '@/types/assistants/call';

const ASSISTANT_JOIN_TIMEOUT = 60000; // 60 seconds

export function useAssistantCall(
    room: Room,
    assistantActions: AssistantActions
) {
    const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [isConnected, setIsConnected] = React.useState(false);
    const [isConnecting, setIsConnecting] = React.useState(false);
    const [activeCallAssistant, setActiveCallAssistant] = React.useState<Assistant | null>(null);
    const [isSpeakerMuted, setIsSpeakerMuted] = React.useState(false);
    const [isWaitingForAssistant, setIsWaitingForAssistant] = React.useState(false);
    const [connectionError, setConnectionError] = React.useState<string | null>(null);
    const assistantJoinTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // --- Remote Control State (Moved from useAssistantDesktop) ---
    const [isRemoteControlActive, setIsRemoteControlActive] = React.useState(false);
    const [liveviewUrl, setLiveviewUrl] = React.useState<string | null>(null);
    const [isRemoteControlLoading, setIsRemoteControlLoading] = React.useState(false);


    const toggleSpeakerMute = React.useCallback(() => {
        setIsSpeakerMuted(prev => !prev);
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
    }, []);

    const onDisconnected = React.useCallback(() => {
        setIsConnected(false);
        setIsConnecting(false);
        setIsWaitingForAssistant(false);
        setConnectionError(null);
        setConnectionDetails(null);
        setActiveCallAssistant(null);
        setIsSpeakerMuted(false);
        stopRemoteControl(); // Clean up remote control state
        clearAssistantJoinTimeout();
    }, [clearAssistantJoinTimeout, stopRemoteControl]);

    const connect = React.useCallback(async (assistant: Assistant) => {
        if (room.state !== 'disconnected') {
            console.warn("[useAssistantCall] Connect called while room is not in disconnected state.");
            return;
        }
        if (!assistant) return;

        setIsConnecting(true);
        setActiveCallAssistant(assistant);
        setError(null);
        setConnectionError(null);
        try {
            const assistantName = `${assistant.first_name}${assistant.surname}`;
            
            // Step 1: Get connection details for the user
            const details = await assistantActions.call.getConnectionDetails(assistant.agent_id, assistantName);
            if ('detail' in details) {
                throw new Error(details.detail || 'Could not get call details.');
            }
            
            const connDetails = details as ConnectionDetails;
            setConnectionDetails(connDetails);

            // Step 2: Dispatch the assistant to join the room
            const dispatchResult = await assistantActions.call.dispatchToCall(assistant.agent_id, assistantName, connDetails.roomName);
            if (dispatchResult.detail) {
                throw new Error(`Failed to dispatch assistant: ${dispatchResult.detail}`);
            }

            // Step 3: Connect the user's client
            await room.connect(connDetails.serverUrl, connDetails.token);
            await room.localParticipant.setMicrophoneEnabled(true);
            await room.localParticipant.setCameraEnabled(true);
            setIsConnected(true);
            setIsConnecting(false); // User is connected, now wait for assistant

            if (room.numParticipants < 2) { // Check if assistant isn't already there
                setIsWaitingForAssistant(true);
                assistantJoinTimeoutRef.current = setTimeout(() => {
                    setConnectionError(`${assistant.first_name} is taking too long to join.`);
                    setIsWaitingForAssistant(false);
                }, ASSISTANT_JOIN_TIMEOUT);
            } else {
                setIsWaitingForAssistant(false); // Assistant was already present
            }

        } catch (e: any) {
            console.error("Failed to connect to LiveKit room", e);
            toast.error(`Failed to start call. Please try again.`);
            setError(`Failed to start call: ${e.message}`);
            setIsConnected(false);
            setActiveCallAssistant(null);
            if (room.state !== 'disconnected') {
                await room.disconnect();
            }
        } finally {
            if (isConnecting) {
                setIsConnecting(false);
            }
        }
    }, [room, assistantActions.call, clearAssistantJoinTimeout, isConnecting]);
    
    const disconnect = React.useCallback(async () => {
        clearAssistantJoinTimeout();
        stopRemoteControl();
        if (room.state !== 'disconnected') {
            await room.disconnect();
        }
    }, [room, clearAssistantJoinTimeout, stopRemoteControl]);

    const retryConnection = React.useCallback(async () => {
        const assistantToRetry = activeCallAssistant;
        if (!assistantToRetry) return;

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
        connect(assistantToRetry);
    }, [activeCallAssistant, room, connect, onDisconnected, clearAssistantJoinTimeout, stopRemoteControl]);

    const toggleRemoteControl = React.useCallback(async () => {
        if (!activeCallAssistant) return;

        if (isRemoteControlActive) {
            stopRemoteControl();
            return;
        }

        setIsRemoteControlLoading(true);
        const toastId = toast.loading("Starting remote control session...");
        
        try {
            const result = await assistantActions.desktop.getLiveviewUrl(activeCallAssistant.agent_id);
            if (result.liveviewUrl) {
                setLiveviewUrl(result.liveviewUrl);
                setIsRemoteControlActive(true);
                toast.success("Remote control session started.", { id: toastId });
            } else {
                 throw new Error("Could not retrieve session URL.");
            }
        } catch (e: any) {
            console.error("[useAssistantCall] Toggle remote control failed:", e.message);
            toast.error("Could not start remote control session. Please try again.", { id: toastId });
        } finally {
            setIsRemoteControlLoading(false);
        }
    }, [isRemoteControlActive, stopRemoteControl, assistantActions.desktop, activeCallAssistant]);
    
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

    return {
        room,
        error,
        isConnected,
        isConnecting,
        activeCallAssistant,
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
    };
}
