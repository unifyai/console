'use client';

import * as React from 'react';
import { Dialog, DialogContent } from "@/components/UI/dialog";
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { AssistantCommunicationHeader } from './AssistantCommunicationHeader';
import { AssistantCommunicationMainView } from './AssistantCommunicationMainView';
import { AssistantCommunicationUserView } from './AssistantCommunicationUserView';
import { AssistantCommunicationControls } from './AssistantCommunicationControls';
import { AssistantCommunicationSidePanel } from './AssistantCommunicationSidePanel';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { RoomAudioRenderer, RoomContext, useTrackToggle, useVoiceAssistant, useLocalParticipant, TrackReference, useTracks, useMediaDeviceSelect } from '@livekit/components-react';
import { Room, Track } from 'livekit-client';
import { ChatMessage } from '@/types/assistants/chat';
import { Loader2, AlertTriangle } from 'lucide-react';
import { User } from 'next-auth';
import { Button } from '@/components/UI/button';

interface AssistantCommunicationDialogContentProps {
    assistant: Assistant;
    onHangUp: () => void;
    onMinimize: () => void;
    chatHistories: Record<string, ChatMessage[]>;
    setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
    assistantActions: AssistantActions;
    isConnecting: boolean;
    userImage: string | null | undefined;
    isWaitingForAssistant: boolean;
    connectionError: string | null;
    onRetry: () => void;
    isRemoteControlActive: boolean;
    liveviewUrl: string | null;
    isRemoteControlLoading: boolean;
    toggleRemoteControl: () => void;
    isCallConnected: boolean;
}

