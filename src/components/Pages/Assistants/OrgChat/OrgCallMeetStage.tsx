'use client';

import * as React from 'react';
import { Room, Track } from 'livekit-client';
import {
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Settings,
  Video,
  VideoOff,
  UserPlus,
  LogOut,
} from 'lucide-react';
import { RoomContext, useMediaDeviceSelect, useTracks } from '@livekit/components-react';
import { Button } from '@/components/UI/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { cn } from '@/lib/utils';
import { OrgCallSession } from '@/types/orgChat';
import {
  AssistantTile,
  HumanTile,
  LocalHumanTile,
  OrgCallAssistantInfo,
  OrgCallHumanInfo,
  RemoteHumanTile,
} from './OrgCallTiles';

export type { OrgCallAssistantInfo, OrgCallHumanInfo } from './OrgCallTiles';

export function orgCallTitle(
  call: OrgCallSession,
  humansById: Record<string, OrgCallHumanInfo>,
  currentUserId: string | null
): string {
  if (call.scope === 'team') return 'Team call';
  if (call.scope === 'group') return 'Group call';
  return `Call with ${
    humansById[call.calleeUserId || '']?.name ||
    humansById[call.userIds.find((id) => id !== currentUserId) || '']?.name ||
    'Teammate'
  }`;
}

/**
 * Participant tile grid shared by the full Meet stage and the minimized
 * widget: local human first, then remote humans (joined live, invited
 * dimmed as ringing), then one live tile per assistant on the call.
 */
export function MeetGrid({
  call,
  room,
  roomEpoch,
  currentUserId,
  humansById,
  assistantsById,
  localName,
  localImage,
  compact = false,
  className,
}: {
  call: OrgCallSession;
  room: Room | null;
  roomEpoch: number;
  currentUserId: string | null;
  humansById: Record<string, OrgCallHumanInfo>;
  assistantsById: Record<string, OrgCallAssistantInfo>;
  localName: string;
  localImage: string | null;
  compact?: boolean;
  className?: string;
}) {
  void roomEpoch;
  const remoteParticipants = call.participants.filter(
    (p) => p.userId !== currentUserId && p.status !== 'declined' && p.status !== 'left'
  );
  const assistantCount = call.assistantIds.length;

  return (
    <div
      className={cn(
        'grid gap-3',
        compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
        className
      )}
      data-testid="org-call-meet-grid"
    >
      {room ? (
        <LocalHumanTile name={localName} image={localImage} room={room} compact={compact} />
      ) : (
        <HumanTile name={localName} image={localImage} isSpeaking={false} compact={compact} />
      )}
      {remoteParticipants.map((p) => {
        const human = humansById[p.userId];
        const name = human?.name || 'Teammate';
        const image = human?.image ?? null;
        if (p.status !== 'joined') {
          return (
            <HumanTile
              key={p.userId}
              name={name}
              image={image}
              isSpeaking={false}
              ringing
              compact={compact}
            />
          );
        }
        return (
          <RemoteHumanTile
            key={p.userId}
            name={name}
            image={image}
            userId={p.userId}
            room={room}
            compact={compact}
          />
        );
      })}
      {call.assistantIds.map((assistantId) => {
        const assistant = assistantsById[String(assistantId)];
        return (
          <AssistantTile
            key={assistantId}
            assistantId={assistantId}
            name={assistant?.name || 'Assistant'}
            room={room}
            assistantCount={assistantCount}
            compact={compact}
          />
        );
      })}
    </div>
  );
}

/**
 * Presenter focus: renders the most recent screen-share track large, Meet
 * style. Must be mounted inside a RoomContext.
 */
function ScreenShareFocus({ onActiveChange }: { onActiveChange: (active: boolean) => void }) {
  const tracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const focus = tracks.filter((t) => t.publication?.track).at(-1);
  const active = !!focus;
  React.useEffect(() => {
    onActiveChange(active);
  }, [active, onActiveChange]);
  if (!focus?.publication?.track) return null;
  const track = focus.publication.track;
  const presenterName = focus.participant.isLocal
    ? 'You are presenting'
    : `${focus.participant.name || 'Teammate'} is presenting`;
  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border bg-black"
      data-testid="org-call-focus"
    >
      <video
        ref={(el) => {
          if (el) track.attach(el);
        }}
        className="h-full w-full object-contain"
        muted={focus.participant.isLocal}
        playsInline
        autoPlay
      />
      <div className="from-background/80 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent px-3 py-2">
        <p className="text-caption text-foreground">{presenterName}</p>
      </div>
    </div>
  );
}

function DeviceSelectList({ kind, label }: { kind: 'audioinput' | 'videoinput'; label: string }) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind });
  return (
    <div className="flex flex-col gap-1">
      <p className="text-caption text-muted-foreground">{label}</p>
      {devices.length === 0 ? (
        <p className="text-caption px-2 py-1">No devices found</p>
      ) : (
        devices.map((device) => (
          <button
            key={device.deviceId}
            type="button"
            className={cn(
              'text-body w-full truncate rounded-md px-2 py-1.5 text-left hover:bg-muted',
              device.deviceId === activeDeviceId && 'bg-muted font-medium'
            )}
            onClick={() => void setActiveMediaDevice(device.deviceId)}
          >
            {device.label || `${label} ${device.deviceId.slice(0, 6)}`}
          </button>
        ))
      )}
    </div>
  );
}

