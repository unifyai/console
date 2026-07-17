'use client';

import * as React from 'react';
import { RemoteParticipant, Room, Track } from 'livekit-client';
import { Mic, MicOff, PhoneOff, Video, VideoOff, UserPlus, LogOut } from 'lucide-react';
import { RoomContext, useIsSpeaking, useTracks } from '@livekit/components-react';
import { Button } from '@/components/UI/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { UnityCallAvatar } from '@/components/Pages/Assistants/Communication/UnityCallAvatar';
import { cn } from '@/lib/utils';
import { OrgCallSession } from '@/types/orgChat';

export interface OrgCallHumanInfo {
  userId: string;
  name: string;
  image: string | null;
}

export interface OrgCallAssistantInfo {
  agentId: string;
  name: string;
  image: string | null;
}

function HumanTile({
  name,
  image,
  isSpeaking,
  videoEl,
}: {
  name: string;
  image: string | null;
  isSpeaking: boolean;
  videoEl?: React.ReactNode;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div
      className={cn(
        'bg-muted/40 relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border',
        isSpeaking && 'animate-call-speaking-pulse'
      )}
      data-testid="org-call-human-tile"
    >
      {videoEl ? (
        <div className="absolute inset-0">{videoEl}</div>
      ) : (
        <Avatar className="h-20 w-20">
          {image ? <AvatarImage src={image} alt={name} /> : null}
          <AvatarFallback className="text-title">{initials || '?'}</AvatarFallback>
        </Avatar>
      )}
      <div className="from-background/80 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent px-2 py-2">
        <p className="text-caption truncate text-center text-foreground">{name}</p>
      </div>
    </div>
  );
}

function LocalHumanTile({
  name,
  image,
  room,
}: {
  name: string;
  image: string | null;
  room: Room | null;
}) {
  const local = room?.localParticipant;
  const isSpeaking = useIsSpeaking(local);
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], {
    onlySubscribed: false,
  });
  const localCam = tracks.find((t) => t.participant.isLocal && t.publication?.track);
  let videoEl: React.ReactNode = null;
  if (localCam?.publication?.track) {
    const track = localCam.publication.track;
    videoEl = (
      <video
        ref={(el) => {
          if (el) track.attach(el);
        }}
        className="h-full w-full object-cover"
        muted
        playsInline
        autoPlay
      />
    );
  }
  return <HumanTile name={name} image={image} isSpeaking={!!isSpeaking} videoEl={videoEl} />;
}

function RemoteHumanTile({
  name,
  image,
  userId,
  room,
}: {
  name: string;
  image: string | null;
  userId: string;
  room: Room | null;
}) {
  // A participant can be "joined" in the Orchestra session before (or without)
  // their LiveKit connection existing — e.g. the answer API succeeded but the
  // room connect is still in flight. Participant-context hooks throw when
  // given undefined, so only mount the connected tile once the peer is
  // actually present in the room.
  const participant = room
    ? [...room.remoteParticipants.values()].find(
        (p) => p.identity.startsWith(`user-${userId}-`) || p.name === name
      )
    : undefined;
  if (!participant) {
    return <HumanTile name={name} image={image} isSpeaking={false} />;
  }
  return <ConnectedRemoteHumanTile name={name} image={image} participant={participant} />;
}

function ConnectedRemoteHumanTile({
  name,
  image,
  participant,
}: {
  name: string;
  image: string | null;
  participant: RemoteParticipant;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], {
    onlySubscribed: true,
  });
  const cam = tracks.find(
    (t) =>
      !t.participant.isLocal &&
      t.participant.identity === participant.identity &&
      t.publication?.track
  );
  let videoEl: React.ReactNode = null;
  if (cam?.publication?.track) {
    const track = cam.publication.track;
    videoEl = (
      <video
        ref={(el) => {
          if (el) track.attach(el);
        }}
        className="h-full w-full object-cover"
        playsInline
        autoPlay
      />
    );
  }
  return <HumanTile name={name} image={image} isSpeaking={!!isSpeaking} videoEl={videoEl} />;
}

