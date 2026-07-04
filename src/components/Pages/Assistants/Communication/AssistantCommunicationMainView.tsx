'use client';

import * as React from 'react';
import { VideoTrack, TrackReference } from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import { Button } from '@/components/UI/button';
import { UnityCallAvatar } from '@/components/Pages/Assistants/Communication/UnityCallAvatar';
import { parseCreatureSentinel } from '@/components/Brand';
import { useUnityAudioLipsync } from '@/hooks/Assistants/useUnityAudioLipsync';
import { useHeldFlag } from '@/hooks/Assistants/useHeldFlag';
import type { CreatureMood, CreatureMouthShape } from '@/components/Brand/TeammateCreature';

type BrowserWindowWithCoordinatorIntroAudio = Window & {
  __coordinatorOnboardingIntroAudio?: HTMLAudioElement;
  __coordinatorOnboardingIntroSpeechLevel?: number;
  __coordinatorOnboardingIntroMouthShape?: CreatureMouthShape;
};

interface AssistantCommunicationMainViewProps {
  assistantName: string;
  isCoordinator?: boolean;
  isSpeaking: boolean;
  imageUrl: string | null | undefined;
  audioTrack?: TrackReference;
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
  /** Whether the assistant has an in-flight `act`; drives the droid's
   *  "working on a laptop" pose. */
  isActing?: boolean;
  isUserSpeaking?: boolean;
  mood?: CreatureMood;
  /** Fade the coordinator unity in when it first mounts in the docked call. */
  coordinatorTeleportIn?: boolean;
  /** Keeps the coordinator's slot empty until the onboarding layout has landed. */
  coordinatorAvatarVisible?: boolean;
}

export function AssistantCommunicationMainView({
  assistantName,
  isCoordinator = false,
  isSpeaking,
  imageUrl,
  audioTrack,
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
  isActing = false,
  isUserSpeaking = false,
  mood = 'happy',
  coordinatorAvatarVisible = true,
  coordinatorTeleportIn = false,
}: AssistantCommunicationMainViewProps) {
  // Every droid carries an `appearance://` sentinel that reconstructs its
  // animated creature; the call window always renders that creature through the
  // shared `UnityCallAvatar`, identical to the coordinator (T-W1N) treatment.
  const creatureAppearance = parseCreatureSentinel(imageUrl);
  const [isIntroAudioPlaying, setIsIntroAudioPlaying] = React.useState(false);
  const [introAudioSpeechLevel, setIntroAudioSpeechLevel] = React.useState(0);
  const [introAudioMouthShape, setIntroAudioMouthShape] =
    React.useState<CreatureMouthShape>('closed');
  const liveLipsyncFrame = useUnityAudioLipsync(audioTrack, !isLoading && !connectionError);
  // The speaking turn is driven by Unity's real TTS playout state (LiveKit
  // `agentState === 'speaking'`, surfaced here as `isSpeaking`), not by audio
  // amplitude. The held flag bridges the brief speaking->thinking->speaking dips
  // that occur between sentences within one turn, so the face doesn't flicker.
  // `liveLipsyncFrame.speechLevel` is still used purely for mouth-open amplitude.
  const agentSpeaking = isSpeaking && !isLoading && !connectionError;
  const isDroidSpeaking = useHeldFlag(agentSpeaking);
  // The coordinator can also speak via the precomputed onboarding intro audio,
  // which plays outside the LiveKit agent, so that counts as a speaking turn too.
  const isCoordinatorSpeaking = useHeldFlag(isIntroAudioPlaying || agentSpeaking);

  React.useEffect(() => {
    if (!isCoordinator) return;

    const updateIntroAudioState = () => {
      const coordinatorWindow = window as BrowserWindowWithCoordinatorIntroAudio;
      const audio = coordinatorWindow.__coordinatorOnboardingIntroAudio;
      setIsIntroAudioPlaying(!!audio && !audio.ended);
      setIntroAudioSpeechLevel(coordinatorWindow.__coordinatorOnboardingIntroSpeechLevel ?? 0);
      setIntroAudioMouthShape(coordinatorWindow.__coordinatorOnboardingIntroMouthShape ?? 'closed');
    };

    updateIntroAudioState();
    const interval = window.setInterval(updateIntroAudioState, 100);
    return () => window.clearInterval(interval);
  }, [isCoordinator]);

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
      <div className="relative flex h-full w-full items-center justify-center bg-background">
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
            <Loader size={32} />
            <span>Loading session...</span>
          </div>
        )}
      </div>
    );
  }

  const coordinatorSpeechLevel = isIntroAudioPlaying
    ? introAudioSpeechLevel
    : liveLipsyncFrame.speechLevel;
  const coordinatorMouthShape = isIntroAudioPlaying
    ? introAudioMouthShape
    : liveLipsyncFrame.mouthShape;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center text-center',
        className || 'h-48 w-48'
      )}
    >
      {isLoading && (
        <div className="pointer-events-none absolute top-[calc(50%+4.75rem)] flex flex-col items-center">
          <p className="text-body-muted whitespace-nowrap">{loadingMessage}</p>
          {onToggleRingMute && (
            <button
              onClick={onToggleRingMute}
              className="pointer-events-auto mt-3 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={isRingMuted ? 'Unmute ring tone' : 'Mute ring tone'}
            >
              {isRingMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          )}
        </div>
      )}
      <div className="relative flex items-center justify-center">
        {/* Video or animated droid avatar */}
        <div
          className={cn(
            'z-10 flex items-center justify-center overflow-visible transition-transform duration-75',
            avatarContainerClassName || 'h-32 w-32'
          )}
        >
          {videoTrack &&
          videoTrack.publication &&
          videoTrack.publication.isSubscribed &&
          videoTrack.publication.track?.kind === 'video' ? (
            <VideoTrack trackRef={videoTrack} className="h-full w-full object-cover" />
          ) : isCoordinator && !coordinatorAvatarVisible ? (
            <div className="h-full w-full" aria-hidden="true" />
          ) : isCoordinator ? (
            <UnityCallAvatar
              isSpeaking={isCoordinatorSpeaking}
              isActing={isActing}
              isUserSpeaking={isUserSpeaking}
              teleportInOnMount={coordinatorTeleportIn}
              mood={mood}
              mouthShape={coordinatorMouthShape}
              speechLevel={coordinatorSpeechLevel}
              alignLaptop
            />
          ) : (
            <UnityCallAvatar
              isSpeaking={isDroidSpeaking}
              isActing={isActing}
              isUserSpeaking={isUserSpeaking}
              mood={mood}
              mouthShape={liveLipsyncFrame.mouthShape}
              speechLevel={liveLipsyncFrame.speechLevel}
              antenna={creatureAppearance?.antenna}
              body={creatureAppearance?.body}
              color={creatureAppearance?.color}
              baseEyes={creatureAppearance?.eyes}
              outfit={creatureAppearance?.outfit}
              label={assistantName}
              alignLaptop
            />
          )}
        </div>
      </div>
    </div>
  );
}
