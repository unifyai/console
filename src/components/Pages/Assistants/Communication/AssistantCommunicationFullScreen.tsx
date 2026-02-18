'use client';

import * as React from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { Room, RoomEvent, Track } from 'livekit-client';
import {
  RoomContext,
  RoomAudioRenderer,
  useTrackToggle,
  useVoiceAssistant,
  useLocalParticipant,
  TrackReference,
  useTracks,
  useMediaDeviceSelect,
} from '@livekit/components-react';
import { AssistantCommunicationMainView } from '@/components/Pages/Assistants/Communication/AssistantCommunicationMainView';
import { AssistantCommunicationUserView } from '@/components/Pages/Assistants/Communication/AssistantCommunicationUserView';
import { AssistantCommunicationControls } from '@/components/Pages/Assistants/Communication/AssistantCommunicationControls';
import { AssistantCommunicationSidePanel } from '@/components/Pages/Assistants/Communication/AssistantCommunicationSidePanel';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';

type AssistantActionsSubset = Pick<AssistantActions, 'chat' | 'call' | 'desktop'>;

interface AssistantCommunicationFullScreenProps {
  assistant: Assistant;
  assistantActions: AssistantActionsSubset;
  user: {
    id: string;
    image: string | null | undefined;
    email: string | null | undefined;
  };
}

