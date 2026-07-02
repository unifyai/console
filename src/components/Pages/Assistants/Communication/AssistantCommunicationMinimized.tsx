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
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Assistant } from '@/types/assistants/assistant';
import { Track, Room } from 'livekit-client';
import {
  RoomContext,
  useIsSpeaking,
  useLocalParticipant,
  useTrackToggle,
  useVoiceAssistant,
} from '@livekit/components-react';
import { AssistantCommunicationMainView } from './AssistantCommunicationMainView';
import { cn } from '@/lib/utils';
import { motion, PanInfo, useMotionValue } from 'framer-motion';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import type { CreatureMood } from '@/components/Brand/TeammateCreature';
import { useMutedMicrophoneActivity } from '@/hooks/Assistants/useMutedMicrophoneActivity';

const MIN_WIDTH = 200;
const MIN_HEIGHT = 160;
const MAX_WIDTH = 640;
const MAX_HEIGHT = 520;

interface AssistantCommunicationMinimizedProps {
  assistant: Assistant;
  room: Room;
  onHangUp: () => void;
  onExpand: () => void;
  isSpeakerMuted: boolean;
  onToggleSpeaker: () => void;
  isConnecting: boolean;
  isWaitingForAssistant: boolean;
  isAssistantPreparing: boolean;
  waitingMessage?: string | null;
  connectionError: string | null;
  onRetry: () => void;
  isCallConnected: boolean;
  callType: 'video' | 'audio' | null;
  avatarMood: CreatureMood;
}

const ControlButton: React.FC<{
  tooltip: string;
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}> = ({ tooltip, children, className, ...props }) => (
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        {/* This span allows hover events for the tooltip even when the button is disabled. */}
        <span>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'bg-card/85 h-8 w-8 rounded-full border border-border text-foreground shadow-sm hover:bg-[var(--surface-hover)]',
              className
            )}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={tooltip}
            {...props}
          >
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

export type MinimizedContentProps = Omit<AssistantCommunicationMinimizedProps, 'room'>;