/** Mic/camera device pickers; only meaningful with a live room. */
function DeviceSettingsMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          aria-label="Audio and video settings"
          data-testid="org-call-device-settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="flex w-72 flex-col gap-3">
        <DeviceSelectList kind="audioinput" label="Microphone" />
        <DeviceSelectList kind="videoinput" label="Camera" />
      </PopoverContent>
    </Popover>
  );
}

export interface OrgCallMeetStageProps {
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
  screenShareEnabled: boolean;
  isHost: boolean;
  addableAssistants: OrgCallAssistantInfo[];
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onMinimize: () => void;
  onLeave: () => void;
  onEnd: () => void;
  onAddAssistant: (assistantId: number) => void;
}

/**
 * Full Meet stage: full-viewport overlay with a presenter focus area (screen
 * share), participant grid/rail, and the call control bar.
 */
export function OrgCallMeetStage({
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
  screenShareEnabled,
  isHost,
  addableAssistants,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onMinimize,
  onLeave,
  onEnd,
  onAddAssistant,
}: OrgCallMeetStageProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [focusActive, setFocusActive] = React.useState(false);
  const title = orgCallTitle(call, humansById, currentUserId);
  const joinedCount = call.participants.filter((p) => p.status === 'joined').length;

  const content = (
    <div
      role="dialog"
      aria-label={title}
      data-testid="org-call-meet-stage"
      className="fixed inset-0 z-50 flex flex-col gap-3 bg-background p-4 sm:p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-title truncate text-foreground">{title}</p>
          <p className="text-caption text-muted-foreground">
            {joinedCount} joined
            {call.assistantIds.length > 0
              ? ` · ${call.assistantIds.length} assistant${call.assistantIds.length > 1 ? 's' : ''}`
              : ''}
          </p>
        </div>
        <Button
          size="icon"
          variant="outline"
          onClick={onMinimize}
          aria-label="Minimize call"
          data-testid="org-call-minimize"
        >
          <Minimize2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {room && <ScreenShareFocus onActiveChange={setFocusActive} />}
        <MeetGrid
          call={call}
          room={room}
          roomEpoch={roomEpoch}
          currentUserId={currentUserId}
          humansById={humansById}
          assistantsById={assistantsById}
          localName={localName}
          localImage={localImage}
          compact={focusActive}
          className={
            focusActive
              ? 'grid-cols-6 sm:grid-cols-8 lg:grid-cols-10'
              : 'mx-auto w-full max-w-4xl flex-1 content-center overflow-y-auto py-4'
          }
        />
      </div>

      {pickerOpen && addableAssistants.length > 0 && (
        <div
          className="mx-auto w-full max-w-md rounded-lg border p-2"
          data-testid="org-call-add-assistant-picker"
        >
          {addableAssistants.map((assistant) => (
            <button
              key={assistant.agentId}
              type="button"
              className="text-body flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
              onClick={() => {
                onAddAssistant(Number(assistant.agentId));
                setPickerOpen(false);
              }}
            >
              {assistant.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          size="icon"
          variant={micEnabled ? 'secondary' : 'destructive'}
          onClick={onToggleMic}
          aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          data-testid="org-call-toggle-mic"
        >
          {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant={camEnabled ? 'secondary' : 'outline'}
          onClick={onToggleCam}
          aria-label={camEnabled ? 'Turn camera off' : 'Turn camera on'}
          data-testid="org-call-toggle-cam"
        >
          {camEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant={screenShareEnabled ? 'secondary' : 'outline'}
          onClick={onToggleScreenShare}
          aria-label={screenShareEnabled ? 'Stop presenting' : 'Present your screen'}
          data-testid="org-call-toggle-screenshare"
        >
          {screenShareEnabled ? (
            <MonitorX className="h-4 w-4" />
          ) : (
            <MonitorUp className="h-4 w-4" />
          )}
        </Button>
        {room && <DeviceSettingsMenu />}
        {(call.scope === 'team' || call.scope === 'group') && addableAssistants.length > 0 && (
          <Button
            size="icon"
            variant="outline"
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="Add assistant"
            data-testid="org-call-add-assistant"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="outline"
          onClick={onLeave}
          aria-label="Leave call"
          data-testid="org-call-leave"
        >
          <LogOut className="h-4 w-4" />
        </Button>
        {(isHost || call.scope === 'dm') && (
          <Button
            size="icon"
            variant="destructive"
            onClick={onEnd}
            aria-label="End call"
            data-testid="org-call-end"
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  if (room) {
    return <RoomContext.Provider value={room}>{content}</RoomContext.Provider>;
  }
  return content;
}