const FullScreenCallUI: React.FC<{
  room: Room;
  assistant: Assistant;
  userImage: string;
  userEmail: string | null | undefined;
  callType: 'video' | 'audio' | null;
  isLoading: boolean;
  loadingMessage: string;
  connectionError: string | null;
  onRetry: () => void;
  assistantActions: AssistantActionsSubset;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  isRemoteControlActive: boolean;
  liveviewUrl: string | null;
  isRemoteControlLoading: boolean;
  toggleRemoteControl: () => void;
  isRemoteControlInteractive: boolean;
  isRemoteControlInteractiveLoading: boolean;
  toggleRemoteControlInteractive: () => void;
  isWaitingForAssistant: boolean;
  isDesktopReady: boolean;
}> = ({
  room,
  assistant,
  userImage,
  userEmail,
  callType,
  isLoading,
  loadingMessage,
  connectionError,
  onRetry,
  assistantActions,
  chatHistories,
  setChatHistories,
  isRemoteControlActive,
  liveviewUrl,
  isRemoteControlLoading,
  toggleRemoteControl,
  isRemoteControlInteractive,
  isRemoteControlInteractiveLoading,
  toggleRemoteControlInteractive,
  isWaitingForAssistant,
  isDesktopReady,
}) => {
  // Standard LiveKit hooks
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

  // UI State
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
        const maxWidth = 600;
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

  // Device selection state
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = React.useState<string>('');
  const {
    devices: audioInputDevices,
    activeDeviceId: activeAudioInputDeviceId,
    setActiveMediaDevice: setActiveAudioInputDevice,
  } = useMediaDeviceSelect({ kind: 'audioinput', room });
  const {
    devices: audioOutputDevices,
    activeDeviceId: activeAudioOutputDeviceId,
    setActiveMediaDevice: setActiveAudioOutputDevice,
  } = useMediaDeviceSelect({ kind: 'audiooutput', room });

  React.useEffect(() => {
    const getDevices = async () => {
      const videoDevs = await Room.getLocalDevices('videoinput');
      setVideoDevices(videoDevs);
      const currentCam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
      if (currentCam) {
        const deviceId = await currentCam.getDeviceId();
        setSelectedVideoDevice(deviceId || '');
      }
    };
    if (room.state === 'connected') {
      getDevices();
      navigator.mediaDevices.addEventListener('devicechange', getDevices);
      return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }
  }, [room, room.state]);

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
  const assistantName = `${assistant.firstName} ${assistant.surname}`;
  const assistantPhoto = assistant.signedProfilePhotoUrl || assistant.profilePhoto;

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
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
                assistantName={assistantName}
                isSpeaking={agentState === 'speaking'}
                imageUrl={assistantPhoto}
                videoTrack={agentVideoTrack}
                isRemoteControlActive={isRemoteControlActive}
                remoteControlUrl={liveviewUrl}
                isInteractive={isRemoteControlInteractive}
                isLoading={isLoading}
                loadingMessage={loadingMessage}
                connectionError={connectionError}
                onRetry={onRetry}
              />
              <AnimatePresence>
                {isUserViewVisible && !isLoading && !connectionError && (
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
                      onMinimize={() => setIsUserViewVisible(false)}
                      onMaximize={() => setIsUserViewMaximized(true)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
          {!isUserViewMaximized && !isUserViewVisible && !isLoading && !connectionError && (
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
                onVideoDeviceChange={(id) => room.switchActiveDevice('videoinput', id)}
                audioInputDevices={audioInputDevices}
                selectedAudioInputDevice={activeAudioInputDeviceId}
                onAudioInputDeviceChange={setActiveAudioInputDevice}
                audioOutputDevices={audioOutputDevices}
                selectedAudioOutputDevice={activeAudioOutputDeviceId}
                onAudioOutputDeviceChange={setActiveAudioOutputDevice}
                callType={callType}
                assistant={assistant}
                assistantActions={{ chat: assistantActions.chat }}
                chatHistories={chatHistories}
                setChatHistories={setChatHistories}
                userEmail={userEmail}
                userImage={userImage}
                assistantPhoto={assistantPhoto}
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
        onHangUp={() => room.disconnect()}
        onToggleChat={() => setActiveSidePanel((p) => (p === 'chat' ? null : 'chat'))}
        onToggleSettings={() => setActiveSidePanel((p) => (p === 'settings' ? null : 'settings'))}
        isRemoteControlActive={isRemoteControlActive}
        onToggleRemoteControl={toggleRemoteControl}
        isRemoteControlLoading={isRemoteControlLoading}
        isRemoteControlInteractive={isRemoteControlInteractive}
        isRemoteControlInteractiveLoading={isRemoteControlInteractiveLoading}
        onToggleRemoteControlInteractive={toggleRemoteControlInteractive}
        isConnectionEstablished={room.state === 'connected'}
        isAssistantJoined={!isWaitingForAssistant}
        isDesktopReady={isDesktopReady}
        callType={callType}
      />
    </div>
  );
};

const AssistantCommunicationFullScreen: React.FC<AssistantCommunicationFullScreenProps> = ({
  assistant,
  assistantActions,
  user,
}) => {
  const searchParams = useSearchParams();
  const params = useParams();

  const [callData, setCallData] = React.useState<{
    serverUrl: string | null;
    token: string | null;
    callType: 'video' | 'audio' | null;
    assistantName: string;
    assistantPhoto: string;
    userImage: string;
    handoffState?: {
      assistantJoined?: boolean;
      micEnabled?: boolean;
      cameraEnabled?: boolean;
      remoteControlActive?: boolean;
      liveviewUrl?: string | null;
      remoteControlInteractive?: boolean;
    };
  } | null>(null);

  const [room] = React.useState(() => new Room());
  const [isConnecting, setIsConnecting] = React.useState(true);
  const [isWaitingForAssistant, setIsWaitingForAssistant] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [chatHistories, setChatHistories] = React.useState<Record<string, ChatMessage[]>>({});

  // Remote control state
  const [isDesktopReady, setIsDesktopReady] = React.useState(false);
  const desktopPollRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isRemoteControlActive, setIsRemoteControlActive] = React.useState(false);
  const [liveviewUrl, setLiveviewUrl] = React.useState<string | null>(null);
  const [isRemoteControlLoading, setIsRemoteControlLoading] = React.useState(false);
  const [isRemoteControlInteractive, setIsRemoteControlInteractive] = React.useState(false);
  const [isRemoteControlInteractiveLoading, setIsRemoteControlInteractiveLoading] =
    React.useState(false);

  // Stop remote control helper
  const stopRemoteControl = React.useCallback(() => {
    setIsRemoteControlActive(false);
    setLiveviewUrl(null);
    setIsRemoteControlInteractive(false);
  }, []);

  // Toggle remote control (show/hide assistant screen)
  const toggleRemoteControl = React.useCallback(async () => {
    if (!assistant) return;

    if (isRemoteControlActive) {
      if (isRemoteControlInteractive) {
        assistantActions.desktop
          .sendSystemEvent(
            assistant.agentId,
            'user_remote_control_stopped',
            'User released remote control of assistant desktop'
          )
          .catch(console.error);
      }
      assistantActions.desktop
        .sendSystemEvent(
          assistant.agentId,
          'assistant_screen_share_stopped',
          'User disabled assistant screen sharing'
        )
        .catch(console.error);
      stopRemoteControl();
      return;
    }

    setIsRemoteControlLoading(true);
    try {
      const result = await assistantActions.desktop.getLiveviewUrl(assistant.agentId);
      if ('liveviewUrl' in result && result.liveviewUrl) {
        setLiveviewUrl(result.liveviewUrl);
        setIsRemoteControlActive(true);
        assistantActions.desktop
          .sendSystemEvent(
            assistant.agentId,
            'assistant_screen_share_started',
            'User enabled assistant screen sharing'
          )
          .catch(console.error);
      } else if ('detail' in result) {
        console.error('[FullScreen] Failed to get liveview URL:', result.detail);
      }
    } catch (err) {
      console.error('[FullScreen] Error fetching liveview URL:', err);
    } finally {
      setIsRemoteControlLoading(false);
    }
  }, [
    isRemoteControlActive,
    isRemoteControlInteractive,
    stopRemoteControl,
    assistantActions.desktop,
    assistant,
  ]);

  // Toggle interactive mode for remote control
  const toggleRemoteControlInteractive = React.useCallback(async () => {
    if (!isRemoteControlActive || !assistant) return;

    const nextState = !isRemoteControlInteractive;
    const eventType = nextState ? 'user_remote_control_started' : 'user_remote_control_stopped';
    const message = nextState
      ? 'User took remote control of assistant desktop'
      : 'User released remote control of assistant desktop';

    setIsRemoteControlInteractiveLoading(true);

    try {
      const result = await assistantActions.desktop.sendSystemEvent(
        assistant.agentId,
        eventType,
        message
      );
      if (result.detail) {
        console.error('[FullScreen] Error sending interaction event:', result.detail);
      } else {
        setIsRemoteControlInteractive(nextState);
      }
    } catch (err) {
      console.error('[FullScreen] Error sending interaction event:', err);
    } finally {
      setIsRemoteControlInteractiveLoading(false);
    }
  }, [isRemoteControlActive, isRemoteControlInteractive, assistantActions.desktop, assistant]);

  React.useEffect(() => {
    const dataKey = searchParams.get('dataKey');
    if (!dataKey) {
      setError('Missing call data key. This tab can be closed.');
      setIsConnecting(false);
      return;
    }
    try {
      const storedData = localStorage.getItem(dataKey);
      if (storedData) {
        const data = JSON.parse(storedData);
        setCallData(data);
        localStorage.removeItem(dataKey);
      } else {
        throw new Error('Call data not found in storage.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to read call data. This tab can be closed.');
      setIsConnecting(false);
      if (dataKey) localStorage.removeItem(dataKey);
    }
  }, [searchParams]);

  const connectToRoom = React.useCallback(async () => {
    if (!callData) return;
    const { serverUrl, token, callType, handoffState } = callData;

    if (!token || !serverUrl) {
      setError('Missing connection details. This tab can be closed.');
      setIsConnecting(false);
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await room.connect(serverUrl, token);

      // Apply mic/camera state from handoff or use defaults
      const micEnabled =
        handoffState && typeof handoffState.micEnabled === 'boolean'
          ? handoffState.micEnabled
          : true;
      const cameraEnabled =
        handoffState && typeof handoffState.cameraEnabled === 'boolean'
          ? handoffState.cameraEnabled
          : callType === 'video';

      await room.localParticipant.setMicrophoneEnabled(micEnabled);
      await room.localParticipant.setCameraEnabled(cameraEnabled);

      setIsConnecting(false);

      // Determine waiting state: use handoff if available, otherwise check room
      if (handoffState && typeof handoffState.assistantJoined === 'boolean') {
        // Trust handoff state initially, but verify against room
        // If handoff says joined but room shows otherwise, still show waiting
        const actuallyJoined = room.numParticipants >= 2 || handoffState.assistantJoined;
        setIsWaitingForAssistant(!actuallyJoined);
      } else {
        // Legacy path: no handoff state, check room directly
        setIsWaitingForAssistant(room.numParticipants < 2);
      }

      // Restore remote control state from handoff
      if (
        handoffState &&
        handoffState.remoteControlActive &&
        handoffState.liveviewUrl &&
        typeof handoffState.liveviewUrl === 'string' &&
        handoffState.liveviewUrl.length > 0
      ) {
        setLiveviewUrl(handoffState.liveviewUrl);
        setIsRemoteControlActive(true);
        if (handoffState.remoteControlInteractive) {
          setIsRemoteControlInteractive(true);
        }
      }
    } catch (err) {
      console.error('Failed to connect to LiveKit room in new tab:', err);
      setError('Failed to connect to the call.');
      setIsConnecting(false);
    }
  }, [room, callData]);

  React.useEffect(() => {
    if (callData) {
      connectToRoom();
    }
  }, [callData, connectToRoom]);

  React.useEffect(() => {
    const handleUnload = () => {
      localStorage.removeItem('activePopOutCall');
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'activePopOutCall', newValue: null })
      );
    };
    const assistantId = Array.isArray(params.assistantId)
      ? params.assistantId[0]
      : params.assistantId;
    if (assistant && assistantId) {
      localStorage.setItem(
        'activePopOutCall',
        JSON.stringify({
          assistantId,
          assistantName: `${assistant.firstName} ${assistant.surname}`,
        })
      );
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'activePopOutCall',
          newValue: localStorage.getItem('activePopOutCall'),
        })
      );
    }
    window.addEventListener('beforeunload', handleUnload);

    const onParticipantConnected = () => setIsWaitingForAssistant(false);
    const handleDisconnect = () => window.close();

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.Disconnected, handleDisconnect);

    // Add ping-pong listener for state verification
    const handlePing = (event: StorageEvent) => {
      if (event.key === 'popOutCallPing' && event.newValue) {
        localStorage.setItem('popOutCallPong', event.newValue);
        setTimeout(() => localStorage.removeItem('popOutCallPong'), 500);
      }
    };

    window.addEventListener('storage', handlePing);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('storage', handlePing);
      handleUnload();
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.Disconnected, handleDisconnect);
      if (room.state !== 'disconnected') {
        room.disconnect();
      }
    };
  }, [room, assistant, params.assistantId]);

  // Poll for desktop VM readiness once connected.
  // Uses recursive setTimeout so the next check only schedules after
  // the current one completes, avoiding overlapping calls.
  React.useEffect(() => {
    if (isConnecting || !assistant) return;

    let cancelled = false;

    const stopPoll = () => {
      if (desktopPollRef.current) {
        clearTimeout(desktopPollRef.current);
        desktopPollRef.current = null;
      }
    };

    const scheduleCheck = () => {
      desktopPollRef.current = setTimeout(async () => {
        if (cancelled) return;
        try {
          const result = await assistantActions.desktop.getLiveviewUrl(assistant.agentId);
          if (!cancelled && result && 'liveviewUrl' in result && result.liveviewUrl) {
            setIsDesktopReady(true);
            return;
          }
        } catch {
          // VM not ready yet
        }
        if (!cancelled) scheduleCheck();
      }, 3000);
    };

    (async () => {
      try {
        const result = await assistantActions.desktop.getLiveviewUrl(assistant.agentId);
        if (!cancelled && result && 'liveviewUrl' in result && result.liveviewUrl) {
          setIsDesktopReady(true);
          return;
        }
      } catch {
        // VM not ready yet
      }
      if (!cancelled) scheduleCheck();
    })();

    return () => {
      cancelled = true;
      stopPoll();
    };
  }, [isConnecting, assistant, assistantActions.desktop]);

  if (!callData || !assistant) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-body-muted mt-4">Loading call...</p>
      </div>
    );
  }

  const showLoadingState = isConnecting || isWaitingForAssistant;
  const loadingMessage = isConnecting
    ? 'Setting up a connection...'
    : `Waiting for ${assistant.firstName} to join...`;

  return (
    <RoomContext.Provider value={room}>
      <RoomAudioRenderer />
      <FullScreenCallUI
        room={room}
        assistant={assistant}
        userImage={user.image || ''}
        userEmail={user.email}
        callType={callData.callType}
        isLoading={showLoadingState}
        loadingMessage={loadingMessage}
        connectionError={error}
        onRetry={connectToRoom}
        assistantActions={assistantActions}
        chatHistories={chatHistories}
        setChatHistories={setChatHistories}
        isRemoteControlActive={isRemoteControlActive}
        liveviewUrl={liveviewUrl}
        isRemoteControlLoading={isRemoteControlLoading}
        toggleRemoteControl={toggleRemoteControl}
        isRemoteControlInteractive={isRemoteControlInteractive}
        isRemoteControlInteractiveLoading={isRemoteControlInteractiveLoading}
        toggleRemoteControlInteractive={toggleRemoteControlInteractive}
        isWaitingForAssistant={isWaitingForAssistant}
        isDesktopReady={isDesktopReady}
      />
    </RoomContext.Provider>
  );
};

export default AssistantCommunicationFullScreen;
