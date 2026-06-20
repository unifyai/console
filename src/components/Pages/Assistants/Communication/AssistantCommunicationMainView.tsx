'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { VideoTrack, TrackReference } from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import { Button } from '@/components/UI/button';
import { DroidCallAvatar } from '@/components/Pages/Assistants/Communication/DroidCallAvatar';
import { CreatureAvatar, parseCreatureSentinel } from '@/components/Brand';
import { useDroidEyeExpression } from '@/hooks/Assistants/useDroidEyeExpression';
import { useDroidAudioLipsync } from '@/hooks/Assistants/useDroidAudioLipsync';
import type {
  CreatureEyes,
  CreatureMood,
  CreatureMouthShape,
} from '@/components/Brand/TeammateCreature';
import { getDroidSpeechTransform } from '@/utils/assistants/droid-animation';
import { COORDINATOR_ONBOARDING_DROID_LAYOUT_TRANSITION } from '@/utils/assistants/coordinator-onboarding-intro';

type BrowserWindowWithCoordinatorIntroAudio = Window & {
  __coordinatorOnboardingIntroAudio?: HTMLAudioElement;
  __coordinatorOnboardingIntroSpeechLevel?: number;
  __coordinatorOnboardingIntroMouthShape?: CreatureMouthShape;
};

const IMAGE_AVATAR_MOUTH: Record<
  CreatureMouthShape,
  { width: number; topDip: number; bottomDip: number }
> = {
  closed: { width: 24, topDip: 2, bottomDip: 8 },
  pinched: { width: 22, topDip: 2, bottomDip: 15 },
  narrow: { width: 26, topDip: 3, bottomDip: 17 },
  round: { width: 24, topDip: 3, bottomDip: 19 },
  wide: { width: 34, topDip: 3, bottomDip: 16 },
  open: { width: 30, topDip: 4, bottomDip: 22 },
  flat: { width: 24, topDip: 0, bottomDip: 3 },
  cat: { width: 19, topDip: 0, bottomDip: 20 },
  unsure: { width: 24, topDip: 0, bottomDip: 6 },
};

function ImageAvatarMouth({
  mouthShape,
  speechLevel,
}: {
  mouthShape: CreatureMouthShape;
  speechLevel: number;
}) {
  const mouth = IMAGE_AVATAR_MOUTH[mouthShape];
  const cx = 22;
  const topY = 4;
  const leftX = cx - mouth.width / 2;
  const rightX = cx + mouth.width / 2;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[58%] h-[24%] w-[42%] -translate-x-1/2 text-primary"
      viewBox="0 0 44 28"
    >
      <path
        d={`M ${leftX} ${topY} Q ${cx} ${topY + mouth.topDip} ${rightX} ${topY} Q ${cx} ${
          topY + mouth.bottomDip
        } ${leftX} ${topY} Z`}
        fill="currentColor"
        style={{
          opacity: 0.78 + speechLevel * 0.22,
          transform: `scaleY(${0.9 + speechLevel * 0.12})`,
          transformBox: 'fill-box',
          transformOrigin: 'center top',
        }}
      />
    </svg>
  );
}

function ImageAvatarEye({ cx, cy, eyes }: { cx: number; cy: number; eyes: CreatureEyes }) {
  if (eyes === 'blink') {
    return <rect fill="currentColor" height={4} rx={2} width={15} x={cx - 7.5} y={cy - 2} />;
  }

  if (eyes === 'square') {
    return <rect fill="currentColor" height={9} rx={2} width={9} x={cx - 4.5} y={cy - 4.5} />;
  }

  const d =
    eyes === 'down'
      ? `M ${cx - 6} ${cy - 4} L ${cx} ${cy + 4} L ${cx + 6} ${cy - 4}`
      : `M ${cx - 6} ${cy + 4} L ${cx} ${cy - 4} L ${cx + 6} ${cy + 4}`;

  return (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={4.5}
    />
  );
}

