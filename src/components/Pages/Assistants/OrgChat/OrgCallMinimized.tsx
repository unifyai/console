'use client';

import * as React from 'react';
import { Room } from 'livekit-client';
import { Maximize2, Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import { RoomContext } from '@livekit/components-react';
import { Button } from '@/components/UI/button';
import { FloatingWidgetShell } from '@/components/Pages/Assistants/Communication/FloatingWidgetShell';
import { OrgCallSession } from '@/types/orgChat';
import { MeetGrid, orgCallTitle } from './OrgCallMeetStage';
import type { OrgCallAssistantInfo, OrgCallHumanInfo } from './OrgCallTiles';

const ControlButton: React.FC<{
  label: string;
  onClick: () => void;
  variant?: 'ghost' | 'destructive';
  testId?: string;
  children: React.ReactNode;
}> = ({ label, onClick, variant = 'ghost', testId, children }) => (
  <Button
    variant={variant}
    size="icon"
    className="bg-card/85 h-8 w-8 rounded-full border border-border shadow-sm"
    onPointerDown={(e) => e.stopPropagation()}
    onClick={onClick}
    aria-label={label}
    data-testid={testId}
  >
    {children}
  </Button>
);

export interface OrgCallMinimizedProps {
  call: OrgCallSession;
  room: Room | null;
  roomEpoch: number;
  currentUserId: string | null;
  humansById: Record<string, OrgCallHumanInfo>;
  assistantsById: Record<string, OrgCallAssistantInfo>;
  localName: string;
  localImage: string | null;
  micEnabled: boolean;
  camEnabled: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onExpand: () => void;
  onLeave: () => void;
}

/**
 * Minimized multi-party call: the shared draggable bottom-right widget, so an
 * org call keeps running (and stays controllable) while the user works
 * anywhere else in the app.
 */
export function OrgCallMinimized({
  call,
  room,
  roomEpoch,
  currentUserId,
  humansById,
  assistantsById,
  localName,
  localImage,
  micEnabled,
  camEnabled,
  onToggleMic,
  onToggleCam,
  onExpand,
  onLeave,
}: OrgCallMinimizedProps) {
  const title = orgCallTitle(call, humansById, currentUserId);
  const joinedCount = call.participants.filter((p) => p.status === 'joined').length;

  const body = (
    <>
      <div className="mb-2 flex w-full items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-caption truncate text-foreground">{title}</p>
          <p className="text-caption text-muted-foreground">
            {joinedCount} joined
            {call.assistantIds.length > 0 ? ` · ${call.assistantIds.length} assistant` : ''}
          </p>
        </div>
      </div>
      <div className="min-h-0 w-full flex-1 overflow-y-auto">
        <MeetGrid
          call={call}
          room={room}
          roomEpoch={roomEpoch}
          currentUserId={currentUserId}
          humansById={humansById}
          assistantsById={assistantsById}
          localName={localName}
          localImage={localImage}
          compact
        />
      </div>
      <div className="mt-2 flex flex-shrink-0 items-center gap-2">
        <ControlButton
          label="Hang up"
          variant="destructive"
          onClick={onLeave}
          testId="org-call-minimized-leave"
        >
          <PhoneOff className="h-4 w-4" />
        </ControlButton>
        <ControlButton
          label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          onClick={onToggleMic}
          testId="org-call-minimized-mic"
        >
          {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </ControlButton>
        <ControlButton
          label={camEnabled ? 'Turn camera off' : 'Turn camera on'}
          onClick={onToggleCam}
          testId="org-call-minimized-cam"
        >
          {camEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </ControlButton>
      </div>
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <ControlButton label="Expand call" onClick={onExpand} testId="org-call-minimized-expand">
          <Maximize2 className="h-4 w-4" />
        </ControlButton>
      </div>
    </>
  );

  return (
    <FloatingWidgetShell
      initialWidth={320}
      initialHeight={260}
      minWidth={240}
      minHeight={200}
      testId="org-call-minimized"
    >
      {room ? <RoomContext.Provider value={room}>{body}</RoomContext.Provider> : body}
    </FloatingWidgetShell>
  );
}
