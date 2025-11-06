'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { VideoTrack, TrackReference } from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/UI/button';

interface AssistantCommunicationMainViewProps {
    assistantName: string;
    isSpeaking: boolean;
    imageUrl: string | null | undefined;
    videoTrack?: TrackReference;
    className?: string;
    isRemoteControlActive?: boolean;
    remoteControlUrl?: string | null;
    avatarContainerClassName?: string;
    isLoading?: boolean;
    loadingMessage?: string;
    connectionError?: string | null;
    onRetry?: () => void;
    isInteractive?: boolean;
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
    isLoading = false,
    loadingMessage = "Connecting...",
    connectionError,
    onRetry,
    isInteractive = false,
}: AssistantCommunicationMainViewProps) {
    const fallback = assistantName ? `${assistantName.split(' ')?.[0]?.[0] ?? ''}${assistantName.split(' ')?.[1]?.[0] ?? ''}`.toUpperCase() : "A";

    if (isLoading) {
        return (
            <div className={cn("flex flex-col items-center justify-center text-center p-4", className)}>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">{loadingMessage}</p>
            </div>
        );
    }
    
    if (connectionError) {
        return (
            <div className="flex flex-col items-center justify-center p-4 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive mb-4" />
                <h3 className="text-lg font-semibold text-foreground">Connection Issue</h3>
                <p className="mt-2 text-body text-muted-foreground">{connectionError}</p>
                {onRetry && (
                     <div className="mt-6">
                        <Button onClick={onRetry}>Retry</Button>
                    </div>
                )}
            </div>
        );
    }

    if (isRemoteControlActive) {
        return (
            <div className="w-full h-full bg-black flex items-center justify-center relative">
                {remoteControlUrl ? (
                    <>
                        <iframe
                            src={remoteControlUrl}
                            className="w-full h-full border-0"
                            title="Assistant Remote Desktop"
                        />
                        {/* Add overlay to block pointer events when not interactive */}
                        {!isInteractive && (
                            <div className="absolute inset-0 bg-transparent cursor-not-allowed" title="Enable interactive mode to take control" />
                        )}
                    </>
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
            <div className={`absolute h-full aspect-square rounded-full border-2 border-primary transition-all duration-300 ${isSpeaking ? 'animate-pulse scale-110' : 'scale-100 opacity-50'}`} />
            <div className={`absolute h-[90%] aspect-square rounded-full bg-primary/10 transition-all duration-300 ${isSpeaking ? 'animate-pulse' : ''}`} />

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