'use client';

import * as React from 'react';
import { LogLevel, Room, RoomEvent, setLogLevel, Track } from 'livekit-client';
import { getHumanCallConnectionDetails } from '@/lib/assistants/humanCall';
import { dispatchAssistantToCall } from '@/lib/assistants/call';
import { OrgCallSession, parseOrgCallSession } from '@/types/orgChat';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';

type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

/**
 * Multi-party org call engine (DM + team + group). Owns its own LiveKit Room
 * so it never collides with assistant Meet agent-dispatch. Disabled while an
 * assistant call is already active.
 */
export function useOrgCall(options: {
  orgId: string | null;
  currentUserId: string | null;
  assistantCallActive: boolean;
}) {
  const { orgId, currentUserId, assistantCallActive } = options;
  const { voiceCalls } = useFeatures();
  const roomRef = React.useRef<Room | null>(null);
  const [room, setRoom] = React.useState<Room | null>(null);
  const [status, setStatus] = React.useState<CallStatus>('idle');
  const [activeCall, setActiveCall] = React.useState<OrgCallSession | null>(null);
  const [incomingCall, setIncomingCall] = React.useState<OrgCallSession | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [micEnabled, setMicEnabled] = React.useState(true);
  const [camEnabled, setCamEnabled] = React.useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = React.useState(false);
  const [roomEpoch, setRoomEpoch] = React.useState(0);
  const audioElsRef = React.useRef<HTMLAudioElement[]>([]);
  const activeCallRef = React.useRef<OrgCallSession | null>(null);
  activeCallRef.current = activeCall;
  const orgIdRef = React.useRef(orgId);
  orgIdRef.current = orgId;

  const cleanupAudio = React.useCallback(() => {
    for (const el of audioElsRef.current) {
      el.srcObject = null;
      el.remove();
    }
    audioElsRef.current = [];
  }, []);

  const disconnectRoom = React.useCallback(async () => {
    cleanupAudio();
    const current = roomRef.current;
    roomRef.current = null;
    setRoom(null);
    if (current) {
      current.removeAllListeners();
      await current.disconnect();
    }
    setRoomEpoch((n) => n + 1);
  }, [cleanupAudio]);

  const wireRoomEvents = React.useCallback((room: Room) => {
    const onTrack = (track: Track) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      el.autoplay = true;
      document.body.appendChild(el);
      audioElsRef.current.push(el);
    };
    for (const participant of room.remoteParticipants.values()) {
      for (const pub of participant.audioTrackPublications.values()) {
        if (pub.track) onTrack(pub.track);
      }
    }
    room.on(RoomEvent.TrackSubscribed, (track) => onTrack(track));
    room.on(RoomEvent.ParticipantConnected, () => setRoomEpoch((n) => n + 1));
    room.on(RoomEvent.ParticipantDisconnected, () => setRoomEpoch((n) => n + 1));
    room.on(RoomEvent.TrackPublished, () => setRoomEpoch((n) => n + 1));
    room.on(RoomEvent.TrackUnpublished, () => setRoomEpoch((n) => n + 1));
    room.on(RoomEvent.ActiveSpeakersChanged, () => setRoomEpoch((n) => n + 1));
    room.on(RoomEvent.ParticipantAttributesChanged, () => setRoomEpoch((n) => n + 1));
    // Browsers expose their own "stop sharing" chrome; keep local state in
    // sync when the track is unpublished outside our toggle.
    room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
      if (pub.source === Track.Source.ScreenShare) setScreenShareEnabled(false);
      setRoomEpoch((n) => n + 1);
    });
  }, []);

  const connectToRoom = React.useCallback(
    async (roomName: string) => {
      setStatus('connecting');
      setError(null);
      const details = await getHumanCallConnectionDetails(roomName);
      if ('detail' in details) {
        setError(details.detail ?? 'Could not connect');
        setStatus('ended');
        return false;
      }
      if (details.mode === 'dev' || !details.serverUrl || !details.token) {
        setStatus('connected');
        return true;
      }
      setLogLevel(LogLevel.warn);
      await disconnectRoom();
      const nextRoom = new Room();
      roomRef.current = nextRoom;
      setRoom(nextRoom);
      await nextRoom.connect(details.serverUrl, details.token);
      await nextRoom.localParticipant.setMicrophoneEnabled(true);
      setMicEnabled(true);
      setCamEnabled(false);
      setScreenShareEnabled(false);
      wireRoomEvents(nextRoom);
      setStatus('connected');
      setRoomEpoch((n) => n + 1);
      return true;
    },
    [wireRoomEvents, disconnectRoom]
  );

  // A failed start/answer must fully tear down the half-initialized call:
  // leaving a stale `room`/`activeCall` behind renders a dead Meet stage and
  // blocks the next start attempt.
  const failCall = React.useCallback(
    async (message: string) => {
      await disconnectRoom();
      setActiveCall(null);
      setError(message);
      setStatus('ended');
      return false;
    },
    [disconnectRoom]
  );

  const startDmCall = React.useCallback(
    async (otherUserId: string) => {
      if (!orgId || !voiceCalls) return false;
      if (assistantCallActive) {
        setError('End the assistant call before starting a human call');
        return false;
      }
      if (status !== 'idle' && status !== 'ended') return false;
      setStatus('ringing');
      setError(null);
      try {
        const response = await fetch(
          `/api/organizations/${orgId}/dms/${encodeURIComponent(otherUserId)}/calls`,
          { method: 'POST' }
        );
        if (!response.ok) throw new Error('start failed');
        const data = await response.json();
        const call = parseOrgCallSession(data);
        setActiveCall(call);
        return await connectToRoom(call.roomName);
      } catch {
        return await failCall('Could not start call');
      }
    },
    [orgId, voiceCalls, assistantCallActive, status, connectToRoom, failCall]
  );

  const startTeamCall = React.useCallback(
    async (teamId: number) => {
      if (!orgId || !voiceCalls) return false;
      if (assistantCallActive) {
        setError('End the assistant call before starting a team call');
        return false;
      }
      if (status !== 'idle' && status !== 'ended') return false;
      setStatus('ringing');
      setError(null);
      try {
        const response = await fetch(`/api/organizations/${orgId}/teams/${teamId}/calls`, {
          method: 'POST',
        });
        if (!response.ok) throw new Error('start failed');
        const data = await response.json();
        const call = parseOrgCallSession(data);
        setActiveCall(call);
        return await connectToRoom(call.roomName);
      } catch {
        return await failCall('Could not start team call');
      }
    },
    [orgId, voiceCalls, assistantCallActive, status, connectToRoom, failCall]
  );

  const startGroupCall = React.useCallback(
    async (groupId: number) => {
      if (!orgId || !voiceCalls) return false;
      if (assistantCallActive) {
        setError('End the assistant call before starting a group call');
        return false;
      }
      if (status !== 'idle' && status !== 'ended') return false;
      setStatus('ringing');
      setError(null);
      try {
        const response = await fetch(`/api/organizations/${orgId}/groups/${groupId}/calls`, {
          method: 'POST',
        });
        if (!response.ok) throw new Error('start failed');
        const data = await response.json();
        const call = parseOrgCallSession(data);
        setActiveCall(call);
        return await connectToRoom(call.roomName);
      } catch {
        return await failCall('Could not start group call');
      }
    },
    [orgId, voiceCalls, assistantCallActive, status, connectToRoom, failCall]
  );

  const answerCall = React.useCallback(
    async (call: OrgCallSession) => {
      if (!orgId) return false;
      if (assistantCallActive) {
        setError('End the assistant call before answering');
        return false;
      }
      setIncomingCall(null);
      setActiveCall(call);
      try {
        const response = await fetch(
          `/api/organizations/${orgId}/calls/${encodeURIComponent(call.callId)}/answer`,
          { method: 'POST' }
        );
        if (!response.ok) throw new Error('answer failed');
        // The incoming snapshot is stale (statuses from ring time); the answer
        // response is the authoritative session including our own `joined` row.
        const data = await response.json();
        const next = parseOrgCallSession(data);
        setActiveCall(next);
        return await connectToRoom(next.roomName);
      } catch {
        return await failCall('Could not answer call');
      }
    },
    [orgId, assistantCallActive, connectToRoom, failCall]
  );

  const joinCall = React.useCallback(
    async (call: OrgCallSession) => {
      if (!orgId) return false;
      if (assistantCallActive) {
        setError('End the assistant call before joining');
        return false;
      }
      setIncomingCall(null);
      setActiveCall(call);
      try {
        const response = await fetch(
          `/api/organizations/${orgId}/calls/${encodeURIComponent(call.callId)}/join`,
          { method: 'POST' }
        );
        if (!response.ok) throw new Error('join failed');
        const data = await response.json();
        const next = parseOrgCallSession(data);
        setActiveCall(next);
        return await connectToRoom(next.roomName);
      } catch {
        return await failCall('Could not join call');
      }
    },
    [orgId, assistantCallActive, connectToRoom, failCall]
  );

  const declineCall = React.useCallback(
    async (call: OrgCallSession) => {
      if (!orgId) return;
      setIncomingCall(null);
      try {
        await fetch(
          `/api/organizations/${orgId}/calls/${encodeURIComponent(call.callId)}/decline`,
          { method: 'POST' }
        );
      } catch {
        /* ignore */
      }
    },
    [orgId]
  );

  const leaveCall = React.useCallback(async () => {
    const call = activeCallRef.current;
    await disconnectRoom();
    setStatus('ended');
    setActiveCall(null);
    if (orgIdRef.current && call?.callId) {
      try {
        await fetch(
          `/api/organizations/${orgIdRef.current}/calls/${encodeURIComponent(call.callId)}/leave`,
          { method: 'POST' }
        );
      } catch {
        /* ignore */
      }
    }
  }, [disconnectRoom]);

  const endCall = React.useCallback(async () => {
    const call = activeCallRef.current;
    await disconnectRoom();
    setStatus('ended');
    setActiveCall(null);
    if (orgIdRef.current && call?.callId) {
      try {
        await fetch(
          `/api/organizations/${orgIdRef.current}/calls/${encodeURIComponent(call.callId)}/end`,
          { method: 'POST' }
        );
      } catch {
        /* ignore */
      }
    }
  }, [disconnectRoom]);

  const toggleMic = React.useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      setMicEnabled((v) => !v);
      return;
    }
    const next = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  }, [micEnabled]);

  const toggleCam = React.useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      setCamEnabled((v) => !v);
      return;
    }
    const next = !camEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setCamEnabled(next);
    setRoomEpoch((n) => n + 1);
  }, [camEnabled]);

  const toggleScreenShare = React.useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      setScreenShareEnabled((v) => !v);
      return;
    }
    const next = !screenShareEnabled;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenShareEnabled(next);
    } catch {
      // The user dismissed the browser's screen picker; keep prior state.
    }
    setRoomEpoch((n) => n + 1);
  }, [screenShareEnabled]);

  const addAssistant = React.useCallback(
    async (assistantId: number) => {
      const call = activeCallRef.current;
      if (!orgId || !call?.callId) return false;
      try {
        const response = await fetch(
          `/api/organizations/${orgId}/calls/${encodeURIComponent(call.callId)}/assistants`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assistantId }),
          }
        );
        if (!response.ok) throw new Error('add assistant failed');
        const data = await response.json();
        const next = parseOrgCallSession(data);
        setActiveCall(next);
        await dispatchAssistantToCall(String(assistantId), next.roomName, undefined, next.callId, {
          orgCall: true,
          participants: next.roster.map((m) => ({
            kind: m.kind,
            userId: m.userId,
            assistantId: m.assistantId,
            displayName: m.displayName,
            contactId: m.contactId,
            email: m.email,
          })),
        });
        return true;
      } catch {
        setError('Could not add assistant to the call');
        return false;
      }
    },
    [orgId]
  );

  const handleIncomingCall = React.useCallback(
    (call: OrgCallSession) => {
      if (currentUserId && call.callerUserId === currentUserId) return;
      const me = call.participants.find((p) => p.userId === currentUserId);
      if (me && me.status !== 'invited') return;
      setIncomingCall(call);
    },
    [currentUserId]
  );

  // Status transitions are owned by connectToRoom; an answered frame only
  // refreshes the session snapshot (forcing `connected` mid-connect used to
  // render the Meet stage against a half-initialized room).
  const handleCallAnswered = React.useCallback((call: OrgCallSession) => {
    setActiveCall((prev) => (prev?.callId === call.callId ? call : prev));
  }, []);

  const handleRemoteEnded = React.useCallback(
    async (call: OrgCallSession) => {
      if (activeCallRef.current?.callId === call.callId || incomingCall?.callId === call.callId) {
        setIncomingCall(null);
        await disconnectRoom();
        setActiveCall(null);
        setStatus('ended');
      }
    },
    [incomingCall?.callId, disconnectRoom]
  );

  const handleParticipantUpdate = React.useCallback((call: OrgCallSession) => {
    setActiveCall((prev) => (prev?.callId === call.callId ? call : prev));
  }, []);

  // Tear down media when the active organization changes.
  React.useEffect(() => {
    return () => {
      void disconnectRoom();
    };
  }, [orgId, disconnectRoom]);

  React.useEffect(() => {
    return () => {
      void disconnectRoom();
    };
  }, [disconnectRoom]);

  const isHost = Boolean(
    activeCall && currentUserId && activeCall.createdByUserId === currentUserId
  );

  return {
    status,
    activeCall,
    incomingCall,
    error,
    room,
    roomEpoch,
    micEnabled,
    camEnabled,
    screenShareEnabled,
    isHost,
    isConnecting: status === 'connecting' || status === 'ringing',
    isConnected: status === 'connected',
    startCall: startDmCall,
    startDmCall,
    startTeamCall,
    startGroupCall,
    answerCall,
    joinCall,
    declineCall,
    leaveCall,
    endCall,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    addAssistant,
    handleIncomingCall,
    handleCallAnswered,
    handleRemoteEnded,
    handleParticipantUpdate,
    voiceCallsEnabled: voiceCalls,
  };
}

export type OrgCallEngine = ReturnType<typeof useOrgCall>;
