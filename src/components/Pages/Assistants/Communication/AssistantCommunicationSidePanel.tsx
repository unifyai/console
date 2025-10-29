'use client';

import * as React from 'react';
import { Button } from '@/components/UI/button';
import { X, MessageSquare, Settings, Video, Mic, Volume2, Captions } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import { Label } from '@/components/UI/label';
import { AssistantProfileChatPanel } from '../Assistants/Profile/AssistantProfileChatPanel';
import { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { ChatMessage } from '@/types/assistants/chat';
import { AssistantCommunicationTranscriptionsPanel } from './AssistantCommunicationTranscriptionsPanel';

interface AssistantCommunicationSidePanelProps {
    panelType: 'chat' | 'settings' | 'transcriptions' | null;
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
    assistantActions?: AssistantActions;
    chatHistories?: Record<string, ChatMessage[]>;
    setChatHistories?: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
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
    userImage,
    assistantPhoto,
}: AssistantCommunicationSidePanelProps) {

    const renderSettings = () => (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="camera-select" className="text-sm font-medium flex items-center gap-2">
                    <Video className="h-4 w-4" /> Camera
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
                            videoDevices.map(device => (
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
                <Label htmlFor="mic-select" className="text-sm font-medium flex items-center gap-2">
                    <Mic className="h-4 w-4" /> Microphone
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
                            audioInputDevices.map(device => (
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
                <Label htmlFor="speaker-select" className="text-sm font-medium flex items-center gap-2">
                    <Volume2 className="h-4 w-4" /> Speaker
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
                        {audioOutputDevices.map(device => (
                            <SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `Speaker ${audioOutputDevices.indexOf(device) + 1}`}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );

    const headerContent = {
        chat: {
            icon: <MessageSquare className="h-5 w-5 text-muted-foreground" />,
            title: "Chat",
        },
        settings: {
            icon: <Settings className="h-5 w-5 text-muted-foreground" />,
            title: "Settings",
        },
        transcriptions: {
            icon: <Captions className="h-5 w-5 text-muted-foreground" />,
            title: "Transcriptions",
        },
    };

    if (!panelType) return null;

    return (
        <div className="h-full flex flex-col w-full text-foreground">
            {/* Header */}
            <div className="px-4 py-2.5 border-b flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    {headerContent[panelType].icon}
                    <h3 className="text-sm font-semibold">{headerContent[panelType].title}</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0">
                {panelType === 'chat' && assistant && assistantActions && chatHistories && setChatHistories && (
                    <AssistantProfileChatPanel
                        assistant={assistant}
                        assistantActions={assistantActions}
                        chatHistories={chatHistories}
                        setChatHistories={setChatHistories}
                    />
                )}
                {panelType === 'settings' && (
                    <div className="p-4">
                        {renderSettings()}
                    </div>
                )}
                {panelType === 'transcriptions' && (
                    <AssistantCommunicationTranscriptionsPanel
                        userImage={userImage}
                        assistantPhoto={assistantPhoto}
                    />
                )}
            </div>
        </div>
    );
}
