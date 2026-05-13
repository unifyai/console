'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { VideoTrack, TrackReference } from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { Loader2, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';

interface AssistantCommunicationMainViewProps {
  assistantName: string;
  isCoordinator?: boolean;
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
  isRingMuted?: boolean;
  onToggleRingMute?: () => void;
}

export function AssistantCommunicationMainView({
  assistantName,
  isCoordinator = false,
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
  isRingMuted = false,
  onToggleRingMute,
}: AssistantCommunicationMainViewProps) {
  const fallback = assistantName
    ? `${assistantName.split(' ')?.[0]?.[0] ?? ''}${assistantName.split(' ')?.[1]?.[0] ?? ''}`.toUpperCase()
    : 'A';

  if (isLoading) {
    const spinnerSize = avatarContainerClassName || 'h-32 w-32';
    return (
      <div className={cn('flex flex-col items-center justify-center p-4 text-center', className)}>
        <div className="relative flex items-center justify-center">
          <svg
            className={cn('absolute text-primary', spinnerSize, 'scale-[1.15]')}
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="72 217"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                values="0 50 50;360 50 50"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
          <div
            className={cn(
              'z-10 flex items-center justify-center overflow-hidden rounded-full border-4 border-background',
              spinnerSize
            )}
          >
            {isCoordinator ? (
              <CoordinatorLogoAvatar
                className="h-full w-full rounded-full border-0 bg-muted text-primary shadow-none"
                logoClassName="h-[45%] w-[45%]"
              />
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
        <p className="text-body-muted mt-4">{loadingMessage}</p>
        {onToggleRingMute && (
          <button
            onClick={onToggleRingMute}
            className="mt-3 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={isRingMuted ? 'Unmute ring tone' : 'Mute ring tone'}
          >
            {isRingMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        )}
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
        'flex flex-col items-center justify-center text-center',
        className || 'h-48 w-48'
      )}
    >
      {/* Inner container: sized to avatar + margin, constrains the pulsating circles */}
      <div className="relative flex items-center justify-center">
        {/* Pulsating Circle — sized relative to avatar, not the outer container */}
        <div
          className={cn(
            'absolute aspect-square rounded-full border-2 border-primary transition-all duration-300',
            avatarContainerClassName || 'h-32 w-32',
            isSpeaking ? 'scale-[1.25] animate-pulse' : 'scale-[1.15] opacity-50'
          )}
        />
        <div
          className={cn(
            'bg-primary/10 absolute aspect-square rounded-full transition-all duration-300',
            avatarContainerClassName || 'h-32 w-32',
            isSpeaking ? 'scale-[1.1] animate-pulse' : 'scale-105'
          )}
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
            <>
              {isCoordinator ? (
                <CoordinatorLogoAvatar
                  className="h-full w-full rounded-full border-0 bg-muted text-primary shadow-none"
                  logoClassName="h-[45%] w-[45%]"
                />
              ) : (
                <Avatar className="h-full w-full">
                  <AvatarImage src={imageUrl ?? undefined} alt={assistantName} />
                  <AvatarFallback className="bg-muted text-4xl text-muted-foreground">
                    {fallback}
                  </AvatarFallback>
                </Avatar>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
