'use client';

import * as React from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { Room, RoomEvent, Track } from 'livekit-client';
import { RoomContext, RoomAudioRenderer, useTrackToggle, useVoiceAssistant, useLocalParticipant, TrackReference, useTracks, useMediaDeviceSelect } from '@livekit/components-react';
import { AssistantCommunicationMainView } from '@/components/Pages/Assistants/Communication/AssistantCommunicationMainView';
import { AssistantCommunicationUserView } from '@/components/Pages/Assistants/Communication/AssistantCommunicationUserView';
import { AssistantCommunicationControls } from '@/components/Pages/Assistants/Communication/AssistantCommunicationControls';
import { AssistantCommunicationSidePanel } from '@/components/Pages/Assistants/Communication/AssistantCommunicationSidePanel';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';

type AssistantActionsSubset = Pick<AssistantActions, "chat" | "call" | "desktop">;

interface AssistantCommunicationFullScreenProps {
    assistant: Assistant;
    assistantActions: AssistantActionsSubset;
    user: {
        id: string;
        image: string | null | undefined;
        email: string | null | undefined;
    };
}

const FullScreenCallUI: React.FC<{
    room: Room;
    assistant: Assistant;
    userImage: string;
    userEmail: string | null | undefined;
    callType: 'video' | 'audio' | null;
    isLoading: boolean;
    loadingMessage: string;
    connectionError: string | null;
    onRetry: () => void;
    assistantActions: AssistantActionsSubset;
    chatHistories: Record<string, ChatMessage[]>;
    setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
}> = ({ room, assistant, userImage, userEmail, callType, isLoading, loadingMessage, connectionError, onRetry, assistantActions, chatHistories, setChatHistories }) => {
    // Standard LiveKit hooks
    const { state: agentState, videoTrack: agentVideoTrack } = useVoiceAssistant();
    const { localParticipant } = useLocalParticipant();
    const micToggle = useTrackToggle({ source: Track.Source.Microphone });
    const camToggle = useTrackToggle({ source: Track.Source.Camera });
    const screenShareToggle = useTrackToggle({ source: Track.Source.ScreenShare });

    const screenShareTracks = useTracks([Track.Source.ScreenShare]);
    const screenShareTrack = screenShareTracks?.[0];

    // UI State
    const [isUserViewVisible, setIsUserViewVisible] = React.useState(true);
    const [isUserViewMaximized, setIsUserViewMaximized] = React.useState(false);
    const [activeSidePanel, setActiveSidePanel] = React.useState<'chat' | 'settings' | null>(null);

    // Device selection state
    const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
    const [selectedVideoDevice, setSelectedVideoDevice] = React.useState<string>('');
    const { devices: audioInputDevices, activeDeviceId: activeAudioInputDeviceId, setActiveMediaDevice: setActiveAudioInputDevice } = useMediaDeviceSelect({ kind: 'audioinput', room });
    const { devices: audioOutputDevices, activeDeviceId: activeAudioOutputDeviceId, setActiveMediaDevice: setActiveAudioOutputDevice } = useMediaDeviceSelect({ kind: 'audiooutput', room });


    React.useEffect(() => {
        const getDevices = async () => {
            const videoDevs = await Room.getLocalDevices('videoinput');
            setVideoDevices(videoDevs);
            const currentCam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
            if (currentCam) {
                const deviceId = await currentCam.getDeviceId();
                setSelectedVideoDevice(deviceId || '');
            }
        };
        if (room.state === 'connected') {
            getDevices();
            navigator.mediaDevices.addEventListener('devicechange', getDevices);
            return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
        }
    }, [room, room.state]);

    const localVideoTrackRef: TrackReference | undefined = React.useMemo(() => {
        const pub = localParticipant.getTrackPublication(Track.Source.Camera);
        if (pub?.isSubscribed && pub.track) {
            return { participant: localParticipant, source: Track.Source.Camera, publication: pub };
        }
        return undefined;
    }, [localParticipant, camToggle.track]);

    const userTrackRef = screenShareTrack || localVideoTrackRef;
    const assistantName = `${assistant.firstName} ${assistant.surname}`;
    const assistantPhoto = assistant.signedProfilePhotoUrl || assistant.profilePhoto;

    return (
        <div className="h-full w-full flex flex-col bg-background text-foreground">
            <div className="flex-1 flex min-h-0 relative">
                <div className="flex-1 flex flex-col items-center justify-center relative bg-background/80">
                    {isUserViewMaximized && userTrackRef ? (
                        <AssistantCommunicationUserView imageUrl={userImage} trackRef={userTrackRef} isCameraOn={camToggle.enabled || screenShareToggle.enabled} participant={localParticipant} onMinimize={() => setIsUserViewMaximized(false)} maximized />
                    ) : (
                        <>
                            <AssistantCommunicationMainView
                                assistantName={assistantName}
                                isSpeaking={agentState === 'speaking'}
                                imageUrl={assistantPhoto}
                                videoTrack={agentVideoTrack}
                                isLoading={isLoading}
                                loadingMessage={loadingMessage}
                                connectionError={connectionError}
                                onRetry={onRetry}
                            />
                            <AnimatePresence>
                                {isUserViewVisible && !isLoading && !connectionError && (
                                    <motion.div key="user-view-pip" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.2 }} className="absolute bottom-4 left-4">
                                        <AssistantCommunicationUserView imageUrl={userImage} trackRef={userTrackRef} isCameraOn={camToggle.enabled || screenShareToggle.enabled} participant={localParticipant} onMinimize={() => setIsUserViewVisible(false)} onMaximize={() => setIsUserViewMaximized(true)} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    )}
                    {!isUserViewMaximized && !isUserViewVisible && !isLoading && !connectionError && (
                         <motion.div key="user-view-minimized" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }} className="absolute bottom-4 left-4">
                             <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger asChild><button onClick={() => setIsUserViewVisible(true)} className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-primary"><Avatar className="h-12 w-12 border-2 border-border"><AvatarImage src={userImage || undefined} alt="Your profile" /><AvatarFallback className="bg-muted text-muted-foreground">U</AvatarFallback></Avatar></button></TooltipTrigger><TooltipContent side="top"><p>Show self-view</p></TooltipContent></Tooltip></TooltipProvider>
                         </motion.div>
                     )}
                </div>

                <AnimatePresence>
                    {activeSidePanel && (
                        <motion.div key="side-panel" initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }} className="h-full flex-shrink-0 overflow-hidden bg-background/95 border-l">
                            <AssistantCommunicationSidePanel
                                panelType={activeSidePanel}
                                onClose={() => setActiveSidePanel(null)}
                                videoDevices={videoDevices} selectedVideoDevice={selectedVideoDevice} onVideoDeviceChange={(id) => room.switchActiveDevice('videoinput', id)}
                                audioInputDevices={audioInputDevices} selectedAudioInputDevice={activeAudioInputDeviceId} onAudioInputDeviceChange={setActiveAudioInputDevice}
                                audioOutputDevices={audioOutputDevices} selectedAudioOutputDevice={activeAudioOutputDeviceId} onAudioOutputDeviceChange={setActiveAudioOutputDevice}
                                callType={callType}
                                assistant={assistant}
                                assistantActions={{ chat: assistantActions.chat }}
                                chatHistories={chatHistories}
                                setChatHistories={setChatHistories}
                                userEmail={userEmail}
                                userImage={userImage}
                                assistantPhoto={assistantPhoto}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <AssistantCommunicationControls
                isMicOn={micToggle.enabled} micButtonProps={micToggle.buttonProps}
                isCameraOn={camToggle.enabled} cameraButtonProps={camToggle.buttonProps}
                isScreenShareOn={screenShareToggle.enabled} onToggleScreenShare={() => screenShareToggle.toggle()} isScreenShareToggleDisabled={screenShareToggle.pending}
                onHangUp={() => room.disconnect()}
                onToggleChat={() => setActiveSidePanel(p => p === 'chat' ? null : 'chat')}
                onToggleSettings={() => setActiveSidePanel(p => p === 'settings' ? null : 'settings')}
                isRemoteControlActive={false} onToggleRemoteControl={() => {}} isRemoteControlLoading={false}
                isRemoteControlInteractive={false} onToggleRemoteControlInteractive={() => {}}
                isConnectionEstablished={room.state === 'connected'}
                callType={callType}
            />
        </div>
    );
};

