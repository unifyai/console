'use client';

import * as React from 'react';
import { LogLevel, Room, RoomEvent, setLogLevel, Track } from 'livekit-client';
import { getHumanCallConnectionDetails } from '@/lib/assistants/humanCall';
import { HumanCallSession, parseHumanCallSession } from '@/types/orgChat';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';

type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

/**
 * Human↔human LiveKit call engine. Uses its own Room so it never collides
 * with assistant Meet agent-dispatch logic. Disabled while an assistant call
 * is already active (caller must pass `assistantCallActive`).
 */
export function useHumanCall(options: { orgId: string | null; assistantCallActive: boolean }) {
  const { orgId, assistantCallActive } = options;
  const { voiceCalls } = useFeatures();
  const roomRef = React.useRef<Room | null>(null);
  const [status, setStatus] = React.useState<CallStatus>('idle');
  const [activeCall, setActiveCall] = React.useState<HumanCallSession | null>(null);
  const [incomingCall, setIncomingCall] = React.useState<HumanCallSession | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const audioElsRef = React.useRef<HTMLAudioElement[]>([]);

  const cleanupAudio = React.useCallback(() => {
    for (const el of audioElsRef.current) {
      el.srcObject = null;
      el.remove();
    }
    audioElsRef.current = [];
  }, []);

  const disconnectRoom = React.useCallback(async () => {
    cleanupAudio();
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.removeAllListeners();
      await room.disconnect();
    }
  }, [cleanupAudio]);

  const attachRemoteAudio = React.useCallback((room: Room) => {
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
        // Dev / unconfigured LiveKit — treat as connected for UI flow.
        setStatus('connected');
        return true;
      }
      setLogLevel(LogLevel.warn);
      const room = new Room();
      roomRef.current = room;
      await room.connect(details.serverUrl, details.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      attachRemoteAudio(room);
      setStatus('connected');
      return true;
    },
    [attachRemoteAudio]
  );

  const startCall = React.useCallback(
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
        const call = parseHumanCallSession(data);
        setActiveCall(call);
        return await connectToRoom(call.roomName);
      } catch {
        setError('Could not start call');
        setStatus('ended');
        return false;
      }
    },
    [orgId, voiceCalls, assistantCallActive, status, connectToRoom]
  );

  const answerCall = React.useCallback(
    async (call: HumanCallSession) => {
      if (!orgId) return false;
      if (assistantCallActive) {
        setError('End the assistant call before answering');
        return false;
      }
      setIncomingCall(null);
      setActiveCall(call);
      try {
        await fetch(`/api/organizations/${orgId}/calls/${encodeURIComponent(call.callId)}/answer`, {
          method: 'POST',
        });
        return await connectToRoom(call.roomName);
      } catch {
        setError('Could not answer call');
        setStatus('ended');
        return false;
      }
    },
    [orgId, assistantCallActive, connectToRoom]
  );

  const declineCall = React.useCallback(
    async (call: HumanCallSession) => {
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

  const endCall = React.useCallback(async () => {
    const call = activeCall;
    await disconnectRoom();
    setStatus('ended');
    setActiveCall(null);
    if (orgId && call?.callId) {
      try {
        await fetch(`/api/organizations/${orgId}/calls/${encodeURIComponent(call.callId)}/end`, {
          method: 'POST',
        });
      } catch {
        /* ignore */
      }
    }
  }, [activeCall, disconnectRoom, orgId]);

  const handleIncomingCall = React.useCallback((call: HumanCallSession) => {
    setIncomingCall(call);
  }, []);

  const handleRemoteEnded = React.useCallback(
    async (call: HumanCallSession) => {
      if (activeCall?.callId === call.callId || incomingCall?.callId === call.callId) {
        setIncomingCall(null);
        await disconnectRoom();
        setActiveCall(null);
        setStatus('ended');
      }
    },
    [activeCall?.callId, incomingCall?.callId, disconnectRoom]
  );

  React.useEffect(() => {
    return () => {
      void disconnectRoom();
    };
  }, [disconnectRoom]);

  return {
    status,
    activeCall,
    incomingCall,
    error,
    isConnecting: status === 'connecting' || status === 'ringing',
    isConnected: status === 'connected',
    startCall,
    answerCall,
    declineCall,
    endCall,
    handleIncomingCall,
    handleRemoteEnded,
    voiceCallsEnabled: voiceCalls,
  };
}
