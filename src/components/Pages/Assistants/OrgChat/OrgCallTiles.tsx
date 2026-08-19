'use client';

import * as React from 'react';
import type { Participant, RemoteParticipant, Room, TrackPublication } from 'livekit-client';
import { Track } from 'livekit-client';
import { useIsSpeaking, useTracks } from '@livekit/components-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { useResolvedProfileImage } from '@/hooks/User/useProfileImageResolver';
import { UnityCallAvatar } from '@/components/Pages/Assistants/Communication/UnityCallAvatar';
import { cn } from '@/lib/utils';
import type { DesktopMode, ManagedDesktopStatus } from '@/types/assistants/assistant';

/** LiveKit participant attribute set by the unify runtime on org-call join. */
export const ASSISTANT_ID_ATTRIBUTE = 'unify_assistant_id';
/** LiveKit agents framework state attribute: listening/thinking/speaking. */
export const AGENT_STATE_ATTRIBUTE = 'lk.agent.state';

export interface OrgCallHumanInfo {
  userId: string;
  name: string;
  image: string | null;
}

export interface OrgCallAssistantInfo {
  agentId: string;
  name: string;
  image: string | null;
  /** Owner whose key resolves this assistant's desktop liveview. */
  ownerUserId: string | null;
  organizationId: number | null;
  /** Shaped for `resolveManagedDesktopMode`, which gates any desktop surface. */
  desktopMode: DesktopMode | null;
  managedDesktopStatus: ManagedDesktopStatus | null;
}

