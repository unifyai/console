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
  TrackReference,
  useTracks,
  useMediaDeviceSelect,
} from '@livekit/components-react';
import { Room, Track } from 'livekit-client';
import { ChatMessage } from '@/types/assistants/chat';
import { ConnectionDetails } from '@/types/assistants/call';
import { toast } from 'sonner';

interface AssistantCommunicationDialogContentProps {
  assistant: Assistant;
  onHangUp: () => void;
  onHeaderPointerDown: (e: React.PointerEvent) => void;
  onExpand?: () => void;
  onMinimize?: () => void;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  assistantActions: AssistantActions;
  isConnecting: boolean;
  userEmail: string | null | undefined;
  userImage: string | null | undefined;
  isWaitingForAssistant: boolean;
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
  connectionDetails: ConnectionDetails | null;
}

const AssistantCommunicationDialogContent: React.FC<AssistantCommunicationDialogContentProps> = ({
  assistant,
  onHangUp,
  onHeaderPointerDown,
  onExpand,
  onMinimize,
  chatHistories,
  setChatHistories,
  assistantActions,
  isConnecting,
  userEmail,
  userImage,
  isWaitingForAssistant,
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
  connectionDetails,
}) => {
  const room = React.useContext(RoomContext);
  if (!room)
    throw new Error('AssistantCommunicationDialogContent must be used within a RoomContext');

  const { state: agentState, videoTrack: agentVideoTrack } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
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

  const handlePopOut = () => {
    if (!connectionDetails || !assistant || !callType) return;

    const { serverUrl, token } = connectionDetails;
    const assistantId = assistant.agentId;
    const assistantName = `${assistant.firstName} ${assistant.surname}`;

    const tempKey = `call-data-${Date.now()}`;
    const callData = {
      serverUrl,
      token,
      callType,
      assistantName,
      assistantPhoto: assistant.signedProfilePhotoUrl || assistant.profilePhoto || '',
      userImage: userImage || '',
      // Handoff state for seamless transition
      handoffState: {
        assistantJoined: !isWaitingForAssistant,
        micEnabled: micToggle.enabled,
        cameraEnabled: camToggle.enabled,
        remoteControlActive: isRemoteControlActive,
        liveviewUrl: liveviewUrl,
        remoteControlInteractive: isRemoteControlInteractive,
        isDesktopReady: isDesktopReady,
      },
    };

    try {
      localStorage.setItem(tempKey, JSON.stringify(callData));
      localStorage.setItem('activePopOutCall', JSON.stringify({ assistantId, assistantName }));
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'activePopOutCall',
          newValue: localStorage.getItem('activePopOutCall'),
        })
      );
    } catch (e) {
      console.error('Could not write to localStorage for pop-out call:', e);
      // If localStorage fails, we cannot proceed as essential data is missing.
      toast.error('Could not open call in new tab. Please try again.');
      return;
    }

    const url = new URL(`${window.location.origin}/assistants/call/${assistantId}`);
    url.searchParams.set('dataKey', tempKey);

    window.open(url.toString(), '_blank', 'noopener,noreferrer');

    onHangUp();
  };

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
  const displayName = `${assistant.firstName} ${assistant.surname}`;
  const assistantPhoto = assistant.signedProfilePhotoUrl || assistant.profilePhoto;

  const handleToggleSidePanel = (panel: 'chat' | 'settings') => {
    setActiveSidePanel((current) => (current === panel ? null : panel));
  };

  const showLoadingState = isConnecting || isWaitingForAssistant;
  const loadingMessage = isConnecting
    ? 'Setting up a connection...'
    : waitingMessage || `Waiting for ${assistant.firstName} to join...`;

  return (
    <>
      <AssistantCommunicationHeader
        assistantName={displayName}
        onPopOut={handlePopOut}
        isPopOutDisabled={!connectionDetails}
        onHeaderPointerDown={onHeaderPointerDown}
        onExpand={onExpand}
        onMinimize={onMinimize}
        onHangUp={onHangUp}
      />
      <div className="relative flex min-h-0 flex-1">
        <div className="bg-background/80 relative flex flex-1 flex-col items-center justify-center">
          {isUserViewMaximized && userTrackRef ? (
            <AssistantCommunicationUserView
              imageUrl={userImage}
              trackRef={userTrackRef}
              isCameraOn={camToggle.enabled || screenShareToggle.enabled}
              participant={localParticipant}
              onMinimize={() => setIsUserViewMaximized(false)}
              maximized
            />
          ) : (
            <>
              <AssistantCommunicationMainView
                assistantName={displayName}
                isSpeaking={agentState === 'speaking'}
                imageUrl={assistantPhoto}
                videoTrack={agentVideoTrack}
                isRemoteControlActive={isRemoteControlActive}
                remoteControlUrl={liveviewUrl}
                isInteractive={isRemoteControlInteractive}
                isLoading={showLoadingState}
                loadingMessage={loadingMessage}
                connectionError={connectionError}
                onRetry={onRetry}
              />
              <AnimatePresence>
                {isUserViewVisible && !isConnecting && (
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
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
          {!isUserViewMaximized && !isUserViewVisible && !isConnecting && (
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
                userEmail={userEmail}
                userImage={userImage}
                assistantPhoto={assistantPhoto}
                callType={callType}
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
      />
    </>
  );
};

const MIN_FLOATING_WIDTH = 200;
const MIN_FLOATING_HEIGHT = 160;
const COMPACT_WIDTH_THRESHOLD = 480;
const COMPACT_HEIGHT_THRESHOLD = 380;

interface AssistantCommunicationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assistant: Assistant;
  assistantActions: AssistantActions;
  room: Room;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  isConnecting: boolean;
  userEmail: string | null | undefined;
  userImage: string | null | undefined;
  isWaitingForAssistant: boolean;
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
  connectionDetails: ConnectionDetails | null;
  isSpeakerMuted: boolean;
  onToggleSpeaker: () => void;
}

export function AssistantCommunicationDialog({
  isOpen,
  onClose,
  assistant,
  assistantActions,
  room,
  chatHistories,
  setChatHistories,
  isConnecting,
  userEmail,
  userImage,
  isWaitingForAssistant,
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
  connectionDetails,
  isSpeakerMuted,
  onToggleSpeaker,
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
  React.useEffect(() => {
    if (!isOpen || !isModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        transitionToFloating();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isModal, transitionToFloating]);

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

  const handleResizeEnd = React.useCallback(() => setIsResizing(false), []);

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
            className="fixed inset-0 z-50 bg-black/80"
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
        <RoomAudioRenderer />

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
              waitingMessage={waitingMessage}
              connectionError={connectionError}
              onRetry={onRetry}
              isCallConnected={isCallConnected}
              callType={callType}
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
            chatHistories={chatHistories}
            setChatHistories={setChatHistories}
            assistantActions={assistantActions}
            isConnecting={isConnecting}
            userEmail={userEmail}
            userImage={userImage}
            isWaitingForAssistant={isWaitingForAssistant}
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
            connectionDetails={connectionDetails}
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
      </div>
    </>
  );
}
