'use client';

import * as React from 'react';
import { Dialog, DialogContent } from '@/components/UI/dialog';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { AssistantCommunicationHeader } from './AssistantCommunicationHeader';
import { AssistantCommunicationMainView } from './AssistantCommunicationMainView';
import { AssistantCommunicationUserView } from './AssistantCommunicationUserView';
import { AssistantCommunicationControls } from './AssistantCommunicationControls';
import { AssistantCommunicationSidePanel } from './AssistantCommunicationSidePanel';
import { AnimatePresence, motion } from 'framer-motion';
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
  onMinimize: () => void;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  assistantActions: AssistantActions;
  isConnecting: boolean;
  userEmail: string | null | undefined;
  userImage: string | null | undefined;
  isWaitingForAssistant: boolean;
  connectionError: string | null;
  onRetry: () => void;
  isRemoteControlActive: boolean;
  liveviewUrl: string | null;
  isRemoteControlLoading: boolean;
  toggleRemoteControl: () => void;
  isRemoteControlInteractive: boolean;
  toggleRemoteControlInteractive: () => void;
  isCallConnected: boolean;
  callType: 'video' | 'audio' | null;
  connectionDetails: ConnectionDetails | null;
}

const AssistantCommunicationDialogContent: React.FC<AssistantCommunicationDialogContentProps> = ({
  assistant,
  onHangUp,
  onMinimize,
  chatHistories,
  setChatHistories,
  assistantActions,
  isConnecting,
  userEmail,
  userImage,
  isWaitingForAssistant,
  connectionError,
  onRetry,
  isRemoteControlActive,
  liveviewUrl,
  isRemoteControlLoading,
  toggleRemoteControl,
  isRemoteControlInteractive,
  toggleRemoteControlInteractive,
  isCallConnected,
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

  const [isUserViewVisible, setIsUserViewVisible] = React.useState(true);
  const [isUserViewMaximized, setIsUserViewMaximized] = React.useState(false);
  const [activeSidePanel, setActiveSidePanel] = React.useState<'chat' | 'settings' | null>(null);

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
    : `Waiting for ${assistant.firstName} to join...`;

  return (
    <>
      <AssistantCommunicationHeader
        assistantName={displayName}
        onMinimize={onMinimize}
        onPopOut={handlePopOut}
        isPopOutDisabled={!connectionDetails}
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
                      onMinimize={() => setIsUserViewVisible(false)}
                      onMaximize={() => setIsUserViewMaximized(true)}
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
          {activeSidePanel && (
            <motion.div
              key="side-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
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
                assistantActions={{ chat: assistantActions.chat }}
                chatHistories={chatHistories}
                setChatHistories={setChatHistories}
                userEmail={userEmail}
                userImage={userImage}
                assistantPhoto={assistantPhoto}
                callType={callType}
              />
            </motion.div>
          )}
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
        onToggleRemoteControlInteractive={toggleRemoteControlInteractive}
        isConnectionEstablished={isCallConnected}
        callType={callType}
      />
    </>
  );
};

interface AssistantCommunicationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  assistant: Assistant;
  assistantActions: AssistantActions;
  room: Room;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  isConnecting: boolean;
  userEmail: string | null | undefined;
  userImage: string | null | undefined;
  isWaitingForAssistant: boolean;
  connectionError: string | null;
  onRetry: () => void;
  isRemoteControlActive: boolean;
  liveviewUrl: string | null;
  isRemoteControlLoading: boolean;
  toggleRemoteControl: () => void;
  isRemoteControlInteractive: boolean;
  toggleRemoteControlInteractive: () => void;
  isCallConnected: boolean;
  callType: 'video' | 'audio' | null;
  connectionDetails: ConnectionDetails | null;
}

export function AssistantCommunicationDialog({
  isOpen,
  onClose,
  onMinimize,
  assistant,
  assistantActions,
  room,
  chatHistories,
  setChatHistories,
  isConnecting,
  userEmail,
  userImage,
  isWaitingForAssistant,
  connectionError,
  onRetry,
  isRemoteControlActive,
  liveviewUrl,
  isRemoteControlLoading,
  toggleRemoteControl,
  isRemoteControlInteractive,
  toggleRemoteControlInteractive,
  isCallConnected,
  callType,
  connectionDetails,
}: AssistantCommunicationDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onMinimize()}>
      <DialogContent
        className="flex h-[90vh] w-[90vw] max-w-4xl flex-col gap-0 border bg-background p-0 text-foreground"
        hideClose
      >
        <RoomAudioRenderer />
        <AssistantCommunicationDialogContent
          assistant={assistant}
          onHangUp={onClose}
          onMinimize={onMinimize}
          chatHistories={chatHistories}
          setChatHistories={setChatHistories}
          assistantActions={assistantActions}
          isConnecting={isConnecting}
          userEmail={userEmail}
          userImage={userImage}
          isWaitingForAssistant={isWaitingForAssistant}
          connectionError={connectionError}
          onRetry={onRetry}
          isRemoteControlActive={isRemoteControlActive}
          liveviewUrl={liveviewUrl}
          isRemoteControlLoading={isRemoteControlLoading}
          toggleRemoteControl={toggleRemoteControl}
          isRemoteControlInteractive={isRemoteControlInteractive}
          toggleRemoteControlInteractive={toggleRemoteControlInteractive}
          isCallConnected={isCallConnected}
          callType={callType}
          connectionDetails={connectionDetails}
        />
      </DialogContent>
    </Dialog>
  );
}
