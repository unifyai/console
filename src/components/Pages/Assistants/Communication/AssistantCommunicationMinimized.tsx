'use client';

import * as React from 'react';
import {
    PhoneOff,
    Mic,
    MicOff,
    Video,
    VideoOff,
    Maximize2,
    Volume2,
    VolumeX,
    AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Assistant } from '@/types/assistants/assistant';
import { Track, Room } from 'livekit-client';
import { RoomContext, useTrackToggle, useVoiceAssistant } from '@livekit/components-react';
import { AssistantCommunicationMainView } from './AssistantCommunicationMainView';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface AssistantCommunicationMinimizedProps {
    assistant: Assistant;
    room: Room;
    onHangUp: () => void;
    onExpand: () => void;
    isSpeakerMuted: boolean;
    onToggleSpeaker: () => void;
    isConnecting: boolean;
    isWaitingForAssistant: boolean;
    connectionError: string | null;
    onRetry: () => void;
    isCallConnected: boolean;
    callType: 'video' | 'audio' | null;
}

const ControlButton: React.FC<{ tooltip: string; children: React.ReactNode; className?: string; [key: string]: any; }> =
    ({ tooltip, children, className, ...props }) => (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {/* This span allows hover events for the tooltip even when the button is disabled. */}
                    <span>
                        <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-full bg-black/20 hover:bg-black/40 text-white", className)} onPointerDown={(e) => e.stopPropagation()} aria-label={tooltip} {...props}>
                            {children}
                        </Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );


const MinimizedContent: React.FC<Omit<AssistantCommunicationMinimizedProps, 'room'>> = ({ assistant, onHangUp, onExpand, isSpeakerMuted, onToggleSpeaker, isConnecting, isWaitingForAssistant, connectionError, onRetry, isCallConnected, callType }) => {
    const { state: agentState, videoTrack: agentVideoTrack } = useVoiceAssistant();
    const micToggle = useTrackToggle({ source: Track.Source.Microphone });
    const camToggle = useTrackToggle({ source: Track.Source.Camera });

    const displayName = `${assistant.first_name} ${assistant.surname}`;
    const assistantPhoto = assistant.signedProfilePhotoUrl || assistant.profile_photo;
    const showLoadingState = isConnecting || isWaitingForAssistant;
    const loadingMessage = isConnecting ? "Connecting..." : `Waiting for ${assistant.first_name}...`;

    if (connectionError) {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full text-center relative p-2">
                <AlertTriangle className="h-4 w-4 text-destructive mb-1" />
                <p className="text-xs text-muted-foreground mb-1.5 px-1 text-center">{connectionError}</p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onHangUp(); }} className="h-7" onPointerDown={(e) => e.stopPropagation()}>Leave</Button>
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); onRetry(); }} className="h-7" onPointerDown={(e) => e.stopPropagation()}>Retry</Button>
                </div>
                {/* Expand Button */}
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ControlButton tooltip="Expand View" onClick={onExpand}>
                        <Maximize2 className="h-4 w-4" />
                    </ControlButton>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Main View */}
            <AssistantCommunicationMainView
                className="w-full h-full mb-3 flex-1"
                avatarContainerClassName="w-20 h-20"
                assistantName={displayName}
                isSpeaking={agentState === 'speaking'}
                imageUrl={assistantPhoto}
                videoTrack={agentVideoTrack}
                isLoading={showLoadingState}
                loadingMessage={loadingMessage}
            />

            {/* Controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <ControlButton tooltip="Hang Up" className="bg-destructive hover:bg-destructive" onClick={onHangUp}>
                    <PhoneOff className="h-4 w-4" />
                </ControlButton>
                <ControlButton 
                    tooltip={!isCallConnected ? "Available after connecting" : (micToggle.enabled ? "Mute Mic" : "Unmute Mic")} 
                    {...micToggle.buttonProps}
                    disabled={!isCallConnected || micToggle.buttonProps.disabled} 
                >
                    {micToggle.enabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </ControlButton>
                <ControlButton 
                    tooltip={!isCallConnected ? "Available after connecting" : (isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker")} 
                    onClick={onToggleSpeaker}
                    disabled={!isCallConnected}
                >
                    {isSpeakerMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </ControlButton>
                <ControlButton 
                    tooltip={!isCallConnected ? "Available after connecting" : (camToggle.enabled ? "Turn Off Camera" : "Turn On Camera")}
                    {...camToggle.buttonProps}
                    disabled={!isCallConnected || camToggle.buttonProps.disabled} 
                >
                    {camToggle.enabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </ControlButton>
            </div>
             {/* Expand Button */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <ControlButton tooltip="Expand View" onClick={onExpand}>
                    <Maximize2 className="h-4 w-4" />
                </ControlButton>
            </div>
        </>
    );
};


export function AssistantCommunicationMinimized(props: AssistantCommunicationMinimizedProps) {
    return (
        <motion.div
            drag
            dragMomentum={false}
            whileDrag={{ scale: 1.02 }}
            className="fixed bottom-5 right-5 z-50 w-64 h-48 bg-background/80 backdrop-blur-md border rounded-lg shadow-2xl flex flex-col items-center justify-center p-4 group cursor-grab active:cursor-grabbing"
        >
            <RoomContext.Provider value={props.room}>
                <MinimizedContent {...props} />
            </RoomContext.Provider>
        </motion.div>
    );
}