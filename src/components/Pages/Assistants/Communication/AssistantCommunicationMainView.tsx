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
  loadingMessage = 'Connecting...',
  connectionError,
  onRetry,
  isInteractive = false,
}: AssistantCommunicationMainViewProps) {
  const fallback = assistantName
    ? `${assistantName.split(' ')?.[0]?.[0] ?? ''}${assistantName.split(' ')?.[1]?.[0] ?? ''}`.toUpperCase()
    : 'A';

  if (isLoading) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-4 text-center', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-body-muted mt-4">{loadingMessage}</p>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="mb-4 h-8 w-8 text-destructive" />
        <h3 className="text-h2 text-semibold text-foreground">Connection Issue</h3>
        <p className="text-body mt-2 text-muted-foreground">{connectionError}</p>
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
      <div className="relative flex h-full w-full items-center justify-center bg-black">
        {remoteControlUrl ? (
          <>
            <iframe
              src={remoteControlUrl}
              className="h-full w-full border-0"
              title="Assistant Remote Desktop"
              allow="autoplay; camera; microphone; display-capture; clipboard-write; clipboard-read; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer"
            />
            {/* Add overlay to block pointer events when not interactive */}
            {!isInteractive && (
              <div
                className="absolute inset-0 cursor-not-allowed bg-transparent"
                title="Enable interactive mode to take control"
              />
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
    <div
      className={cn(
        'relative flex flex-col items-center justify-center text-center',
        className || 'h-48 w-48'
      )}
    >
      {/* Pulsating Circle */}
      <div
        className={`absolute aspect-square h-full rounded-full border-2 border-primary transition-all duration-300 ${isSpeaking ? 'scale-110 animate-pulse' : 'scale-100 opacity-50'}`}
      />
      <div
        className={`bg-primary/10 absolute aspect-square h-[90%] rounded-full transition-all duration-300 ${isSpeaking ? 'animate-pulse' : ''}`}
      />

      {/* Video or Avatar */}
      <div
        className={cn(
          'z-10 flex items-center justify-center overflow-hidden rounded-full border-4 border-background',
          avatarContainerClassName || 'h-32 w-32'
        )}
      >
        {videoTrack &&
        videoTrack.publication &&
        videoTrack.publication.isSubscribed &&
        videoTrack.publication.track?.kind === 'video' ? (
          <VideoTrack trackRef={videoTrack} className="h-full w-full object-cover" />
        ) : (
          <Avatar className="h-full w-full">
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