function ImageAvatarEyes({ eyes }: { eyes: CreatureEyes }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[34%] h-[22%] w-[54%] -translate-x-1/2 text-primary"
      viewBox="0 0 64 32"
    >
      <ImageAvatarEye cx={22} cy={15} eyes={eyes} />
      <ImageAvatarEye cx={42} cy={15} eyes={eyes} />
    </svg>
  );
}

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
  isCallActive?: boolean;
  isUserSpeaking?: boolean;
  mood?: CreatureMood;
  /** Fade the coordinator droid in when it first mounts in the docked call. */
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
  isCallActive = false,
  isUserSpeaking = false,
  mood = 'happy',
  coordinatorAvatarVisible = true,
  coordinatorTeleportIn = false,
}: AssistantCommunicationMainViewProps) {
  const fallback = assistantName
    ? `${assistantName.split(' ')?.[0]?.[0] ?? ''}${assistantName.split(' ')?.[1]?.[0] ?? ''}`.toUpperCase()
    : 'A';
  // A `appearance://` photo means this assistant is a droid — render the
  // animated SVG instead of a (broken) <img> + overlaid eyes/mouth.
  const creatureAppearance = parseCreatureSentinel(imageUrl);
  const [isIntroAudioPlaying, setIsIntroAudioPlaying] = React.useState(false);
  const [introAudioSpeechLevel, setIntroAudioSpeechLevel] = React.useState(0);
  const [introAudioMouthShape, setIntroAudioMouthShape] =
    React.useState<CreatureMouthShape>('closed');
  const liveLipsyncFrame = useDroidAudioLipsync(audioTrack, !isLoading && !connectionError);
  const isImageAvatarSpeaking =
    liveLipsyncFrame.isActive || (isSpeaking && !isLoading && !connectionError);
  const imageAvatarEyes = useDroidEyeExpression({
    isCallActive,
    isSpeaking: isImageAvatarSpeaking,
    isUserSpeaking,
    speechLevel: liveLipsyncFrame.speechLevel,
  });

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

  if (isLoading && !isCoordinator) {
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
            {creatureAppearance ? (
              <CreatureAvatar
                appearance={creatureAppearance}
                className="rounded-full"
                label={assistantName}
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
  const isCoordinatorSpeaking =
    isIntroAudioPlaying ||
    liveLipsyncFrame.isActive ||
    (isSpeaking && !isLoading && !connectionError);
  const imageAvatarSpeechLevel = liveLipsyncFrame.speechLevel;
  const imageAvatarMouthShape = liveLipsyncFrame.mouthShape;
  const imageAvatarVisualStyle = {
    '--droid-speech-level': imageAvatarSpeechLevel.toFixed(3),
    transform: getDroidSpeechTransform(imageAvatarSpeechLevel * 0.45),
  } as React.CSSProperties;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center text-center',
        className || 'h-48 w-48'
      )}
    >
      {isCoordinator && isLoading && (
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
        {/* Video or Avatar */}
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
          ) : (
            <>
              {isCoordinator && !coordinatorAvatarVisible ? (
                <div className="h-full w-full" aria-hidden="true" />
              ) : isCoordinator ? (
                <DroidCallAvatar
                  isSpeaking={isCoordinatorSpeaking}
                  isCallActive={isCallActive}
                  isUserSpeaking={isUserSpeaking}
                  layoutTransition={
                    coordinatorTeleportIn
                      ? undefined
                      : COORDINATOR_ONBOARDING_DROID_LAYOUT_TRANSITION
                  }
                  layoutId={
                    coordinatorTeleportIn ? undefined : 'coordinator-onboarding-call-avatar'
                  }
                  teleportInOnMount={coordinatorTeleportIn}
                  mood={mood}
                  mouthShape={coordinatorMouthShape}
                  speechLevel={coordinatorSpeechLevel}
                />
              ) : creatureAppearance ? (
                <DroidCallAvatar
                  isSpeaking={isImageAvatarSpeaking}
                  isCallActive={isCallActive}
                  isUserSpeaking={isUserSpeaking}
                  mouthShape={imageAvatarMouthShape}
                  speechLevel={imageAvatarSpeechLevel}
                  antenna={creatureAppearance.antenna}
                  body={creatureAppearance.body}
                  color={creatureAppearance.color}
                  baseEyes={creatureAppearance.eyes}
                  outfit={creatureAppearance.outfit}
                  label={assistantName}
                />
              ) : (
                <div className="relative h-full w-full" style={imageAvatarVisualStyle}>
                  <Avatar className="h-full w-full">
                    <AvatarImage src={imageUrl ?? undefined} alt={assistantName} />
                    <AvatarFallback className="bg-muted text-4xl text-muted-foreground">
                      {fallback}
                    </AvatarFallback>
                  </Avatar>
                  <ImageAvatarEyes eyes={imageAvatarEyes} />
                  <ImageAvatarMouth
                    mouthShape={imageAvatarMouthShape}
                    speechLevel={imageAvatarSpeechLevel}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