export const MinimizedContent: React.FC<MinimizedContentProps> = ({
  assistant,
  onHangUp,
  onExpand,
  isSpeakerMuted,
  onToggleSpeaker,
  isConnecting,
  isWaitingForAssistant,
  isAssistantPreparing,
  waitingMessage,
  connectionError,
  onRetry,
  isCallConnected,
  callType,
  avatarMood,
}) => {
  const {
    state: agentState,
    audioTrack: agentAudioTrack,
    videoTrack: agentVideoTrack,
  } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const isUserSpeaking = useIsSpeaking(localParticipant);
  const micToggle = useTrackToggle({ source: Track.Source.Microphone });
  const camToggle = useTrackToggle({ source: Track.Source.Camera });
  const isMutedSpeechDetected = useMutedMicrophoneActivity({
    enabled: isCallConnected && !micToggle.enabled,
  });

  const isCoordinator = assistant.isCoordinator === true;
  const displayName = assistantDisplayName(assistant);
  const assistantPhoto = assistant.signedProfilePhotoUrl || assistant.profilePhoto;
  const showLoadingState = isConnecting || isWaitingForAssistant || isAssistantPreparing;
  const loadingMessage = isConnecting
    ? 'Connecting...'
    : isWaitingForAssistant
      ? waitingMessage || `Waiting for ${displayName}...`
      : `${displayName} is getting ready...`;
  const showMutedSpeechCue =
    isCallConnected && !micToggle.enabled && (isMutedSpeechDetected || isUserSpeaking);

  if (connectionError) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center p-2 text-center">
        <AlertTriangle className="mb-1 h-4 w-4 text-destructive" />
        <p className="text-caption mb-1.5 px-1 text-center">{connectionError}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onHangUp();
            }}
            className="h-7"
            onPointerDown={(e) => e.stopPropagation()}
          >
            Leave
          </Button>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            className="h-7"
            onPointerDown={(e) => e.stopPropagation()}
          >
            Retry
          </Button>
        </div>
        {/* Expand Button */}
        <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
          <ControlButton tooltip="Fullscreen Mode" onClick={onExpand}>
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
        className="mb-3 h-full w-full flex-1"
        avatarContainerClassName="w-20 h-20"
        assistantName={displayName}
        isCoordinator={isCoordinator}
        isSpeaking={agentState === 'speaking'}
        imageUrl={assistantPhoto}
        audioTrack={agentAudioTrack}
        videoTrack={agentVideoTrack}
        isLoading={showLoadingState}
        loadingMessage={loadingMessage}
        isRingMuted={isSpeakerMuted}
        onToggleRingMute={onToggleSpeaker}
        isUserSpeaking={isUserSpeaking}
        mood={avatarMood}
      />
      {showMutedSpeechCue && (
        <div
          className="text-caption pointer-events-none absolute bottom-14 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-background px-2 py-1 text-foreground shadow-sm"
          data-testid="assistant-call-muted-speech-cue"
          role="status"
        >
          Unmute if you&apos;d like to speak
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <ControlButton
          tooltip="Hang Up"
          className="border-destructive bg-destructive text-destructive-foreground hover:bg-destructive"
          onClick={onHangUp}
        >
          <PhoneOff className="h-4 w-4" />
        </ControlButton>
        <div>
          <ControlButton
            tooltip={
              !isCallConnected
                ? 'Available after connecting'
                : micToggle.enabled
                  ? 'Mute Mic'
                  : 'Unmute Mic'
            }
            {...micToggle.buttonProps}
            className={cn(
              micToggle.buttonProps.className,
              showMutedSpeechCue &&
                'bg-primary-tint-20 text-primary ring-1 ring-primary-tint-50 hover:bg-primary-tint-30 hover:text-primary'
            )}
            disabled={!isCallConnected || micToggle.buttonProps.disabled}
          >
            {micToggle.enabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </ControlButton>
        </div>
        <ControlButton
          tooltip={
            !isCallConnected
              ? 'Available after connecting'
              : isSpeakerMuted
                ? 'Unmute Speaker'
                : 'Mute Speaker'
          }
          onClick={onToggleSpeaker}
          disabled={!isCallConnected}
        >
          {isSpeakerMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </ControlButton>
        <ControlButton
          tooltip={
            !isCallConnected
              ? 'Available after connecting'
              : camToggle.enabled
                ? 'Turn Off Camera'
                : 'Turn On Camera'
          }
          {...camToggle.buttonProps}
          disabled={!isCallConnected || camToggle.buttonProps.disabled}
        >
          {camToggle.enabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </ControlButton>
      </div>
      {/* Expand Button */}
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <ControlButton tooltip="Expand View" onClick={onExpand}>
          <Maximize2 className="h-4 w-4" />
        </ControlButton>
      </div>
    </>
  );
};

export function AssistantCommunicationMinimized(props: AssistantCommunicationMinimizedProps) {
  const [size, setSize] = React.useState({ width: 256, height: 192 });
  const [isResizing, setIsResizing] = React.useState(false);
  const sizeRef = React.useRef(size);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleCornerResize = React.useCallback(
    (corner: 'tl' | 'tr' | 'bl' | 'br') =>
      (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsResizing(true);

        const prev = sizeRef.current;
        const dx = corner === 'tl' || corner === 'bl' ? -info.delta.x : info.delta.x;
        const dy = corner === 'tl' || corner === 'tr' ? -info.delta.y : info.delta.y;

        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, prev.width + dx));
        const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, prev.height + dy));

        const actualDw = newWidth - prev.width;
        const actualDh = newHeight - prev.height;

        // The element is CSS-anchored at bottom-right, so changing size moves the
        // top-left corner by default. Compensate by shifting the element's
        // transform so the corner opposite to the one being dragged stays fixed.
        if (corner === 'tr' || corner === 'br') {
          x.set(x.get() + actualDw);
        }
        if (corner === 'bl' || corner === 'br') {
          y.set(y.get() + actualDh);
        }

        sizeRef.current = { width: newWidth, height: newHeight };
        setSize({ width: newWidth, height: newHeight });
      },
    [x, y]
  );

  const handleEdgeResize = React.useCallback(
    (edge: 't' | 'r' | 'b' | 'l') =>
      (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsResizing(true);

        const prev = sizeRef.current;
        const dw = edge === 'l' ? -info.delta.x : edge === 'r' ? info.delta.x : 0;
        const dh = edge === 't' ? -info.delta.y : edge === 'b' ? info.delta.y : 0;

        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, prev.width + dw));
        const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, prev.height + dh));

        const actualDw = newWidth - prev.width;
        const actualDh = newHeight - prev.height;

        // The element is CSS-anchored at bottom-right, so compensate by shifting
        // the transform so the opposite edge stays fixed.
        if (edge === 'r') {
          x.set(x.get() + actualDw);
        }
        if (edge === 'b') {
          y.set(y.get() + actualDh);
        }

        sizeRef.current = { width: newWidth, height: newHeight };
        setSize({ width: newWidth, height: newHeight });
      },
    [x, y]
  );

  const handleResizeEnd = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resizeHandleClass =
    'absolute z-10 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity';

  return (
    <motion.div
      drag={!isResizing}
      dragMomentum={false}
      whileDrag={isResizing ? undefined : { scale: 1.02 }}
      className="bg-card/90 group fixed bottom-5 right-5 z-50 flex cursor-grab flex-col items-center justify-center rounded-xl border border-border p-4 shadow-pop-lg backdrop-blur-md active:cursor-grabbing"
      style={{ width: size.width, height: size.height, x, y }}
    >
      {/* Resize handles on corners */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <motion.div
          key={corner}
          drag
          dragMomentum={false}
          dragElastic={0}
          dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
          onDrag={handleCornerResize(corner)}
          onDragEnd={handleResizeEnd}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            resizeHandleClass,
            corner === 'tl' && 'left-0 top-0 cursor-nwse-resize',
            corner === 'tr' && 'right-0 top-0 cursor-nesw-resize',
            corner === 'bl' && 'bottom-0 left-0 cursor-nesw-resize',
            corner === 'br' && 'bottom-0 right-0 cursor-nwse-resize'
          )}
        />
      ))}
      {/* Resize handles on edges */}
      {(['t', 'r', 'b', 'l'] as const).map((edge) => (
        <motion.div
          key={edge}
          drag
          dragMomentum={false}
          dragElastic={0}
          dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
          onDrag={handleEdgeResize(edge)}
          onDragEnd={handleResizeEnd}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            'absolute z-10 opacity-0 transition-opacity group-hover:opacity-100',
            edge === 't' && 'left-3 right-3 top-0 h-1.5 cursor-ns-resize',
            edge === 'b' && 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize',
            edge === 'l' && 'bottom-3 left-0 top-3 w-1.5 cursor-ew-resize',
            edge === 'r' && 'bottom-3 right-0 top-3 w-1.5 cursor-ew-resize'
          )}
        />
      ))}
      <RoomContext.Provider value={props.room}>
        <MinimizedContent {...props} />
      </RoomContext.Provider>
    </motion.div>
  );
}
