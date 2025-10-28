'use client';

import * as React from 'react';
import { Minus, User, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { VideoTrack, TrackReference, useIsSpeaking } from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { cn } from '@/lib/utils';

interface AssistantCommunicationUserViewProps {
    imageUrl: string | null | undefined;
    trackRef?: TrackReference;
    isCameraOn: boolean;
    participant: Participant;
    onMinimize: () => void;
    onMaximize?: () => void;
    maximized?: boolean;
}

export function AssistantCommunicationUserView({ imageUrl, trackRef, isCameraOn, participant, onMinimize, onMaximize, maximized = false }: AssistantCommunicationUserViewProps) {
    const isSpeaking = useIsSpeaking(participant);

    if (maximized) {
        return (
             <div className="w-full h-full bg-black rounded-lg relative group">
                {isCameraOn && trackRef ? (
                    <VideoTrack trackRef={trackRef} className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No video feed available.
                    </div>
                )}
                <TooltipProvider delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost" size="icon"
                                className="absolute top-2 right-2 h-7 w-7 text-white bg-black/30 hover:bg-black/60"
                                onClick={onMinimize}
                            >
                                <Minimize className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Minimize view</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        )
    }

    return (
        <div className={cn("w-48 h-32 bg-muted rounded-lg shadow-2xl border overflow-hidden relative group transition-all duration-300", isSpeaking && "ring-2 ring-offset-2 ring-offset-background ring-primary")}>
            <div className="w-full h-full flex items-center justify-center">
                {isCameraOn && trackRef ? (
                    <VideoTrack
                        trackRef={trackRef}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <Avatar className="w-full h-full rounded-none">
                        <AvatarImage src={imageUrl ?? undefined} alt="Your video feed" className="object-cover" />
                        <AvatarFallback className="bg-muted text-muted-foreground rounded-none text-3xl">
                            <User className="w-10 h-10" />
                        </AvatarFallback>
                    </Avatar>
                )}
            </div>
            <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <TooltipProvider delayDuration={100}>
                    {onMaximize && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost" size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-background/50"
                                    onClick={onMaximize}
                                >
                                    <Maximize className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>Maximize</p></TooltipContent>
                        </Tooltip>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-background/50"
                                onClick={onMinimize}
                            >
                                <Minus className="h-3 w-3" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p>Minimize self-view</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}
