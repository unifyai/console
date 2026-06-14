'use client';

import * as React from 'react';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { AssistantCommunicationHeader } from './AssistantCommunicationHeader';
import { AssistantCommunicationMainView } from './AssistantCommunicationMainView';
import { AssistantCommunicationUserView } from './AssistantCommunicationUserView';
import { AssistantCommunicationControls } from './AssistantCommunicationControls';
import { AssistantCommunicationSidePanel } from './AssistantCommunicationSidePanel';
import { MinimizedContent } from './AssistantCommunicationMinimized';
import { AnimatePresence, motion, PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import {
  RoomAudioRenderer,
  RoomContext,
  useTrackToggle,
  useVoiceAssistant,
  useLocalParticipant,
  useIsSpeaking,
  TrackReference,
  useTracks,
  useMediaDeviceSelect,
} from '@livekit/components-react';
import { Room, Track } from 'livekit-client';
import { ChatMessage, CallPill } from '@/types/assistants/chat';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import type { CreatureMood } from '@/components/Brand/TeammateCreature';

interface AssistantCommunicationDialogContentProps {
  assistant: Assistant;
  onHangUp: () => void;
  /** Optional; when omitted the header is rendered without drag
   * chrome — used by the docked / inline call surface. */
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
  onExpand?: () => void;
  onMinimize?: () => void;
  /** Header chrome for swapping between docked and dialog modes —
   *  forwarded straight through to ``AssistantCommunicationHeader``.
   *  Only one of these is meaningful per render (docked surfaces a
   *  pop-out button, modal/floating surfaces a redock button). */
  onPopOut?: () => void;
  onRedock?: () => void;
  /** Renders the toolbar at chat-composer height with smaller
   *  buttons; mirrors the ``docked`` flag on the outer dialog so
   *  the docked surface lines up with adjacent panes' footers. */
  compact?: boolean;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories?: Record<string, CallPill[]>;
  setCallPillHistories?: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  assistantActions: AssistantActions;
  isConnecting: boolean;
  userEmail: string | null | undefined;
  userImage: string | null | undefined;
  isWaitingForAssistant: boolean;
  isAssistantPreparing: boolean;
  waitingMessage?: string | null;
  connectionError: string | null;
  onRetry: () => void;
  isRemoteControlActive: boolean;
  liveviewUrl: string | null;
  isRemoteControlLoading: boolean;
  toggleRemoteControl: () => void;
  isRemoteControlInteractive: boolean;
  isRemoteControlInteractiveLoading: boolean;
  toggleRemoteControlInteractive: () => void;
  isCallConnected: boolean;
  isDesktopReady: boolean;
  callType: 'video' | 'audio' | null;
  isSpeakerMuted: boolean;
  onToggleSpeaker: () => void;
  avatarMood: CreatureMood;
  chatStreamConnectionStatus: ChatStreamConnectionStatus;
  reconnectChatStream: () => void;
  chatStreamActivitySignal: number;
  coordinatorTeleportIn?: boolean;
}

const AssistantCommunicationDialogContent: React.FC<AssistantCommunicationDialogContentProps> = ({
  assistant,
  onHangUp,
  onHeaderPointerDown,
  onExpand,
  onMinimize,
  onPopOut,
  onRedock,
  compact = false,
  chatHistories,
  setChatHistories,
  callPillHistories,
  setCallPillHistories,
  assistantActions,
  isConnecting,
  userEmail,
  userImage,
  isWaitingForAssistant,
  isAssistantPreparing,
  waitingMessage,
  connectionError,
  onRetry,
  isRemoteControlActive,
  liveviewUrl,
  isRemoteControlLoading,
  toggleRemoteControl,
  isRemoteControlInteractive,
  isRemoteControlInteractiveLoading,
  toggleRemoteControlInteractive,
  isCallConnected,
  isDesktopReady,
  callType,
  isSpeakerMuted,
  onToggleSpeaker,
  avatarMood,
  chatStreamConnectionStatus,
  reconnectChatStream,
  chatStreamActivitySignal,
  coordinatorTeleportIn = false,
}) => {
  const room = React.useContext(RoomContext);
  if (!room)
    throw new Error('AssistantCommunicationDialogContent must be used within a RoomContext');

  const {
    state: agentState,
    audioTrack: agentAudioTrack,
    videoTrack: agentVideoTrack,
  } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const isUserSpeaking = useIsSpeaking(localParticipant);
  const micToggle = useTrackToggle({ source: Track.Source.Microphone });
  const camToggle = useTrackToggle({ source: Track.Source.Camera });
  const screenShareToggle = useTrackToggle({ source: Track.Source.ScreenShare });

  const screenShareTracks = useTracks([Track.Source.ScreenShare]);
  const screenShareTrack = screenShareTracks?.[0];

  // Fire system events when user screen share state changes.
  const prevScreenShareEnabledRef = React.useRef(screenShareToggle.enabled);
  React.useEffect(() => {
    const wasOn = prevScreenShareEnabledRef.current;
    const isOn = screenShareToggle.enabled;
    prevScreenShareEnabledRef.current = isOn;
    if (wasOn === isOn || !assistant) return;

    assistantActions.desktop
      .sendSystemEvent(
        assistant.agentId,
        isOn ? 'user_screen_share_started' : 'user_screen_share_stopped',
        isOn ? 'User started sharing their screen' : 'User stopped sharing their screen'
      )
      .catch(console.error);
  }, [screenShareToggle.enabled, assistant, assistantActions.desktop]);

  // Fire system events when user webcam state changes.
  const prevCamEnabledRef = React.useRef(camToggle.enabled);
  React.useEffect(() => {
    const wasOn = prevCamEnabledRef.current;
    const isOn = camToggle.enabled;
    prevCamEnabledRef.current = isOn;
    if (wasOn === isOn || !assistant) return;

    assistantActions.desktop
      .sendSystemEvent(
        assistant.agentId,
        isOn ? 'user_webcam_started' : 'user_webcam_stopped',
        isOn ? 'User enabled their webcam' : 'User disabled their webcam'
      )
      .catch(console.error);
  }, [camToggle.enabled, assistant, assistantActions.desktop]);

  const [isUserViewVisible, setIsUserViewVisible] = React.useState(true);
  const [isUserViewMaximized, setIsUserViewMaximized] = React.useState(false);
  const [activeSidePanel, setActiveSidePanel] = React.useState<'chat' | 'settings' | null>(null);

  // Side panel resize state
  const [sidePanelWidth, setSidePanelWidth] = React.useState(300);
  const [isResizingSidePanel, setIsResizingSidePanel] = React.useState(false);

  const handleSidePanelResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingSidePanel(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const startWidth = sidePanelWidth;
      const startX = e.clientX;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Side panel is on the right, so we subtract the delta
        const newWidth = startWidth - (moveEvent.clientX - startX);
        const minWidth = 250;
        const maxWidth = 500;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setSidePanelWidth(newWidth);
        }
      };

      const handleMouseUp = () => {
        setIsResizingSidePanel(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [sidePanelWidth]
  );

  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = React.useState<string>('');

  const {
    devices: audioInputDevices,
    activeDeviceId: activeAudioInputDeviceId,
    setActiveMediaDevice: setActiveAudioInputDevice,
  } = useMediaDeviceSelect({
    kind: 'audioinput',
    room: room,
  });
  const {
    devices: audioOutputDevices,
    activeDeviceId: activeAudioOutputDeviceId,
    setActiveMediaDevice: setActiveAudioOutputDevice,
  } = useMediaDeviceSelect({
    kind: 'audiooutput',
    room: room,
  });

  React.useEffect(() => {
    if (!isCallConnected) return;
    const getDevices = async () => {
      const videoDevs = await Room.getLocalDevices('videoinput');
      const audioDevs = await Room.getLocalDevices('audioinput');
      setVideoDevices(videoDevs);
      const currentCam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
      if (currentCam) {
        const deviceId = await currentCam.getDeviceId();
        setSelectedVideoDevice(deviceId || '');
      }
    };
    getDevices();

    const handleDevicesChanged = () => getDevices();
    navigator.mediaDevices.addEventListener('devicechange', handleDevicesChanged);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDevicesChanged);
  }, [room, isCallConnected]);

  const handleVideoDeviceChange = async (deviceId: string) => {
    setSelectedVideoDevice(deviceId);
    await room.switchActiveDevice('videoinput', deviceId);
  };

  const handleAudioInputDeviceChange = async (deviceId: string) => {
    await room.switchActiveDevice('audioinput', deviceId);
    setActiveAudioInputDevice(deviceId);
  };

  const handleAudioOutputDeviceChange = async (deviceId: string) => {
    await room.switchActiveDevice('audiooutput', deviceId);
    setActiveAudioOutputDevice(deviceId);
  };

  const localVideoTrackRef: TrackReference | undefined = React.useMemo(() => {
    // camToggle.track is referenced to trigger recomputation when camera state changes
    void camToggle.track;
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    if (pub?.isSubscribed && pub.track) {
      return { participant: localParticipant, source: Track.Source.Camera, publication: pub };
    }
    return undefined;
  }, [localParticipant, camToggle.track]);

  const userTrackRef = screenShareTrack || localVideoTrackRef;
  const hasUserSelfView = Boolean(userTrackRef && (camToggle.enabled || screenShareToggle.enabled));
  const isCoordinator = assistant.isCoordinator === true;
  const displayName = assistantDisplayName(assistant);
  const assistantPhoto = assistant.signedProfilePhotoUrl || assistant.profilePhoto;

  const handleToggleSidePanel = (panel: 'chat' | 'settings') => {
    setActiveSidePanel((current) => (current === panel ? null : panel));
  };

  const showLoadingState = isConnecting || isWaitingForAssistant || isAssistantPreparing;
  const loadingMessage = isConnecting
    ? 'Setting up a connection...'
    : isWaitingForAssistant
      ? waitingMessage || `Waiting for ${displayName} to join...`
      : `${displayName} is getting ready...`;

  return (
    <>
      <AssistantCommunicationHeader
        assistantName={displayName}
        onHeaderPointerDown={onHeaderPointerDown}
        onExpand={onExpand}
        onMinimize={onMinimize}
        onPopOut={onPopOut}
        onRedock={onRedock}
        onHangUp={onHangUp}
      />
      <div className="relative flex min-h-0 flex-1">
        <div className="bg-background/80 relative flex flex-1 flex-col items-center justify-center">
          {isUserViewMaximized && hasUserSelfView ? (
            <AssistantCommunicationUserView
              imageUrl={userImage}
              trackRef={userTrackRef}
              isCameraOn={camToggle.enabled || screenShareToggle.enabled}
              participant={localParticipant}
              onMinimize={() => setIsUserViewMaximized(false)}
              onTurnOffCamera={() => {
                localParticipant.setCameraEnabled(false);
                setIsUserViewVisible(false);
                setIsUserViewMaximized(false);
              }}
              maximized
            />
          ) : (
            <>
              <AssistantCommunicationMainView
                assistantName={displayName}
                isCoordinator={isCoordinator}
                isSpeaking={agentState === 'speaking'}
                imageUrl={assistantPhoto}
                audioTrack={agentAudioTrack}
                videoTrack={agentVideoTrack}
                isRemoteControlActive={isRemoteControlActive}
                remoteControlUrl={liveviewUrl}
                isInteractive={isRemoteControlInteractive}
                isLoading={showLoadingState}
                loadingMessage={loadingMessage}
                connectionError={connectionError}
                onRetry={onRetry}
                isRingMuted={isSpeakerMuted}
                onToggleRingMute={onToggleSpeaker}
                isCallActive={isCallConnected}
                coordinatorTeleportIn={coordinatorTeleportIn}
                isUserSpeaking={isUserSpeaking}
                mood={avatarMood}
              />
              <AnimatePresence>
                {hasUserSelfView && isUserViewVisible && !isConnecting && (
                  <motion.div
                    key="user-view-pip"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-4 left-4"
                  >
                    <AssistantCommunicationUserView
                      imageUrl={userImage}
                      trackRef={userTrackRef}
                      isCameraOn={camToggle.enabled || screenShareToggle.enabled}
                      participant={localParticipant}
                      onMinimize={() => {
                        setIsUserViewVisible(false);
                        setIsUserViewMaximized(false);
                      }}
                      onMaximize={userTrackRef ? () => setIsUserViewMaximized(true) : undefined}
                      onTurnOffCamera={() => {
                        localParticipant.setCameraEnabled(false);
                        setIsUserViewVisible(false);
                        setIsUserViewMaximized(false);
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
          {hasUserSelfView && !isUserViewMaximized && !isUserViewVisible && !isConnecting && (
            <motion.div
              key="user-view-minimized"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-4 left-4"
            >
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setIsUserViewVisible(true)}
                      className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Avatar className="h-12 w-12 border-2 border-border">
                        <AvatarImage src={userImage || undefined} alt="Your profile" />
                        <AvatarFallback className="bg-muted text-muted-foreground">
                          U
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Show self-view</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </motion.div>
          )}
        </div>

        <AnimatePresence>
          {activeSidePanel && [
            <motion.div
              key="side-panel-resize-handle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onMouseDown={handleSidePanelResizeStart}
              className="hover:bg-primary/20 active:bg-primary/40 h-full w-1.5 flex-shrink-0 cursor-col-resize bg-transparent transition-colors duration-200"
              style={{ zIndex: 20 }}
            />,
            <motion.div
              key="side-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: sidePanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{
                type: 'tween',
                ease: 'easeInOut',
                duration: isResizingSidePanel ? 0 : 0.3,
              }}
              className="bg-background/95 h-full flex-shrink-0 overflow-hidden border-l"
            >
              <AssistantCommunicationSidePanel
                panelType={activeSidePanel}
                onClose={() => setActiveSidePanel(null)}
                videoDevices={videoDevices}
                selectedVideoDevice={selectedVideoDevice}
                onVideoDeviceChange={handleVideoDeviceChange}
                audioInputDevices={audioInputDevices}
                selectedAudioInputDevice={activeAudioInputDeviceId}
                onAudioInputDeviceChange={handleAudioInputDeviceChange}
                audioOutputDevices={audioOutputDevices}
                selectedAudioOutputDevice={activeAudioOutputDeviceId}
                onAudioOutputDeviceChange={handleAudioOutputDeviceChange}
                assistant={assistant}
                assistantActions={{ chat: assistantActions.chat, voice: assistantActions.voice }}
                chatHistories={chatHistories}
                setChatHistories={setChatHistories}
                callPillHistories={callPillHistories}
                setCallPillHistories={setCallPillHistories}
                userEmail={userEmail}
                userImage={userImage}
                assistantPhoto={assistantPhoto}
                chatStreamConnectionStatus={chatStreamConnectionStatus}
                reconnectChatStream={reconnectChatStream}
                chatStreamActivitySignal={chatStreamActivitySignal}
              />
            </motion.div>,
          ]}
        </AnimatePresence>
      </div>
      <AssistantCommunicationControls
        isMicOn={micToggle.enabled}
        micButtonProps={micToggle.buttonProps}
        isCameraOn={camToggle.enabled}
        cameraButtonProps={camToggle.buttonProps}
        isScreenShareOn={screenShareToggle.enabled}
        onToggleScreenShare={() => screenShareToggle.toggle()}
        isScreenShareToggleDisabled={screenShareToggle.pending}
        onHangUp={onHangUp}
        onToggleChat={() => handleToggleSidePanel('chat')}
        onToggleSettings={() => handleToggleSidePanel('settings')}
        isRemoteControlActive={isRemoteControlActive}
        isRemoteControlLoading={isRemoteControlLoading}
        onToggleRemoteControl={toggleRemoteControl}
        isRemoteControlInteractive={isRemoteControlInteractive}
        isRemoteControlInteractiveLoading={isRemoteControlInteractiveLoading}
        onToggleRemoteControlInteractive={toggleRemoteControlInteractive}
        isConnectionEstablished={isCallConnected}
        isAssistantJoined={!isWaitingForAssistant}
        isDesktopReady={isDesktopReady}
        callType={callType}
        compact={compact}
      />
    </>
  );
};

const MIN_FLOATING_WIDTH = 200;
const MIN_FLOATING_HEIGHT = 160;
const COMPACT_WIDTH_THRESHOLD = 480;
const COMPACT_HEIGHT_THRESHOLD = 380;

type BrowserWindowWithCoordinatorIntroAudio = Window & {
  __coordinatorOnboardingIntroAudio?: HTMLAudioElement;
};

function useIsCoordinatorIntroAudioPlaying() {
  const [isIntroAudioPlaying, setIsIntroAudioPlaying] = React.useState(false);

  React.useEffect(() => {
    const updateIntroAudioState = () => {
      const audio = (window as BrowserWindowWithCoordinatorIntroAudio)
        .__coordinatorOnboardingIntroAudio;
      setIsIntroAudioPlaying(!!audio && !audio.paused && !audio.ended);
    };

    updateIntroAudioState();
    const interval = window.setInterval(updateIntroAudioState, 100);
    return () => window.clearInterval(interval);
  }, []);

  return isIntroAudioPlaying;
}

interface AssistantCommunicationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assistant: Assistant;
  assistantActions: AssistantActions;
  room: Room;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories?: Record<string, CallPill[]>;
  setCallPillHistories?: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  isConnecting: boolean;
  userEmail: string | null | undefined;
  userImage: string | null | undefined;
  isWaitingForAssistant: boolean;
  isAssistantPreparing: boolean;
  waitingMessage?: string | null;
  connectionError: string | null;
  onRetry: () => void;
  isRemoteControlActive: boolean;
  liveviewUrl: string | null;
  isRemoteControlLoading: boolean;
  toggleRemoteControl: () => void;
  isRemoteControlInteractive: boolean;
  isRemoteControlInteractiveLoading: boolean;
  toggleRemoteControlInteractive: () => void;
  isCallConnected: boolean;
  isDesktopReady: boolean;
  callType: 'video' | 'audio' | null;
  isSpeakerMuted: boolean;
  onToggleSpeaker: () => void;
  avatarMood: CreatureMood;
  chatStreamConnectionStatus: ChatStreamConnectionStatus;
  reconnectChatStream: () => void;
  chatStreamActivitySignal: number;
  /**
   * Docked mode replaces the modal/floating shell with an inline
   * container that fills its parent (``h-full w-full``, no fixed
   * positioning, no backdrop, no drag/resize affordances). Used by
   * the Coordinator onboarding flow to dock the call surface in
   * place of the chat panel while the onboarding sidebar stays
   * visible to its right. Escape no longer transitions to a
   * floating overlay either — closing the call is done explicitly
   * via the hangup control.
   *
   * The docked branch deliberately ignores ``isOpen``: docked
   * surfaces are part of the page layout and the parent decides
   * when to mount them based on whether a call is active. ``isOpen``
   * only gates the modal/floating shell.
   */
  docked?: boolean;
  /** Play the pixelated teleport "materialise" fizzle on the coordinator
   *  droid when it first mounts. Set by the onboarding docked call so the
   *  droid teleports into the call window. */
  coordinatorTeleportIn?: boolean;
  /** Promote the call from its docked slot into the dialog (modal /
   *  floating) shell. Wired by the header's pop-out button in docked
   *  mode. */
  onPopOut?: () => void;
  /** Demote the call from the dialog shell back into its docked
   *  slot. Wired by the header's "dock" button on modal & floating
   *  modes. */
  onRedock?: () => void;
}

export function AssistantCommunicationDialog({
  isOpen,
  onClose,
  assistant,
  assistantActions,
  room,
  chatHistories,
  setChatHistories,
  callPillHistories,
  setCallPillHistories,
  isConnecting,
  userEmail,
  userImage,
  isWaitingForAssistant,
  isAssistantPreparing,
  waitingMessage,
  connectionError,
  onRetry,
  isRemoteControlActive,
  liveviewUrl,
  isRemoteControlLoading,
  toggleRemoteControl,
  isRemoteControlInteractive,
  isRemoteControlInteractiveLoading,
  toggleRemoteControlInteractive,
  isCallConnected,
  isDesktopReady,
  callType,
  isSpeakerMuted,
  onToggleSpeaker,
  avatarMood,
  chatStreamConnectionStatus,
  reconnectChatStream,
  chatStreamActivitySignal,
  docked = false,
  coordinatorTeleportIn = false,
  onPopOut,
  onRedock,
}: AssistantCommunicationDialogProps) {
  // --- Modal / Floating mode ---
  const [mode, setMode] = React.useState<'modal' | 'floating'>('modal');
  const contentRef = React.useRef<HTMLDivElement>(null);

  const [floatingPos, setFloatingPos] = React.useState({ x: 0, y: 0 });
  const [floatingSize, setFloatingSize] = React.useState({ width: 0, height: 0 });
  const floatingPosRef = React.useRef({ x: 0, y: 0 });
  const floatingSizeRef = React.useRef({ width: 0, height: 0 });
  const [isResizing, setIsResizing] = React.useState(false);

  const isModal = mode === 'modal';
  const isCoordinatorIntroAudioPlaying = useIsCoordinatorIntroAudioPlaying();

  // Reset to modal every time the dialog opens.
  React.useEffect(() => {
    if (isOpen) setMode('modal');
  }, [isOpen]);

  // --- Transition helpers ---
  const transitionToFloating = React.useCallback(() => {
    const rect = contentRef.current?.getBoundingClientRect();
    if (rect) {
      const pos = { x: rect.x, y: rect.y };
      const size = { width: rect.width, height: rect.height };
      floatingPosRef.current = pos;
      floatingSizeRef.current = size;
      setFloatingPos(pos);
      setFloatingSize(size);
    }
    setMode('floating');
  }, []);

  // Escape key: modal → floating (keeps the call alive).
  // Suppressed in docked mode — the call is part of the surrounding
  // page chrome there, not a dismissable overlay, so escape should
  // remain available for other UI (e.g. closing menus).
  React.useEffect(() => {
    if (!isOpen || !isModal || docked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        transitionToFloating();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isModal, docked, transitionToFloating]);

  // --- Header drag ---
  const handleHeaderPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      const startX = e.clientX;
      const startY = e.clientY;
      let dragStarted = false;

      // Pre-compute cursor offset from the window's top-left corner.
      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return;
      const offsetX = startX - rect.x;
      const offsetY = startY - rect.y;

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (!dragStarted && Math.abs(dx) + Math.abs(dy) > 5) {
          dragStarted = true;
          if (isModal) {
            // Capture current computed size and switch mode in one batch.
            const r = contentRef.current?.getBoundingClientRect();
            if (r) {
              floatingSizeRef.current = { width: r.width, height: r.height };
              setFloatingSize({ width: r.width, height: r.height });
            }
            setMode('floating');
          }
        }

        if (dragStarted) {
          const newPos = {
            x: moveEvent.clientX - offsetX,
            y: moveEvent.clientY - offsetY,
          };
          floatingPosRef.current = newPos;
          setFloatingPos(newPos);
        }
      };

      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        document.body.style.userSelect = '';
      };

      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [isModal]
  );

  // --- Corner resize (floating mode) ---
  const handleCornerResize = React.useCallback(
    (corner: 'tl' | 'tr' | 'bl' | 'br') =>
      (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsResizing(true);
        const prev = floatingSizeRef.current;
        const prevPos = floatingPosRef.current;

        const dw = corner === 'tl' || corner === 'bl' ? -info.delta.x : info.delta.x;
        const dh = corner === 'tl' || corner === 'tr' ? -info.delta.y : info.delta.y;

        const newWidth = Math.max(MIN_FLOATING_WIDTH, prev.width + dw);
        const newHeight = Math.max(MIN_FLOATING_HEIGHT, prev.height + dh);
        const actualDw = newWidth - prev.width;
        const actualDh = newHeight - prev.height;

        let newX = prevPos.x;
        let newY = prevPos.y;
        if (corner === 'tl' || corner === 'bl') newX -= actualDw;
        if (corner === 'tl' || corner === 'tr') newY -= actualDh;

        floatingSizeRef.current = { width: newWidth, height: newHeight };
        floatingPosRef.current = { x: newX, y: newY };
        setFloatingSize({ width: newWidth, height: newHeight });
        setFloatingPos({ x: newX, y: newY });
      },
    []
  );

  // --- Edge resize (floating mode) ---
  const handleEdgeResize = React.useCallback(
    (edge: 't' | 'r' | 'b' | 'l') =>
      (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsResizing(true);
        const prev = floatingSizeRef.current;
        const prevPos = floatingPosRef.current;

        const dw = edge === 'l' ? -info.delta.x : edge === 'r' ? info.delta.x : 0;
        const dh = edge === 't' ? -info.delta.y : edge === 'b' ? info.delta.y : 0;

        const newWidth = Math.max(MIN_FLOATING_WIDTH, prev.width + dw);
        const newHeight = Math.max(MIN_FLOATING_HEIGHT, prev.height + dh);
        const actualDw = newWidth - prev.width;
        const actualDh = newHeight - prev.height;

        let newX = prevPos.x;
        let newY = prevPos.y;
        if (edge === 'l') newX -= actualDw;
        if (edge === 't') newY -= actualDh;

        floatingSizeRef.current = { width: newWidth, height: newHeight };
        floatingPosRef.current = { x: newX, y: newY };
        setFloatingSize({ width: newWidth, height: newHeight });
        setFloatingPos({ x: newX, y: newY });
      },
    []
  );

  const handleResizeEnd = React.useCallback(() => setIsResizing(false), []);

  // Docked mode: inline surface that fills its parent. No backdrop,
  // no positioning chrome, no drag/resize/floating — the dialog is
  // just one panel of a larger page layout (the chat slot on the
  // /assistants page, or the Coordinator onboarding shell).
  //
  // The branch sits *above* the ``isOpen`` guard on purpose: docked
  // surfaces are mounted/unmounted by their parent based on whether
  // a call is active, not by the dialog-only ``isOpen`` flag, so
  // gating them on ``isOpen`` would force every caller to thread
  // an unrelated boolean through.
  if (docked) {
    return (
      <div
        ref={contentRef}
        className="relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground"
        data-testid="assistant-call-docked"
      >
        {!isCoordinatorIntroAudioPlaying && <RoomAudioRenderer />}
        <AssistantCommunicationDialogContent
          assistant={assistant}
          onHangUp={onClose}
          onPopOut={onPopOut}
          compact
          chatHistories={chatHistories}
          setChatHistories={setChatHistories}
          callPillHistories={callPillHistories}
          setCallPillHistories={setCallPillHistories}
          assistantActions={assistantActions}
          isConnecting={isConnecting}
          userEmail={userEmail}
          userImage={userImage}
          isWaitingForAssistant={isWaitingForAssistant}
          isAssistantPreparing={isAssistantPreparing}
          waitingMessage={waitingMessage}
          connectionError={connectionError}
          onRetry={onRetry}
          isRemoteControlActive={isRemoteControlActive}
          liveviewUrl={liveviewUrl}
          isRemoteControlLoading={isRemoteControlLoading}
          toggleRemoteControl={toggleRemoteControl}
          isRemoteControlInteractive={isRemoteControlInteractive}
          isRemoteControlInteractiveLoading={isRemoteControlInteractiveLoading}
          toggleRemoteControlInteractive={toggleRemoteControlInteractive}
          isCallConnected={isCallConnected}
          isDesktopReady={isDesktopReady}
          callType={callType}
          isSpeakerMuted={isSpeakerMuted}
          onToggleSpeaker={onToggleSpeaker}
          avatarMood={avatarMood}
          chatStreamConnectionStatus={chatStreamConnectionStatus}
          reconnectChatStream={reconnectChatStream}
          chatStreamActivitySignal={chatStreamActivitySignal}
          coordinatorTeleportIn={coordinatorTeleportIn}
        />
      </div>
    );
  }

  if (!isOpen) return null;

  const isCompact =
    !isModal &&
    (floatingSize.width < COMPACT_WIDTH_THRESHOLD ||
      floatingSize.height < COMPACT_HEIGHT_THRESHOLD);

  const resizeHandleClass = 'absolute z-10 h-3 w-3 opacity-0 hover:opacity-100 transition-opacity';

  return (
    <>
      {/* Backdrop – only in modal mode */}
      <AnimatePresence>
        {isModal && (
          <motion.div
            key="call-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[color:var(--overlay-strong)]"
            onClick={transitionToFloating}
          />
        )}
      </AnimatePresence>

      {/* Window container */}
      <div
        ref={contentRef}
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden rounded-lg border p-0 text-foreground',
          // Modal: opaque background
          isModal && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background',
          // Floating: glassmorphism
          !isModal && 'bg-background/80 shadow-2xl backdrop-blur-md',
          // Compact: the whole container is draggable, and uses group for hover effects
          isCompact && 'group cursor-grab active:cursor-grabbing'
        )}
        style={
          isModal
            ? { width: '95vw', maxWidth: '80rem', height: '85vh' }
            : {
                left: floatingPos.x,
                top: floatingPos.y,
                width: floatingSize.width,
                height: floatingSize.height,
              }
        }
        onPointerDown={isCompact ? handleHeaderPointerDown : undefined}
      >
        {!isCoordinatorIntroAudioPlaying && <RoomAudioRenderer />}

        {isCompact ? (
          /* Compact / simplified view */
          <div className="relative flex h-full w-full flex-col items-center justify-center p-4">
            <MinimizedContent
              assistant={assistant}
              onHangUp={onClose}
              onExpand={() => setMode('modal')}
              isSpeakerMuted={isSpeakerMuted}
              onToggleSpeaker={onToggleSpeaker}
              isConnecting={isConnecting}
              isWaitingForAssistant={isWaitingForAssistant}
              isAssistantPreparing={isAssistantPreparing}
              waitingMessage={waitingMessage}
              connectionError={connectionError}
              onRetry={onRetry}
              isCallConnected={isCallConnected}
              callType={callType}
              avatarMood={avatarMood}
            />
          </div>
        ) : (
          /* Full dialog content */
          <AssistantCommunicationDialogContent
            assistant={assistant}
            onHangUp={onClose}
            onHeaderPointerDown={handleHeaderPointerDown}
            onExpand={!isModal ? () => setMode('modal') : undefined}
            onMinimize={isModal ? transitionToFloating : undefined}
            onRedock={onRedock}
            chatHistories={chatHistories}
            setChatHistories={setChatHistories}
            callPillHistories={callPillHistories}
            setCallPillHistories={setCallPillHistories}
            assistantActions={assistantActions}
            isConnecting={isConnecting}
            userEmail={userEmail}
            userImage={userImage}
            isWaitingForAssistant={isWaitingForAssistant}
            isAssistantPreparing={isAssistantPreparing}
            waitingMessage={waitingMessage}
            connectionError={connectionError}
            onRetry={onRetry}
            isRemoteControlActive={isRemoteControlActive}
            liveviewUrl={liveviewUrl}
            isRemoteControlLoading={isRemoteControlLoading}
            toggleRemoteControl={toggleRemoteControl}
            isRemoteControlInteractive={isRemoteControlInteractive}
            isRemoteControlInteractiveLoading={isRemoteControlInteractiveLoading}
            toggleRemoteControlInteractive={toggleRemoteControlInteractive}
            isCallConnected={isCallConnected}
            isDesktopReady={isDesktopReady}
            callType={callType}
            isSpeakerMuted={isSpeakerMuted}
            onToggleSpeaker={onToggleSpeaker}
            avatarMood={avatarMood}
            chatStreamConnectionStatus={chatStreamConnectionStatus}
            reconnectChatStream={reconnectChatStream}
            chatStreamActivitySignal={chatStreamActivitySignal}
            coordinatorTeleportIn={coordinatorTeleportIn}
          />
        )}

        {/* Resize handles – floating mode only */}
        {!isModal &&
          (['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
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
        {/* Edge resize handles – floating mode only */}
        {!isModal &&
          (['t', 'r', 'b', 'l'] as const).map((edge) => (
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
                'absolute z-10 opacity-0 transition-opacity hover:opacity-100',
                edge === 't' && 'left-3 right-3 top-0 h-1.5 cursor-ns-resize',
                edge === 'b' && 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize',
                edge === 'l' && 'bottom-3 left-0 top-3 w-1.5 cursor-ew-resize',
                edge === 'r' && 'bottom-3 right-0 top-3 w-1.5 cursor-ew-resize'
              )}
            />
          ))}
      </div>
    </>
  );
}
