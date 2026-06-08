'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { VideoTrack, TrackReference } from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { Loader2, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';
import { TeammateCreature } from '@/components/Brand';
import type { CreatureEyes } from '@/components/Brand/TeammateCreature';
import {
  clampMartianSpeechLevel,
  getMartianSpeechTransform,
  getSpeakingEyes,
} from '@/utils/assistants/martian-animation';

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
  isCallActive?: boolean;
  isUserSpeaking?: boolean;
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
  isCallActive = false,
  isUserSpeaking = false,
}: AssistantCommunicationMainViewProps) {
  const fallback = assistantName
    ? `${assistantName.split(' ')?.[0]?.[0] ?? ''}${assistantName.split(' ')?.[1]?.[0] ?? ''}`.toUpperCase()
    : 'A';
  const baseEyes = 'up' satisfies CreatureEyes;
  const [eyeFrame, setEyeFrame] = React.useState(0);
  const [speechLevel, setSpeechLevel] = React.useState(0);
  const [isMartianHovered, setIsMartianHovered] = React.useState(false);
  const shouldAnimateCreatureEyes = isSpeaking && !isLoading && !connectionError;
  const displayedCreatureEyes = isMartianHovered
    ? 'square'
    : shouldAnimateCreatureEyes
      ? getSpeakingEyes(baseEyes, eyeFrame)
      : isCallActive || isUserSpeaking
        ? 'square'
        : baseEyes;
  const animatedVisualStyle = {
    '--martian-speech-level': speechLevel.toFixed(3),
    transform: getMartianSpeechTransform(speechLevel),
  } as React.CSSProperties;

  React.useEffect(() => {
    if (!shouldAnimateCreatureEyes) {
      setEyeFrame(0);
      return;
    }

    const eyeTimer = window.setInterval(() => {
      setEyeFrame((current) => (current + 1) % 4);
    }, 2000);

    return () => window.clearInterval(eyeTimer);
  }, [shouldAnimateCreatureEyes]);

  React.useEffect(() => {
    if (!isSpeaking) {
      setSpeechLevel(0);
      return;
    }

    let frame = 0;
    setSpeechLevel(0.65);
    const speechTimer = window.setInterval(() => {
      frame += 1;
      setSpeechLevel(clampMartianSpeechLevel(0.24 + Math.abs(Math.sin(frame * 0.82)) * 0.76));
    }, 80);

    return () => window.clearInterval(speechTimer);
  }, [isSpeaking]);

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
              <CoordinatorLogoAvatar className="h-full w-full" logoClassName="h-[70%] w-[70%]" />
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
      <div className="relative flex items-center justify-center">
        {/* Video or Avatar */}
        <div
          className={cn(
            'z-10 flex items-center justify-center overflow-visible transition-transform duration-75',
            avatarContainerClassName || 'h-32 w-32'
          )}
          onMouseEnter={() => setIsMartianHovered(true)}
          onMouseLeave={() => setIsMartianHovered(false)}
        >
          {videoTrack &&
          videoTrack.publication &&
          videoTrack.publication.isSubscribed &&
          videoTrack.publication.track?.kind === 'video' ? (
            <VideoTrack trackRef={videoTrack} className="h-full w-full object-cover" />
          ) : (
            <>
              {isCoordinator ? (
                <span
                  className="flex h-full w-full items-center justify-center overflow-visible"
                  style={animatedVisualStyle}
                >
                  <TeammateCreature
                    className="h-full w-full"
                    eyes={displayedCreatureEyes}
                    label="Unity"
                  />
                </span>
              ) : (
                <Avatar className="h-full w-full" style={animatedVisualStyle}>
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