const AssistantCommunicationDialogContent: React.FC<AssistantCommunicationDialogContentProps> = ({ 
    assistant, 
    onHangUp, 
    onMinimize, 
    chatHistories, 
    setChatHistories, 
    assistantActions, 
    isConnecting, 
    userImage, 
    isWaitingForAssistant, 
    connectionError, 
    onRetry,
    isRemoteControlActive,
    liveviewUrl,
    isRemoteControlLoading,
    toggleRemoteControl,
    isCallConnected,
}) => {
    const room = React.useContext(RoomContext);
    if (!room) throw new Error("AssistantCommunicationDialogContent must be used within a RoomContext");

    const { state: agentState, videoTrack: agentVideoTrack } = useVoiceAssistant();
    const { localParticipant } = useLocalParticipant();
    const micToggle = useTrackToggle({ source: Track.Source.Microphone });
    const camToggle = useTrackToggle({ source: Track.Source.Camera });
    const screenShareToggle = useTrackToggle({ source: Track.Source.ScreenShare });

    const screenShareTracks = useTracks([Track.Source.ScreenShare]);
    const screenShareTrack = screenShareTracks?.[0];

    const [isUserViewVisible, setIsUserViewVisible] = React.useState(true);
    const [isUserViewMaximized, setIsUserViewMaximized] = React.useState(false);
    const [activeSidePanel, setActiveSidePanel] = React.useState<'chat' | 'settings' | 'transcriptions' | null>(null);

    const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
    const [selectedVideoDevice, setSelectedVideoDevice] = React.useState<string>('');

    const { devices: audioInputDevices, activeDeviceId: activeAudioInputDeviceId, setActiveMediaDevice: setActiveAudioInputDevice } = useMediaDeviceSelect({
        kind: 'audioinput',
        room: room,
    });
    const { devices: audioOutputDevices, activeDeviceId: activeAudioOutputDeviceId, setActiveMediaDevice: setActiveAudioOutputDevice } = useMediaDeviceSelect({
        kind: 'audiooutput',
        room: room,
    });

    React.useEffect(() => {
        if (!isCallConnected) return;
        const getDevices = async () => {
            const videoDevs = await Room.getLocalDevices('videoinput');
            const audioDevs = await Room.getLocalDevices('audioinput');
            setVideoDevices(videoDevs);
            const currentCam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
            if (currentCam) {
                const deviceId = await currentCam.getDeviceId();
                setSelectedVideoDevice(deviceId || '');
            }
        };
        getDevices();
        
        const handleDevicesChanged = () => getDevices();
        navigator.mediaDevices.addEventListener('devicechange', handleDevicesChanged);
        return () => navigator.mediaDevices.removeEventListener('devicechange', handleDevicesChanged);
    }, [room, isCallConnected]);

    const handleVideoDeviceChange = async (deviceId: string) => {
        setSelectedVideoDevice(deviceId);
        await room.switchActiveDevice('videoinput', deviceId);
    }

    const handleAudioInputDeviceChange = async (deviceId: string) => {
        await room.switchActiveDevice('audioinput', deviceId);
        setActiveAudioInputDevice(deviceId);
    }
    
    const handleAudioOutputDeviceChange = async (deviceId: string) => {
        await room.switchActiveDevice('audiooutput', deviceId);
        setActiveAudioOutputDevice(deviceId);
    }
    
    const localVideoTrackRef: TrackReference | undefined = React.useMemo(() => {
        const pub = localParticipant.getTrackPublication(Track.Source.Camera);
        if (pub?.isSubscribed && pub.track) {
            return { participant: localParticipant, source: Track.Source.Camera, publication: pub };
        }
        return undefined;
    }, [localParticipant, camToggle.track]);
    
    const userTrackRef = screenShareTrack || localVideoTrackRef;
    const displayName = `${assistant.first_name} ${assistant.surname}`;
    const assistantPhoto = assistant.signedProfilePhotoUrl || assistant.profile_photo;

    const handleToggleSidePanel = (panel: 'chat' | 'settings' | 'transcriptions') => {
        setActiveSidePanel(current => current === panel ? null : panel);
    };

    const showLoadingState = isConnecting || isWaitingForAssistant;
    const loadingMessage = isConnecting
        ? "Setting up a connection..."
        : `Waiting for ${assistant.first_name} to join...`;

    return (
        <>
            <AssistantCommunicationHeader assistantName={displayName} onMinimize={onMinimize} />
            <div className="flex-1 flex min-h-0 relative">
                <div className="flex-1 flex flex-col items-center justify-center relative bg-background/80">
                    {isUserViewMaximized && userTrackRef ? (
                        <AssistantCommunicationUserView
                            imageUrl={userImage}
                            trackRef={userTrackRef}
                            isCameraOn={camToggle.enabled || screenShareToggle.enabled}
                            participant={localParticipant}
                            onMinimize={() => setIsUserViewMaximized(false)}
                            maximized
                        />
                    ) : (
                        <>
                            <AssistantCommunicationMainView
                                assistantName={displayName}
                                isSpeaking={agentState === 'speaking'}
                                imageUrl={assistantPhoto}
                                videoTrack={agentVideoTrack}
                                isRemoteControlActive={isRemoteControlActive}
                                remoteControlUrl={liveviewUrl}
                                isLoading={showLoadingState}
                                loadingMessage={loadingMessage}
                                connectionError={connectionError}
                                onRetry={onRetry}
                            />
                            <AnimatePresence>
                                {isUserViewVisible && !isConnecting && (
                                    <motion.div
                                        key="user-view-pip" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                                        transition={{ duration: 0.2 }} className="absolute bottom-4 left-4"
                                    >
                                        <AssistantCommunicationUserView
                                            imageUrl={userImage}
                                            trackRef={userTrackRef}
                                            isCameraOn={camToggle.enabled || screenShareToggle.enabled}
                                            participant={localParticipant}
                                            onMinimize={() => setIsUserViewVisible(false)}
                                            onMaximize={() => setIsUserViewMaximized(true)}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    )}
                     {!isUserViewMaximized && !isUserViewVisible && !isConnecting && (
                         <motion.div
                             key="user-view-minimized" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                             transition={{ duration: 0.2 }} className="absolute bottom-4 left-4"
                         >
                             <TooltipProvider delayDuration={100}>
                                 <Tooltip>
                                     <TooltipTrigger asChild>
                                         <button onClick={() => setIsUserViewVisible(true)} className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-primary">
                                             <Avatar className="h-12 w-12 border-2 border-border">
                                                 <AvatarImage src={userImage || undefined} alt="Your profile" />
                                                 <AvatarFallback className="bg-muted text-muted-foreground">U</AvatarFallback>
                                             </Avatar>
                                         </button>
                                     </TooltipTrigger>
                                     <TooltipContent side="top"><p>Show self-view</p></TooltipContent>
                                 </Tooltip>
                             </TooltipProvider>
                         </motion.div>
                     )}
                </div>

                <AnimatePresence>
                    {activeSidePanel && (
                        <motion.div
                            key="side-panel" initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                            transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }} className="h-full flex-shrink-0 overflow-hidden bg-background/95 border-l"
                        >
                            <AssistantCommunicationSidePanel
                                panelType={activeSidePanel}
                                onClose={() => setActiveSidePanel(null)}
                                videoDevices={videoDevices}
                                selectedVideoDevice={selectedVideoDevice}
                                onVideoDeviceChange={handleVideoDeviceChange}
                                audioInputDevices={audioInputDevices}
                                selectedAudioInputDevice={activeAudioInputDeviceId}
                                onAudioInputDeviceChange={handleAudioInputDeviceChange}
                                audioOutputDevices={audioOutputDevices}
                                selectedAudioOutputDevice={activeAudioOutputDeviceId}
                                onAudioOutputDeviceChange={handleAudioOutputDeviceChange}
                                assistant={assistant}
                                assistantActions={assistantActions}
                                chatHistories={chatHistories}
                                setChatHistories={setChatHistories}
                                userImage={userImage}
                                assistantPhoto={assistantPhoto}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <AssistantCommunicationControls
                isMicOn={micToggle.enabled}
                micButtonProps={micToggle.buttonProps}
                isCameraOn={camToggle.enabled}
                cameraButtonProps={camToggle.buttonProps}
                isScreenShareOn={screenShareToggle.enabled}
                onToggleScreenShare={() => screenShareToggle.toggle()}
                isScreenShareToggleDisabled={screenShareToggle.pending}
                onHangUp={onHangUp}
                onToggleChat={() => handleToggleSidePanel('chat')}
                onToggleSettings={() => handleToggleSidePanel('settings')}
                onToggleTranscriptions={() => handleToggleSidePanel('transcriptions')}
                isRemoteControlActive={isRemoteControlActive}
                isRemoteControlLoading={isRemoteControlLoading}
                onToggleRemoteControl={toggleRemoteControl}
                isConnectionEstablished={isCallConnected}
            />
        </>
    );
};

interface AssistantCommunicationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onMinimize: () => void;
    assistant: Assistant;
    assistantActions: AssistantActions;
    room: Room;
    chatHistories: Record<string, ChatMessage[]>;
    setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
    isConnecting: boolean;
    userImage: string | null | undefined;
    isWaitingForAssistant: boolean;
    connectionError: string | null;
    onRetry: () => void;
    isRemoteControlActive: boolean;
    liveviewUrl: string | null;
    isRemoteControlLoading: boolean;
    toggleRemoteControl: () => void;
    isCallConnected: boolean;
}

export function AssistantCommunicationDialog({
    isOpen,
    onClose,
    onMinimize,
    assistant,
    assistantActions,
    room,
    chatHistories,
    setChatHistories,
    isConnecting,
    userImage,
    isWaitingForAssistant,
    connectionError,
    onRetry,
    isRemoteControlActive,
    liveviewUrl,
    isRemoteControlLoading,
    toggleRemoteControl,
    isCallConnected,
}: AssistantCommunicationDialogProps) {

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onMinimize()}>
            <DialogContent
                className="max-w-4xl w-[90vw] h-[90vh] flex flex-col p-0 gap-0 bg-background text-foreground border"
                hideClose
            >
                <RoomAudioRenderer />
                <AssistantCommunicationDialogContent
                    assistant={assistant}
                    onHangUp={onClose}
                    onMinimize={onMinimize}
                    chatHistories={chatHistories}
                    setChatHistories={setChatHistories}
                    assistantActions={assistantActions}
                    isConnecting={isConnecting}
                    userImage={userImage}
                    isWaitingForAssistant={isWaitingForAssistant}
                    connectionError={connectionError}
                    onRetry={onRetry}
                    isRemoteControlActive={isRemoteControlActive}
                    liveviewUrl={liveviewUrl}
                    isRemoteControlLoading={isRemoteControlLoading}
                    toggleRemoteControl={toggleRemoteControl}
                    isCallConnected={isCallConnected}
                />
            </DialogContent>
        </Dialog>
    );
}