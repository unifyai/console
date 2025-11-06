'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { VideoTrack, TrackReference } from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface AssistantCommunicationMainViewProps {
    assistantName: string;
    isSpeaking: boolean;
    imageUrl: string | null | undefined;
    videoTrack?: TrackReference;
    className?: string;
    isRemoteControlActive?: boolean;
    remoteControlUrl?: string | null;
    avatarContainerClassName?: string;
}

export function AssistantCommunicationMainView({
    assistantName,
    isSpeaking,
    imageUrl,
    videoTrack,
    className,
    isRemoteControlActive = false,
    remoteControlUrl = null,
    avatarContainerClassName,
}: AssistantCommunicationMainViewProps) {
    const fallback = assistantName ? `${assistantName.split(' ')?.[0]?.[0] ?? ''}${assistantName.split(' ')?.[1]?.[0] ?? ''}`.toUpperCase() : "A";

    if (isRemoteControlActive) {
        return (
            <div className="w-full h-full bg-black flex items-center justify-center">
                {remoteControlUrl ? (
                    <iframe
                        src={remoteControlUrl}
                        className="w-full h-full border-0"
                        title="Assistant Remote Desktop"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span>Loading session...</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={cn("relative flex flex-col items-center justify-center text-center", className || "w-48 h-48")}>
            {/* Pulsating Circle */}
            <div className={`absolute w-full h-full rounded-full border-2 border-primary transition-all duration-300 ${isSpeaking ? 'animate-pulse scale-110' : 'scale-100 opacity-50'}`} />
            <div className={`absolute w-[90%] h-[90%] rounded-full bg-primary/10 transition-all duration-300 ${isSpeaking ? 'animate-pulse' : ''}`} />

            {/* Video or Avatar */}
            <div className={cn("z-10 border-4 border-background rounded-full overflow-hidden flex items-center justify-center", avatarContainerClassName || "w-32 h-32")}>
                {videoTrack && videoTrack.publication && videoTrack.publication.isSubscribed && videoTrack.publication.track?.kind === 'video' ? (
                    <VideoTrack trackRef={videoTrack} className="w-full h-full object-cover" />
                ) : (
                    <Avatar className="w-full h-full">
                        <AvatarImage src={imageUrl ?? undefined} alt={assistantName} />
                        <AvatarFallback className="bg-muted text-4xl text-muted-foreground">
                            {fallback}
                        </AvatarFallback>
                    </Avatar>
                )}
            </div>
        </div>
    );
}