export function HumanTile({
  name,
  image,
  isSpeaking,
  videoEl,
  ringing = false,
  compact = false,
}: {
  name: string;
  image: string | null;
  isSpeaking: boolean;
  videoEl?: React.ReactNode;
  ringing?: boolean;
  compact?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  const imageUrl = useResolvedProfileImage(image);

  return (
    <div
      className={cn(
        'bg-muted/40 relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border',
        isSpeaking && 'animate-call-speaking-pulse',
        ringing && 'opacity-60'
      )}
      data-testid="org-call-human-tile"
    >
      {videoEl ? (
        <div className="absolute inset-0">{videoEl}</div>
      ) : (
        <Avatar className={compact ? 'h-10 w-10' : 'h-20 w-20'}>
          <AvatarImage src={imageUrl ?? undefined} alt={name} />
          <AvatarFallback className="text-title">{initials || '?'}</AvatarFallback>
        </Avatar>
      )}
      <div className="from-background/80 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent px-2 py-2">
        <p className="text-caption truncate text-center text-foreground">
          {name}
          {ringing ? ' · ringing…' : ''}
        </p>
      </div>
    </div>
  );
}

/**
 * One attached video element.
 *
 * Attach and detach are symmetric: a camera toggle unmounts and remounts this
 * element on every flip, so attaching from a ref callback with no cleanup would
 * leak an attachment per toggle.
 */
export function AttachedVideo({
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
 * The video for a camera publication, or `null` when there is no live frame.
 *
 * `setCameraEnabled(false)` mutes the publication rather than unpublishing it —
 * livekit-client only unpublishes screen share — and muting a camera stops its
 * media track so the device indicator goes off. A publication that still
 * carries a `track` can therefore be a dead black frame, which would cover the
 * participant's avatar.
 */
function cameraVideo(publication: TrackPublication | undefined, muted: boolean): React.ReactNode {
  if (!publication?.track || publication.isMuted) return null;
  return (
    <AttachedVideo track={publication.track} muted={muted} className="h-full w-full object-cover" />
  );
}

export function LocalHumanTile({
  name,
  image,
  room,
  compact = false,
}: {
  name: string;
  image: string | null;
  room: Room;
  compact?: boolean;
}) {
  const isSpeaking = useIsSpeaking(room.localParticipant);
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], {
    onlySubscribed: false,
  });
  const localCam = tracks.find((t) => t.participant.isLocal && t.publication?.track);
  const videoEl = cameraVideo(localCam?.publication, true);
  return (
    <HumanTile
      name={name}
      image={image}
      isSpeaking={!!isSpeaking}
      videoEl={videoEl}
      compact={compact}
    />
  );
}

export function RemoteHumanTile({
  name,
  image,
  userId,
  room,
  compact = false,
}: {
  name: string;
  image: string | null;
  userId: string;
  room: Room | null;
  compact?: boolean;
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
    return <HumanTile name={name} image={image} isSpeaking={false} compact={compact} />;
  }
  return (
    <ConnectedRemoteHumanTile
      name={name}
      image={image}
      participant={participant}
      compact={compact}
    />
  );
}

function ConnectedRemoteHumanTile({
  name,
  image,
  participant,
  compact,
}: {
  name: string;
  image: string | null;
  participant: RemoteParticipant;
  compact: boolean;
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
  const videoEl = cameraVideo(cam?.publication, false);
  return (
    <HumanTile
      name={name}
      image={image}
      isSpeaking={!!isSpeaking}
      videoEl={videoEl}
      compact={compact}
    />
  );
}

/**
 * Resolve the LiveKit participant for one assistant on the call. Primary key
 * is the `unify_assistant_id` attribute the runtime stamps on join; when the
 * call has exactly one assistant, a lone agent participant is accepted as a
 * fallback for runtimes that predate the attribute.
 */
export function findAssistantParticipant(
  room: Room,
  assistantId: number,
  assistantCount: number
): Participant | undefined {
  const participants: Participant[] = [...room.remoteParticipants.values()];
  const byAttribute = participants.find(
    (p) => p.attributes?.[ASSISTANT_ID_ATTRIBUTE] === String(assistantId)
  );
  if (byAttribute) return byAttribute;
  const agents = participants.filter(
    (p) =>
      p.attributes?.[AGENT_STATE_ATTRIBUTE] !== undefined ||
      p.identity.startsWith('agent-') ||
      p.identity.startsWith('unity_')
  );
  if (assistantCount === 1 && agents.length === 1) return agents[0];
  return undefined;
}

function AssistantTileFrame({
  name,
  isSpeaking,
  isActing,
  connecting = false,
  compact = false,
}: {
  name: string;
  isSpeaking: boolean;
  isActing: boolean;
  connecting?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-muted/40 relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border',
        isSpeaking && 'animate-call-speaking-pulse',
        connecting && 'opacity-60'
      )}
      data-testid="org-call-assistant-tile"
    >
      <UnityCallAvatar
        isSpeaking={isSpeaking}
        isCallActive
        isActing={isActing}
        className={compact ? 'h-14 w-14' : 'h-28 w-28'}
        label={name}
      />
      <div className="from-background/80 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent px-2 py-2">
        <p className="text-caption truncate text-center text-foreground">
          {name}
          {connecting ? ' · connecting…' : ''}
        </p>
      </div>
    </div>
  );
}

/** Assistant tile in a live room: talking + laptop pose driven by the agent. */
function LiveAssistantTile({
  name,
  participant,
  compact,
}: {
  name: string;
  participant: Participant;
  compact: boolean;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const agentState = participant.attributes?.[AGENT_STATE_ATTRIBUTE];
  return (
    <AssistantTileFrame
      name={name}
      isSpeaking={!!isSpeaking || agentState === 'speaking'}
      isActing={agentState === 'thinking'}
      compact={compact}
    />
  );
}

export function AssistantTile({
  assistantId,
  name,
  room,
  assistantCount,
  compact = false,
}: {
  assistantId: number;
  name: string;
  room: Room | null;
  assistantCount: number;
  compact?: boolean;
}) {
  const participant = room
    ? findAssistantParticipant(room, assistantId, assistantCount)
    : undefined;
  if (!room) {
    // Dev/avatar-only mode: no live media, show the talking pose.
    return <AssistantTileFrame name={name} isSpeaking isActing={false} compact={compact} />;
  }
  if (!participant) {
    // Dispatched but the agent worker hasn't joined the room yet.
    return (
      <AssistantTileFrame
        name={name}
        isSpeaking={false}
        isActing={false}
        connecting
        compact={compact}
      />
    );
  }
  return <LiveAssistantTile name={name} participant={participant} compact={compact} />;
}