const AssistantCommunicationFullScreen: React.FC<AssistantCommunicationFullScreenProps> = ({ assistant, assistantActions, user }) => {
    const searchParams = useSearchParams();
    const params = useParams();

    const [callData, setCallData] = React.useState<{
        serverUrl: string | null;
        token: string | null;
        callType: 'video' | 'audio' | null;
        assistantName: string;
        assistantPhoto: string;
        userImage: string;
    } | null>(null);

    const [room] = React.useState(() => new Room());
    const [isConnecting, setIsConnecting] = React.useState(true);
    const [isWaitingForAssistant, setIsWaitingForAssistant] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [chatHistories, setChatHistories] = React.useState<Record<string, ChatMessage[]>>({});

    React.useEffect(() => {
        const dataKey = searchParams.get('dataKey');
        if (!dataKey) {
            setError("Missing call data key. This tab can be closed.");
            setIsConnecting(false);
            return;
        }
        try {
            const storedData = localStorage.getItem(dataKey);
            if (storedData) {
                const data = JSON.parse(storedData);
                setCallData(data);
                localStorage.removeItem(dataKey);
            } else {
                throw new Error("Call data not found in storage.");
            }
        } catch (e: any) {
            setError(e.message || "Failed to read call data. This tab can be closed.");
            setIsConnecting(false);
            if (dataKey) localStorage.removeItem(dataKey);
        }
    }, [searchParams]);

    const connectToRoom = React.useCallback(async () => {
        if (!callData) return;
        const { serverUrl, token, callType } = callData;

        if (!token || !serverUrl) {
            setError("Missing connection details. This tab can be closed.");
            setIsConnecting(false);
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            await room.connect(serverUrl, token);
            await room.localParticipant.setMicrophoneEnabled(true);
            await room.localParticipant.setCameraEnabled(callType === 'video');
            setIsConnecting(false);
            if (room.numParticipants < 2) {
                setIsWaitingForAssistant(true);
            }
        } catch (err) {
            console.error("Failed to connect to LiveKit room in new tab:", err);
            setError("Failed to connect to the call.");
            setIsConnecting(false);
        }
    }, [room, callData]);

    React.useEffect(() => {
        if (callData) {
            connectToRoom();
        }
    }, [callData, connectToRoom]);

    React.useEffect(() => {
        const handleUnload = () => {
            localStorage.removeItem('activePopOutCall');
            window.dispatchEvent(new StorageEvent('storage', { key: 'activePopOutCall', newValue: null }));
        };
        const assistantId = Array.isArray(params.assistantId) ? params.assistantId[0] : params.assistantId;
        if (assistant && assistantId) {
            localStorage.setItem('activePopOutCall', JSON.stringify({ assistantId, assistantName: `${assistant.firstName} ${assistant.surname}` }));
            window.dispatchEvent(new StorageEvent('storage', { key: 'activePopOutCall', newValue: localStorage.getItem('activePopOutCall') }));
        }
        window.addEventListener('beforeunload', handleUnload);

        const onParticipantConnected = () => setIsWaitingForAssistant(false);
        const handleDisconnect = () => window.close();

        room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
        room.on(RoomEvent.Disconnected, handleDisconnect);
        
        // Add ping-pong listener for state verification
        const handlePing = (event: StorageEvent) => {
            if (event.key === 'popOutCallPing' && event.newValue) {
                localStorage.setItem('popOutCallPong', event.newValue);
                setTimeout(() => localStorage.removeItem('popOutCallPong'), 500);
            }
        };

        window.addEventListener('storage', handlePing);

        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            window.removeEventListener('storage', handlePing);
            handleUnload();
            room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
            room.off(RoomEvent.Disconnected, handleDisconnect);
            if (room.state !== 'disconnected') {
                room.disconnect();
            }
        };
    }, [room, assistant, params.assistantId]);

    if (!callData || !assistant) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">Loading call...</p>
            </div>
        );
    }

    const showLoadingState = isConnecting || isWaitingForAssistant;
    const loadingMessage = isConnecting ? "Setting up a connection..." : `Waiting for ${assistant.firstName} to join...`;
    
    return (
        <RoomContext.Provider value={room}>
            <RoomAudioRenderer />
            <FullScreenCallUI
                room={room}
                assistant={assistant}
                userImage={user.image || ''}
                userEmail={user.email}
                callType={callData.callType}
                isLoading={showLoadingState}
                loadingMessage={loadingMessage}
                connectionError={error}
                onRetry={connectToRoom}
                assistantActions={assistantActions}
                chatHistories={chatHistories}
                setChatHistories={setChatHistories}
            />
        </RoomContext.Provider>
    );
};

export default AssistantCommunicationFullScreen;