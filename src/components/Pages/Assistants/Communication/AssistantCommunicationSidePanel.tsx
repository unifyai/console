'use client';

import * as React from 'react';
import { Button } from '@/components/UI/button';
import { X, MessageSquare, Settings, Video, Mic, Volume2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { Label } from '@/components/UI/label';
import { AssistantProfileChatPanel } from '../Profile/AssistantProfileChatPanel';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ChatMessage, CallPill } from '@/types/assistants/chat';

interface AssistantCommunicationSidePanelProps {
  panelType: 'chat' | 'settings' | null;
  onClose: () => void;
  videoDevices?: MediaDeviceInfo[];
  selectedVideoDevice?: string;
  onVideoDeviceChange?: (deviceId: string) => void;
  audioInputDevices?: MediaDeviceInfo[];
  selectedAudioInputDevice?: string;
  onAudioInputDeviceChange?: (deviceId: string) => void;
  audioOutputDevices?: MediaDeviceInfo[];
  selectedAudioOutputDevice?: string;
  onAudioOutputDeviceChange?: (deviceId: string) => void;
  assistant?: Assistant;
  assistantActions?: Pick<AssistantActions, 'chat'> & Partial<Pick<AssistantActions, 'voice'>>;
  chatHistories?: Record<string, ChatMessage[]>;
  setChatHistories?: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories?: Record<string, CallPill[]>;
  setCallPillHistories?: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  userEmail?: string | null;
  userImage?: string | null;
  assistantPhoto?: string | null;
}

export function AssistantCommunicationSidePanel({
  panelType,
  onClose,
  videoDevices = [],
  selectedVideoDevice,
  onVideoDeviceChange,
  audioInputDevices = [],
  selectedAudioInputDevice,
  onAudioInputDeviceChange,
  audioOutputDevices = [],
  selectedAudioOutputDevice,
  onAudioOutputDeviceChange,
  assistant,
  assistantActions,
  chatHistories,
  setChatHistories,
  callPillHistories,
  setCallPillHistories,
  userEmail,
  userImage,
  assistantPhoto,
}: AssistantCommunicationSidePanelProps) {
  const renderSettings = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="camera-select" className="text-title flex items-center gap-2">
          <Video className="h-4 w-4" /> <span className="text-label">Camera</span>
        </Label>
        <Select
          value={selectedVideoDevice}
          onValueChange={onVideoDeviceChange}
          disabled={videoDevices.length === 0}
        >
          <SelectTrigger id="camera-select">
            <SelectValue placeholder="Select a camera..." />
          </SelectTrigger>
          <SelectContent>
            {videoDevices.length > 0 ? (
              videoDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${videoDevices.indexOf(device) + 1}`}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-camera" disabled>
                No cameras found
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mic-select" className="text-title flex items-center gap-2">
          <Mic className="h-4 w-4" /> <span className="text-label">Microphone</span>
        </Label>
        <Select
          value={selectedAudioInputDevice}
          onValueChange={onAudioInputDeviceChange}
          disabled={audioInputDevices.length === 0}
        >
          <SelectTrigger id="mic-select">
            <SelectValue placeholder="Select a microphone..." />
          </SelectTrigger>
          <SelectContent>
            {audioInputDevices.length > 0 ? (
              audioInputDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${audioInputDevices.indexOf(device) + 1}`}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-mic" disabled>
                No microphones found
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="speaker-select" className="text-title flex items-center gap-2">
          <Volume2 className="h-4 w-4" /> <span className="text-label">Speaker</span>
        </Label>
        <Select
          value={selectedAudioOutputDevice}
          onValueChange={onAudioOutputDeviceChange}
          disabled={audioOutputDevices.length === 0}
        >
          <SelectTrigger id="speaker-select">
            <SelectValue placeholder="Select a speaker..." />
          </SelectTrigger>
          <SelectContent>
            {audioOutputDevices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Speaker ${audioOutputDevices.indexOf(device) + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const headerContent = {
    chat: {
      icon: <MessageSquare className="h-5 w-5 text-muted-foreground" />,
      title: 'Chat',
    },
    settings: {
      icon: <Settings className="h-5 w-5 text-muted-foreground" />,
      title: 'Settings',
    },
  };

  if (!panelType) return null;

  return (
    <div className="flex h-full w-full flex-col text-foreground">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          {headerContent[panelType].icon}
          <h3 className="text-title text-semibold">{headerContent[panelType].title}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1">
        {panelType === 'chat' &&
          assistant &&
          assistantActions &&
          chatHistories &&
          setChatHistories && (
            <AssistantProfileChatPanel
              assistant={assistant}
              assistantActions={assistantActions}
              chatHistories={chatHistories}
              setChatHistories={setChatHistories}
              callPillHistories={callPillHistories}
              setCallPillHistories={setCallPillHistories}
              userEmail={userEmail}
            />
          )}
        {panelType === 'settings' && <div className="p-4">{renderSettings()}</div>}
      </div>
    </div>
  );
}
