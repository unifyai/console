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
import {
  presenterLabel,
  presentingCaption,
  resolveFocusedSid,
  sortSharesByStart,
  trackShareStarts,
  type ShareEntry,
  type ShareStartTimes,
} from '@/utils/assistants/screen-shares';
import { isParticipantInCall, presentUserIds } from '@/utils/assistants/call-participants';
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
  const remoteParticipants = call.participants.filter(
    (p) => p.userId !== currentUserId && p.status !== 'declined' && p.status !== 'left'
  );
  const assistantCount = call.assistantIds.length;

  // Keyed on the epoch, which the call engine bumps on every participant
  // connect and disconnect — the room's membership is not React state, so
  // without it a peer arriving would not re-render anything.
  const present = React.useMemo(
    () =>
      presentUserIds(
        room,
        remoteParticipants.map((p) => p.userId)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, roomEpoch, call.participants]
  );

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
        if (!isParticipantInCall(p, present)) {
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
 * One attached video element.
 *
 * Attaching in a ref callback runs on every render and never detaches, which
 * was survivable only while the focused track could never change: switching
 * presenters would otherwise leave the previous element attached and playing.
 */
function AttachedVideo({
  track,
  muted,
  className,
}: {
  track: Track;
  muted: boolean;
  className: string;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return <video ref={ref} className={className} muted={muted} playsInline autoPlay />;
}

/**
 * Presenter focus: one screen share large, Meet style, plus a picker when there
 * is more than one. Must be mounted inside a RoomContext.
 */
function ScreenShareFocus({
  onActiveChange,
  onCountChange,
}: {
  onActiveChange: (active: boolean) => void;
  onCountChange: (count: number) => void;
}) {
  const tracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const live = tracks.filter((t) => t.publication?.track);

  const shares: ShareEntry[] = live.map((t) => ({
    sid: t.publication!.trackSid,
    presenterName: t.participant.name ?? '',
    isLocal: t.participant.isLocal,
  }));

  // First-seen times, so "newest" means newest rather than last-in-the-array.
  const [startedAt, setStartedAt] = React.useState<ShareStartTimes>({});
  const sids = shares
    .map((s) => s.sid)
    .sort()
    .join(',');
  React.useEffect(() => {
    setStartedAt((known) => trackShareStarts(shares, known, Date.now()));
    // Keyed on the set of shares, not the array identity, which changes every
    // render and would restamp every share as new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sids]);

  const [requestedSid, setRequestedSid] = React.useState<string | null>(null);
  const focusedSid = resolveFocusedSid(shares, requestedSid, startedAt);
  const focused = live.find((t) => t.publication!.trackSid === focusedSid);
  const focusedShare = shares.find((s) => s.sid === focusedSid);

  const active = live.length > 0;
  React.useEffect(() => {
    onActiveChange(active);
  }, [active, onActiveChange]);
  React.useEffect(() => {
    onCountChange(live.length);
  }, [live.length, onCountChange]);

  if (!focused?.publication?.track || !focusedShare) return null;

  const ordered = sortSharesByStart(shares, startedAt);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {ordered.length > 1 && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="Shared screens"
          data-testid="org-call-presenter-strip"
        >
          {ordered.map((share) => (
            <button
              key={share.sid}
              type="button"
              role="tab"
              aria-selected={share.sid === focusedSid}
              className={cn(
                'text-caption rounded-full border px-3 py-1',
                share.sid === focusedSid
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
              onClick={() => setRequestedSid(share.sid)}
              data-testid="org-call-presenter-option"
            >
              {presenterLabel(share)}
            </button>
          ))}
        </div>
      )}
      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border bg-black"
        data-testid="org-call-focus"
      >
        <AttachedVideo
          track={focused.publication.track}
          muted={focusedShare.isLocal}
          className="h-full w-full object-contain"
        />
        <div className="from-background/80 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent px-3 py-2">
          <p className="text-caption text-foreground">{presentingCaption(focusedShare)}</p>
        </div>
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
  const [presentingCount, setPresentingCount] = React.useState(0);
  const title = orgCallTitle(call, humansById, currentUserId);
  // Counted the same way the tiles are decided, or the header would contradict
  // the grid it sits above — "1 joined" over two present faces.
  const presentInRoom = React.useMemo(
    () =>
      presentUserIds(
        room,
        call.participants.map((p) => p.userId)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, roomEpoch, call.participants]
  );
  const joinedCount = call.participants.filter((p) => isParticipantInCall(p, presentInRoom)).length;

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
            {/* The picker only appears for two or more, so this is the one
                place that says anybody is presenting at all. */}
            {presentingCount > 0 ? ` · ${presentingCount} presenting` : ''}
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
        {room && (
          <ScreenShareFocus onActiveChange={setFocusActive} onCountChange={setPresentingCount} />
        )}
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