function AssistantTile({ name }: { name: string }) {
  return (
    <div
      className="bg-muted/40 relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border"
      data-testid="org-call-assistant-tile"
    >
      <UnityCallAvatar isSpeaking isCallActive className="h-28 w-28" label={name} />
      <div className="from-background/80 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent px-2 py-2">
        <p className="text-caption truncate text-center text-foreground">{name}</p>
      </div>
    </div>
  );
}

function MeetBody({
  call,
  room,
  roomEpoch,
  currentUserId,
  humansById,
  assistantsById,
  localName,
  localImage,
}: {
  call: OrgCallSession;
  room: Room | null;
  roomEpoch: number;
  currentUserId: string | null;
  humansById: Record<string, OrgCallHumanInfo>;
  assistantsById: Record<string, OrgCallAssistantInfo>;
  localName: string;
  localImage: string | null;
}) {
  void roomEpoch;
  const joinedHumans = call.participants.filter((p) => p.status === 'joined');
  const remoteHumans = joinedHumans.filter((p) => p.userId !== currentUserId);

  if (!room) {
    return (
      <div
        className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3"
        data-testid="org-call-meet-grid"
      >
        <HumanTile name={localName} image={localImage} isSpeaking={false} />
        {remoteHumans.map((p) => {
          const human = humansById[p.userId];
          return (
            <HumanTile
              key={p.userId}
              name={human?.name || 'Teammate'}
              image={human?.image ?? null}
              isSpeaking={false}
            />
          );
        })}
        {call.assistantIds.map((assistantId) => {
          const assistant = assistantsById[String(assistantId)];
          return <AssistantTile key={assistantId} name={assistant?.name || 'Assistant'} />;
        })}
      </div>
    );
  }

  return (
    <div
      className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3"
      data-testid="org-call-meet-grid"
    >
      <LocalHumanTile name={localName} image={localImage} room={room} />
      {remoteHumans.map((p) => {
        const human = humansById[p.userId];
        return (
          <RemoteHumanTile
            key={p.userId}
            name={human?.name || 'Teammate'}
            image={human?.image ?? null}
            userId={p.userId}
            room={room}
          />
        );
      })}
      {call.assistantIds.map((assistantId) => {
        const assistant = assistantsById[String(assistantId)];
        return <AssistantTile key={assistantId} name={assistant?.name || 'Assistant'} />;
      })}
    </div>
  );
}

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
  isHost,
  addableAssistants,
  onToggleMic,
  onToggleCam,
  onLeave,
  onEnd,
  onAddAssistant,
}: {
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
  isHost: boolean;
  addableAssistants: OrgCallAssistantInfo[];
  onToggleMic: () => void;
  onToggleCam: () => void;
  onLeave: () => void;
  onEnd: () => void;
  onAddAssistant: (assistantId: number) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const title =
    call.scope === 'team'
      ? 'Team call'
      : call.scope === 'group'
        ? 'Group call'
        : `Call with ${
            humansById[call.calleeUserId || '']?.name ||
            humansById[call.userIds.find((id) => id !== currentUserId) || '']?.name ||
            'Teammate'
          }`;

  const content = (
    <div
      role="dialog"
      aria-label={title}
      data-testid="org-call-meet-stage"
      className="fixed bottom-6 right-6 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3 rounded-xl border bg-background p-4 shadow-lg"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-title truncate text-foreground">{title}</p>
          <p className="text-caption text-muted-foreground">
            {call.participants.filter((p) => p.status === 'joined').length} joined
            {call.assistantIds.length > 0 ? ` · ${call.assistantIds.length} assistant` : ''}
          </p>
        </div>
      </div>

      <MeetBody
        call={call}
        room={room}
        roomEpoch={roomEpoch}
        currentUserId={currentUserId}
        humansById={humansById}
        assistantsById={assistantsById}
        localName={localName}
        localImage={localImage}
      />

      {pickerOpen && addableAssistants.length > 0 && (
        <div className="rounded-lg border p-2" data-testid="org-call-add-assistant-picker">
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
