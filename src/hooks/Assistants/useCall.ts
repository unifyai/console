'use client';

import * as React from 'react';
import {
  LogLevel,
  Room,
  RoomEvent,
  setLogLevel,
  Track,
  type AudioCaptureOptions,
} from 'livekit-client';
import { toast } from 'sonner';
import { getHumanCallConnectionDetails } from '@/lib/assistants/humanCall';
import { OrgCallSession, parseOrgCallSession } from '@/types/orgChat';
import { useEnvironment, useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { useCallSounds } from '@/hooks/Assistants/useCallSounds';
import { useDesktopReady } from '@/hooks/Assistants/useDesktopReady';
import type { DesktopSessionScope } from '@/lib/assistants/desktopSessionScope';
import { clearDesktopReadyCache } from '@/lib/assistants/desktopSessionScope';
import { callViewerSource } from '@/lib/assistants/desktopViewer';
import { fetchAssistantStatus } from '@/lib/client/assistant';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import { resolveManagedDesktopMode } from '@/utils/assistants/managed-desktop';
import type { CreatureMood } from '@/components/Brand/TeammateCreature';
import type {
  Assistant,
  AssistantActions,
  AssistantCallConnectOptions,
} from '@/types/assistants/assistant';

type CallStatus = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

/** Per-assistant supervision phases (assistant_dm calls). */
export type CallPhase =
  | 'idle'
  | 'connecting'
  | 'awaiting_assistant'
  | 'preparing_assistant'
  | 'active'
  | 'recovering_assistant'
  | 'ending'
  | 'failed';

const DEFAULT_AVATAR_MOOD = 'happy' satisfies CreatureMood;
const ASSISTANT_JOIN_SLOW_THRESHOLD = 90000; // soft warning, not an error
const ASSISTANT_REJOIN_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
// Abort a create/dispatch request that never settles (e.g. a request stalled
// behind a dev-server rebuild) so the retry loop can recover.
const CALL_DISPATCH_TIMEOUT = 12000;
// If the assistant never makes its first appearance in the room, re-dispatch
// it once, then fail the attempt cleanly.
const ASSISTANT_INITIAL_REDISPATCH_DELAY = 12000;
const ASSISTANT_INITIAL_JOIN_TIMEOUT = 60000;
const RUNTIME_JOB_NAME_POLL_INTERVAL_MS = 15000;
const CALL_AUDIO_CAPTURE_OPTIONS: AudioCaptureOptions = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

function promiseWithTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** True when any remote participant is a voice agent (assistant runtime). */
function hasAgentParticipant(room: Room): boolean {
  for (const participant of room.remoteParticipants.values()) {
    const attrs = participant.attributes ?? {};
    if (
      attrs['unify_assistant_id'] ||
      attrs['lk.agent.state'] !== undefined ||
      participant.identity.startsWith('agent-') ||
      participant.identity.startsWith('unity_')
    ) {
      return true;
    }
  }
  return false;
}

type AssistantReadyWaiter = {
  attemptId: number;
  resolve: () => void;
  reject: (error: Error) => void;
};

async function callApi(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    method: 'POST',
    ...(body !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (data && (data.detail as string)) || `Call request failed (${response.status})`
    );
  }
  return (data ?? {}) as Record<string, unknown>;
}

/**
 * The one call engine. Every call — human DM, team, group, or 1:1 assistant —
 * is an Orchestra call session bound to a chat thread; assistants are
 * dispatched into the LiveKit room server-side and supervised here (join
 * watchdogs, redispatch, ready-to-speak) exactly like the legacy 1:1 engine.
 *
 * Owns one persistent LiveKit Room across the app; the provider hosts this
 * hook at the layout level so calls survive navigation.
 */
export function useCall(
  room: Room,
  assistantActions: Pick<AssistantActions, 'desktop'>,
  options: {
    orgId: string | null;
    currentUserId: string | null;
  }
) {
  const { orgId, currentUserId } = options;
  const { voiceCalls } = useFeatures();
  const { isSelfHost } = useEnvironment();

  // --- Session state ---
  const [status, setStatus] = React.useState<CallStatus>('idle');
  const [activeCall, setActiveCall] = React.useState<OrgCallSession | null>(null);
  const [incomingCall, setIncomingCall] = React.useState<OrgCallSession | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [micEnabled, setMicEnabled] = React.useState(true);
  const [camEnabled, setCamEnabled] = React.useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = React.useState(false);
  // Which assistants are presenting their desktop to the room, by agent id.
  // Room state rather than a local toggle: the desktop is a liveview each
  // participant mounts for itself, so every client has to be told, and a room
  // call can carry several assistants each presenting their own.
  const [assistantSharesById, setAssistantSharesById] = React.useState<Record<string, boolean>>({});
  const [roomEpoch, setRoomEpoch] = React.useState(0);
  const audioElsRef = React.useRef<HTMLAudioElement[]>([]);
  const playbackMutedRef = React.useRef(false);
  const activeCallRef = React.useRef<OrgCallSession | null>(null);
  activeCallRef.current = activeCall;
  const devModeRef = React.useRef(false);

  // --- Assistant supervision state (assistant_dm scope) ---
  const [activeCallAssistant, setActiveCallAssistant] = React.useState<Assistant | null>(null);
  const activeCallAssistantRef = React.useRef<Assistant | null>(null);
  activeCallAssistantRef.current = activeCallAssistant;
  const [callType, setCallType] = React.useState<'video' | 'audio' | null>(null);
  const [callPhase, setCallPhaseState] = React.useState<CallPhase>('idle');
  const callPhaseRef = React.useRef<CallPhase>('idle');
  const [isWaitingForAssistant, setIsWaitingForAssistant] = React.useState(false);
  const [isAssistantPreparing, setIsAssistantPreparing] = React.useState(false);
  const [waitingMessage, setWaitingMessage] = React.useState<string | null>(null);
  const [connectionError, setConnectionError] = React.useState<string | null>(null);
  const [isSpeakerMuted, setIsSpeakerMuted] = React.useState(false);
  const [activeOpeningConfig, setActiveOpeningConfig] =
    React.useState<AssistantCallConnectOptions['openingConfig']>(undefined);
  const avatarMood: CreatureMood = DEFAULT_AVATAR_MOOD;
  const connectionAttemptIdRef = React.useRef(0);
  const isCancelledRef = React.useRef(false);
  const wasConnectedRef = React.useRef(false);
  const expectsReadyToSpeakRef = React.useRef(false);
  const assistantReadyWaiterRef = React.useRef<AssistantReadyWaiter | null>(null);
  const activeConnectOptionsRef = React.useRef<AssistantCallConnectOptions | undefined>(undefined);
  const sdkReconnectingRef = React.useRef(false);
  const redispatchPromiseRef = React.useRef<Promise<void> | null>(null);
  const assistantJoinTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const assistantRejoinTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const assistantInitialRedispatchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const assistantInitialJoinTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const redispatchAssistantRef = React.useRef<(() => void) | null>(null);
  const disconnectRef = React.useRef<(() => Promise<void>) | null>(null);

  const { startRinging, stopRinging, setRingingMuted, playHangup } = useCallSounds();

  const setCallPhase = React.useCallback((phase: CallPhase) => {
    callPhaseRef.current = phase;
    setCallPhaseState(phase);
  }, []);

  const toggleSpeakerMute = React.useCallback(() => {
    setIsSpeakerMuted((prev) => !prev);
  }, []);

  React.useEffect(() => {
    setRingingMuted(isSpeakerMuted);
  }, [isSpeakerMuted, setRingingMuted]);

  // Speaker mute (user toggle) and playback hold (e.g. the coordinator's
  // recorded intro playing outside LiveKit) both silence live playback.
  const [playbackHold, setPlaybackHold] = React.useState(false);
  React.useEffect(() => {
    const muted = isSpeakerMuted || playbackHold;
    playbackMutedRef.current = muted;
    for (const el of audioElsRef.current) {
      el.muted = muted;
    }
  }, [isSpeakerMuted, playbackHold]);

  const isCurrentGeneration = React.useCallback((generation: number) => {
    return !isCancelledRef.current && connectionAttemptIdRef.current === generation;
  }, []);

  const clearAssistantTimers = React.useCallback(() => {
    for (const ref of [
      assistantJoinTimeoutRef,
      assistantRejoinTimeoutRef,
      assistantInitialRedispatchTimeoutRef,
      assistantInitialJoinTimeoutRef,
    ]) {
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    }
  }, []);

  const resolveAssistantReadyWaiter = React.useCallback((attemptId?: number) => {
    const waiter = assistantReadyWaiterRef.current;
    if (!waiter) return;
    if (attemptId !== undefined && waiter.attemptId !== attemptId) return;
    assistantReadyWaiterRef.current = null;
    waiter.resolve();
  }, []);

  const rejectAssistantReadyWaiter = React.useCallback((message: string, attemptId?: number) => {
    const waiter = assistantReadyWaiterRef.current;
    if (!waiter) return;
    if (attemptId !== undefined && waiter.attemptId !== attemptId) return;
    assistantReadyWaiterRef.current = null;
    waiter.reject(new Error(message));
  }, []);

  // --- Remote control state (assistant desktop during a call) ---
  const [isRemoteControlActive, setIsRemoteControlActive] = React.useState(false);
  const [liveviewUrl, setLiveviewUrl] = React.useState<string | null>(null);
  const [isRemoteControlLoading, setIsRemoteControlLoading] = React.useState(false);
  const [isRemoteControlInteractive, setIsRemoteControlInteractive] = React.useState(false);
  const [isRemoteControlInteractiveLoading, setIsRemoteControlInteractiveLoading] =
    React.useState(false);

  const stopRemoteControl = React.useCallback(() => {
    setIsRemoteControlActive(false);
    setLiveviewUrl(null);
    setIsRemoteControlInteractive(false);
  }, []);

  const cleanupAudio = React.useCallback(() => {
    for (const el of audioElsRef.current) {
      el.srcObject = null;
      el.remove();
    }
    audioElsRef.current = [];
  }, []);

  // --- Reset on disconnect (any scope) ---
  const onDisconnected = React.useCallback(() => {
    rejectAssistantReadyWaiter('Call disconnected before the assistant was ready.');
    stopRinging();
    if (wasConnectedRef.current) {
      playHangup();
    }
    wasConnectedRef.current = false;
    const disconnectingId = activeCallAssistantRef.current?.agentId;
    if (disconnectingId) {
      clearDesktopReadyCache(disconnectingId);
    }
    cleanupAudio();
    setStatus('ended');
    setActiveCall(null);
    setActiveCallAssistant(null);
    setCallType(null);
    setIsWaitingForAssistant(false);
    setIsAssistantPreparing(false);
    setCallPhase('idle');
    setWaitingMessage(null);
    setConnectionError(null);
    setActiveOpeningConfig(undefined);
    setIsSpeakerMuted(false);
    setMicEnabled(true);
    setCamEnabled(false);
    setScreenShareEnabled(false);
    setAssistantSharesById({});
    devModeRef.current = false;
    activeConnectOptionsRef.current = undefined;
    sdkReconnectingRef.current = false;
    redispatchPromiseRef.current = null;
    stopRemoteControl();
    clearAssistantTimers();
    setRoomEpoch((n) => n + 1);
  }, [
    cleanupAudio,
    clearAssistantTimers,
    playHangup,
    rejectAssistantReadyWaiter,
    setCallPhase,
    stopRemoteControl,
    stopRinging,
  ]);

  // --- Room wiring (one persistent Room; handlers registered once) ---
  React.useEffect(() => {
    const attachAudio = (track: Track) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      el.autoplay = true;
      el.muted = playbackMutedRef.current;
      document.body.appendChild(el);
      audioElsRef.current.push(el);
    };

    const bump = () => setRoomEpoch((n) => n + 1);

    const onDataReceived = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string
    ) => {
      if (topic !== 'agent_status') return;
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === 'ready_to_speak') {
          clearAssistantTimers();
          stopRinging();
          setIsWaitingForAssistant(false);
          setIsAssistantPreparing(false);
          setWaitingMessage(null);
          setConnectionError(null);
          setCallPhase('active');
          resolveAssistantReadyWaiter();
          return;
        }
        if (data.type === 'call_ended') {
          // The assistant ended the call. Leave cleanly ourselves (which also
          // ends the session server-side for assistant_dm calls).
          disconnectRef.current?.();
          return;
        }
        if (data.type === 'assistant_screenshare') {
          const assistantId = String(data.assistantId || '');
          if (!assistantId) return;
          setAssistantSharesById((prev) => {
            const active = Boolean(data.active);
            if (Boolean(prev[assistantId]) === active) return prev;
            const next = { ...prev };
            if (active) {
              next[assistantId] = true;
            } else {
              delete next[assistantId];
            }
            return next;
          });
          return;
        }
      } catch {
        // ignore malformed data messages
      }
    };

    const readyFallbackRef = { current: null as NodeJS.Timeout | null };
    const clearReadyFallback = () => {
      if (readyFallbackRef.current) {
        clearTimeout(readyFallbackRef.current);
        readyFallbackRef.current = null;
      }
    };

    const onParticipantConnected = () => {
      bump();
      if (!activeCallAssistantRef.current) return;
      if (!hasAgentParticipant(room)) return;
      clearAssistantTimers();
      stopRinging();
      setIsWaitingForAssistant(false);
      setWaitingMessage(null);
      setConnectionError(null);
      redispatchPromiseRef.current = null;
      if (!expectsReadyToSpeakRef.current) {
        setIsAssistantPreparing(false);
        setCallPhase('active');
        return;
      }
      setIsAssistantPreparing(true);
      setCallPhase('preparing_assistant');
      clearReadyFallback();
      readyFallbackRef.current = setTimeout(() => {
        setIsAssistantPreparing(false);
        if (callPhaseRef.current === 'preparing_assistant') {
          setCallPhase('active');
        }
      }, 10_000);
    };

    const onParticipantDisconnected = () => {
      bump();
      const assistant = activeCallAssistantRef.current;
      if (!assistant || !wasConnectedRef.current) return;
      if (hasAgentParticipant(room)) return;

      clearAssistantTimers();
      if (sdkReconnectingRef.current) {
        setWaitingMessage('Reconnecting call audio...');
        setIsWaitingForAssistant(true);
        setIsAssistantPreparing(false);
        setCallPhase('recovering_assistant');
        return;
      }
      const displayName = assistantDisplayName(assistant);
      setWaitingMessage(`${displayName} disconnected, waiting for them to rejoin...`);
      setIsWaitingForAssistant(true);
      setIsAssistantPreparing(false);
      setConnectionError(null);
      setCallPhase('recovering_assistant');
      clearReadyFallback();

      redispatchAssistantRef.current?.();

      const generation = connectionAttemptIdRef.current;
      const timeoutDuration =
        (typeof window !== 'undefined' && (window as any)._TEST_ASSISTANT_REJOIN_TIMEOUT) ||
        ASSISTANT_REJOIN_TIMEOUT;
      assistantRejoinTimeoutRef.current = setTimeout(() => {
        if (!isCurrentGeneration(generation)) return;
        if (!hasAgentParticipant(room)) {
          redispatchPromiseRef.current = null;
          toast.error(`${displayName} couldn't rejoin the call. Please try calling again.`);
          setConnectionError(
            `${displayName} couldn't rejoin. You can retry without leaving the call.`
          );
          setIsWaitingForAssistant(false);
          setCallPhase('failed');
        }
      }, timeoutDuration);
    };

    const onReconnecting = () => {
      if (!wasConnectedRef.current || !activeCallAssistantRef.current) return;
      sdkReconnectingRef.current = true;
      setWaitingMessage('Reconnecting call audio...');
      setIsWaitingForAssistant(true);
      setIsAssistantPreparing(false);
      setCallPhase('recovering_assistant');
    };

    const onReconnected = () => {
      if (!wasConnectedRef.current) return;
      sdkReconnectingRef.current = false;
      if (activeCallAssistantRef.current && !hasAgentParticipant(room)) {
        redispatchAssistantRef.current?.();
        return;
      }
      clearAssistantTimers();
      setIsWaitingForAssistant(false);
      setIsAssistantPreparing(false);
      setWaitingMessage(null);
      if (activeCallAssistantRef.current) setCallPhase('active');
    };

    const onLocalTrackUnpublished = (pub: { source?: Track.Source }) => {
      if (pub.source === Track.Source.ScreenShare) setScreenShareEnabled(false);
      bump();
    };

    room.on(RoomEvent.TrackSubscribed, attachAudio);
    room.on(RoomEvent.DataReceived, onDataReceived);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.TrackPublished, bump);
    room.on(RoomEvent.TrackUnpublished, bump);
    room.on(RoomEvent.ActiveSpeakersChanged, bump);
    room.on(RoomEvent.ParticipantAttributesChanged, bump);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    return () => {
      room.off(RoomEvent.TrackSubscribed, attachAudio);
      room.off(RoomEvent.DataReceived, onDataReceived);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.TrackPublished, bump);
      room.off(RoomEvent.TrackUnpublished, bump);
      room.off(RoomEvent.ActiveSpeakersChanged, bump);
      room.off(RoomEvent.ParticipantAttributesChanged, bump);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
      clearReadyFallback();
      clearAssistantTimers();
    };
  }, [
    room,
    clearAssistantTimers,
    isCurrentGeneration,
    onDisconnected,
    resolveAssistantReadyWaiter,
    setCallPhase,
    stopRinging,
  ]);

  // --- Connect to a session's room ---
  const connectToRoom = React.useCallback(
    async (
      call: OrgCallSession,
      media: { video?: boolean; startMuted?: boolean } = {}
    ): Promise<boolean> => {
      setStatus('connecting');
      setError(null);
      const details = await getHumanCallConnectionDetails(call.roomName);
      if ('detail' in details) {
        setError(details.detail ?? 'Could not connect');
        setStatus('ended');
        return false;
      }
      if (details.mode === 'dev' || !details.serverUrl || !details.token) {
        devModeRef.current = true;
        wasConnectedRef.current = true;
        setStatus('connected');
        return true;
      }
      setLogLevel(LogLevel.warn);
      if (room.state !== 'disconnected') {
        await room.disconnect();
      }
      await room.connect(details.serverUrl, details.token);
      const publication = await room.localParticipant.setMicrophoneEnabled(
        true,
        CALL_AUDIO_CAPTURE_OPTIONS
      );
      if (media.startMuted === true) {
        await publication?.mute();
        setMicEnabled(false);
      } else {
        setMicEnabled(true);
      }
      await room.localParticipant.setCameraEnabled(media.video === true);
      setCamEnabled(media.video === true);
      setScreenShareEnabled(false);
      wasConnectedRef.current = true;
      setStatus('connected');
      setRoomEpoch((n) => n + 1);
      return true;
    },
    [room]
  );

  // A failed start/answer must fully tear down the half-initialized call.
  const failCall = React.useCallback(
    async (message: string) => {
      setError(message);
      if (room.state !== 'disconnected') {
        await room.disconnect().catch(() => {});
      }
      // Reset unconditionally rather than leaving it to the Disconnected event.
      // A room that never reached 'connected' can resolve disconnect() without
      // emitting one, and the engine would sit in 'ringing' indefinitely — which
      // disables the call button on every room surface with no way back short of
      // a page reload. Redundant when the event does fire, and idempotent.
      setActiveCall(null);
      setStatus('ended');
      return false;
    },
    [room]
  );

  // --- Human-scope call starters ---
  const startScopedCall = React.useCallback(
    async (scope: Record<string, unknown>, failureMessage: string) => {
      if (!voiceCalls) return false;
      if (status !== 'idle' && status !== 'ended') return false;
      setStatus('ringing');
      setError(null);
      let created: OrgCallSession | null = null;
      try {
        // Bounded like the assistant path's dispatch: a create request that
        // never settles would otherwise leave the engine 'ringing' forever, and
        // every room call button reads that state to disable itself.
        const dispatchTimeout =
          (typeof window !== 'undefined' && (window as any)._TEST_CALL_DISPATCH_TIMEOUT) ||
          CALL_DISPATCH_TIMEOUT;
        const data = await promiseWithTimeout(
          callApi('/api/calls', scope),
          dispatchTimeout,
          failureMessage
        );
        created = parseOrgCallSession(data);
        setActiveCall(created);
        const connected = await connectToRoom(created);
        if (!connected) throw new Error(failureMessage);
        return true;
      } catch {
        // The session already exists server-side: end it, or every invitee
        // keeps ringing into a call the caller never made it onto.
        if (created?.callId) {
          callApi(`/api/calls/${encodeURIComponent(created.callId)}/end`).catch(() => {});
        }
        return await failCall(failureMessage);
      }
    },
    [voiceCalls, status, connectToRoom, failCall]
  );

  const startDmCall = React.useCallback(
    async (otherUserId: string) => {
      if (!orgId) return false;
      return startScopedCall(
        { kind: 'dm', organizationId: Number(orgId), peerUserId: otherUserId },
        'Could not start call'
      );
    },
    [orgId, startScopedCall]
  );

  const startTeamCall = React.useCallback(
    async (teamId: number) =>
      startScopedCall({ kind: 'team', teamId }, 'Could not start team call'),
    [startScopedCall]
  );

  const startGroupCall = React.useCallback(
    async (groupId: number) =>
      startScopedCall({ kind: 'group', groupId }, 'Could not start group call'),
    [startScopedCall]
  );

  // --- Assistant supervision helpers ---

  const beginAssistantSupervision = React.useCallback(
    (assistant: Assistant, attemptId: number, waitForReady: boolean) => {
      if (devModeRef.current) {
        setIsWaitingForAssistant(false);
        setIsAssistantPreparing(false);
        setCallPhase('active');
        stopRinging();
        resolveAssistantReadyWaiter(attemptId);
        return;
      }
      if (hasAgentParticipant(room)) {
        setIsWaitingForAssistant(false);
        setIsAssistantPreparing(expectsReadyToSpeakRef.current);
        setCallPhase(expectsReadyToSpeakRef.current ? 'preparing_assistant' : 'active');
        stopRinging();
        return;
      }
      setIsWaitingForAssistant(true);
      setIsAssistantPreparing(false);
      setCallPhase('awaiting_assistant');
      const slowThreshold =
        (typeof window !== 'undefined' && (window as any)._TEST_ASSISTANT_JOIN_TIMEOUT) ||
        ASSISTANT_JOIN_SLOW_THRESHOLD;
      assistantJoinTimeoutRef.current = setTimeout(() => {
        if (!isCurrentGeneration(attemptId)) return;
        setWaitingMessage(
          `${assistantDisplayName(assistant)} is taking a bit longer than expected…`
        );
      }, slowThreshold);

      if (waitForReady) {
        const redispatchDelay =
          (typeof window !== 'undefined' &&
            (window as any)._TEST_ASSISTANT_INITIAL_REDISPATCH_DELAY) ||
          ASSISTANT_INITIAL_REDISPATCH_DELAY;
        assistantInitialRedispatchTimeoutRef.current = setTimeout(() => {
          if (!isCurrentGeneration(attemptId)) return;
          if (!hasAgentParticipant(room)) {
            redispatchAssistantRef.current?.();
          }
        }, redispatchDelay);

        const joinTimeout =
          (typeof window !== 'undefined' && (window as any)._TEST_ASSISTANT_INITIAL_JOIN_TIMEOUT) ||
          ASSISTANT_INITIAL_JOIN_TIMEOUT;
        assistantInitialJoinTimeoutRef.current = setTimeout(() => {
          if (!isCurrentGeneration(attemptId)) return;
          if (!hasAgentParticipant(room)) {
            rejectAssistantReadyWaiter(
              `${assistantDisplayName(assistant)} didn't join the call in time.`,
              attemptId
            );
          }
        }, joinTimeout);
      }
    },
    [
      room,
      isCurrentGeneration,
      rejectAssistantReadyWaiter,
      resolveAssistantReadyWaiter,
      setCallPhase,
      stopRinging,
    ]
  );

  /**
   * Start (or answer) a 1:1 assistant call. Creates an assistant_dm call
   * session — or answers the assistant's ringing session when
   * ``options.callSessionId`` is set — then connects and supervises the
   * assistant's join.
   */
  const connect = React.useCallback(
    async (
      assistant: Assistant,
      type: 'video' | 'audio',
      options?: AssistantCallConnectOptions
    ) => {
      resolveAssistantReadyWaiter();
      connectionAttemptIdRef.current += 1;
      const thisAttemptId = connectionAttemptIdRef.current;
      isCancelledRef.current = false;
      activeConnectOptionsRef.current = options;
      clearDesktopReadyCache(assistant.agentId);
      setActiveOpeningConfig(options?.openingConfig);
      expectsReadyToSpeakRef.current =
        !options?.openingConfig ||
        options.openingConfig.mode === 'speak' ||
        options.openingConfig.mode === 'recorded';
      const shouldWaitForAssistantReady =
        options?.waitForAssistantReady === true && expectsReadyToSpeakRef.current;
      let readyToSpeakPromise: Promise<void> | null = null;

      const isStaleAttempt = () =>
        isCancelledRef.current || connectionAttemptIdRef.current !== thisAttemptId;

      if (room.state !== 'disconnected' || (activeCallRef.current && status === 'connected')) {
        setConnectionError('A call is already connecting or ending. Please try again in a moment.');
        setCallPhase('failed');
        return;
      }

      setStatus('connecting');
      setCallPhase('connecting');
      setCallType(type);
      setActiveCallAssistant(assistant);
      setError(null);
      setConnectionError(null);
      if (!options?.suppressRinging) {
        startRinging();
      }
      try {
        const dispatchTimeout =
          (typeof window !== 'undefined' && (window as any)._TEST_CALL_DISPATCH_TIMEOUT) ||
          CALL_DISPATCH_TIMEOUT;

        let call: OrgCallSession | null = null;
        for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
          if (isStaleAttempt()) return;
          try {
            const data = await promiseWithTimeout(
              options?.callSessionId
                ? callApi(`/api/calls/${encodeURIComponent(options.callSessionId)}/answer`)
                : callApi('/api/calls', {
                    kind: 'assistant_dm',
                    assistantId: Number(assistant.agentId),
                    openingConfig: options?.openingConfig,
                  }),
              dispatchTimeout,
              'Timed out preparing the call. Retrying…'
            );
            if (isStaleAttempt()) return;
            call = parseOrgCallSession(data);
            break;
          } catch (err) {
            if (attempt > MAX_RETRIES) {
              throw err;
            }
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
        if (!call) return;
        setActiveCall(call);

        if (shouldWaitForAssistantReady) {
          readyToSpeakPromise = new Promise((resolve, reject) => {
            assistantReadyWaiterRef.current = { attemptId: thisAttemptId, resolve, reject };
          });
        }

        const connected = await connectToRoom(call, {
          video: type === 'video',
          startMuted: options?.startMuted,
        });
        if (isStaleAttempt()) {
          resolveAssistantReadyWaiter(thisAttemptId);
          if (room.state !== 'disconnected') await room.disconnect();
          return;
        }
        if (!connected) {
          throw new Error(error || 'Could not connect to the call.');
        }

        beginAssistantSupervision(assistant, thisAttemptId, shouldWaitForAssistantReady);

        if (readyToSpeakPromise) {
          await readyToSpeakPromise;
        }
      } catch (e: any) {
        if (isStaleAttempt()) return;
        resolveAssistantReadyWaiter(thisAttemptId);
        stopRinging();
        setCallPhase('failed');
        toast.error('Failed to start call. Please try again.');
        setError(`Failed to start call: ${e.message}`);
        const callId = activeCallRef.current?.callId;
        if (callId) {
          callApi(`/api/calls/${encodeURIComponent(callId)}/end`).catch(() => {});
        }
        if (room.state !== 'disconnected') {
          room.disconnect().catch(console.error);
        } else {
          onDisconnected();
        }
      }
    },
    [
      room,
      status,
      error,
      beginAssistantSupervision,
      connectToRoom,
      onDisconnected,
      resolveAssistantReadyWaiter,
      setCallPhase,
      startRinging,
      stopRinging,
    ]
  );

  // --- Redispatch a dropped assistant (server-side idempotent dispatch) ---
  const redispatchAssistant = React.useCallback(async () => {
    const assistant = activeCallAssistantRef.current;
    const call = activeCallRef.current;
    const targetAssistantId = assistant
      ? Number(assistant.agentId)
      : call?.assistantIds.length === 1
        ? call.assistantIds[0]
        : null;
    if (!call || targetAssistantId == null) return;
    if (redispatchPromiseRef.current) return redispatchPromiseRef.current;

    const generation = connectionAttemptIdRef.current;
    const displayName = assistant ? assistantDisplayName(assistant) : 'The assistant';

    const redispatch = (async () => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (!isCurrentGeneration(generation)) return;
        try {
          await callApi(`/api/calls/${encodeURIComponent(call.callId)}/assistants`, {
            assistantId: targetAssistantId,
          });
          return;
        } catch (err) {
          if (attempt === MAX_RETRIES) {
            if (!isCurrentGeneration(generation)) return;
            const message = err instanceof Error ? err.message : 'Unknown reconnect error.';
            setConnectionError(`${displayName} had trouble rejoining: ${message}`);
            setIsWaitingForAssistant(false);
            setCallPhase('failed');
            toast.error(`${displayName} had trouble rejoining. Please retry the call.`);
            return;
          }
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    })();

    redispatchPromiseRef.current = redispatch;
    try {
      await redispatch;
    } finally {
      if (redispatchPromiseRef.current === redispatch) {
        redispatchPromiseRef.current = null;
      }
    }
  }, [isCurrentGeneration, setCallPhase]);

  React.useEffect(() => {
    redispatchAssistantRef.current = redispatchAssistant;
  }, [redispatchAssistant]);

  const retryConnection = React.useCallback(async () => {
    const assistantToRetry = activeCallAssistant;
    const callTypeToRetry = callType;
    if (!assistantToRetry || !callTypeToRetry) return;

    if (room.state !== 'disconnected' && activeCallRef.current) {
      setConnectionError(null);
      setWaitingMessage(`Trying to reconnect ${assistantDisplayName(assistantToRetry)}...`);
      setIsWaitingForAssistant(true);
      setIsAssistantPreparing(false);
      setCallPhase('recovering_assistant');
      await redispatchAssistant();
      return;
    }

    connect(assistantToRetry, callTypeToRetry, activeConnectOptionsRef.current);
  }, [activeCallAssistant, callType, room, connect, redispatchAssistant, setCallPhase]);

  // --- Answer / join / decline / leave / end ---

  const answerCall = React.useCallback(
    async (call: OrgCallSession) => {
      setIncomingCall(null);
      setActiveCall(call);
      let joinedServerSide = false;
      try {
        const data = await callApi(`/api/calls/${encodeURIComponent(call.callId)}/answer`);
        joinedServerSide = true;
        const next = parseOrgCallSession(data);
        setActiveCall(next);
        const connected = await connectToRoom(next);
        if (!connected) throw new Error('Could not answer call');
        return true;
      } catch {
        // Undo the server-side "joined" mark, or the roster shows a ghost
        // participant and /calls/active offers a bogus rejoin banner.
        if (joinedServerSide) {
          callApi(`/api/calls/${encodeURIComponent(call.callId)}/leave`).catch(() => {});
        }
        return await failCall('Could not answer call');
      }
    },
    [connectToRoom, failCall]
  );

  const joinCall = React.useCallback(
    async (call: OrgCallSession) => {
      setIncomingCall(null);
      setActiveCall(call);
      let joinedServerSide = false;
      try {
        const data = await callApi(`/api/calls/${encodeURIComponent(call.callId)}/join`);
        joinedServerSide = true;
        const next = parseOrgCallSession(data);
        setActiveCall(next);
        const connected = await connectToRoom(next);
        if (!connected) throw new Error('Could not join call');
        return true;
      } catch {
        if (joinedServerSide) {
          callApi(`/api/calls/${encodeURIComponent(call.callId)}/leave`).catch(() => {});
        }
        return await failCall('Could not join call');
      }
    },
    [connectToRoom, failCall]
  );

  const declineCall = React.useCallback(async (call: OrgCallSession) => {
    setIncomingCall(null);
    try {
      await callApi(`/api/calls/${encodeURIComponent(call.callId)}/decline`);
    } catch {
      /* ignore */
    }
  }, []);

  const finishCall = React.useCallback(
    async (action: 'leave' | 'end') => {
      const call = activeCallRef.current;
      isCancelledRef.current = true;
      clearAssistantTimers();
      stopRemoteControl();
      setCallPhase('ending');
      setConnectionError(null);
      if (room.state !== 'disconnected') {
        await room.disconnect();
      } else {
        onDisconnected();
      }
      if (call?.callId) {
        try {
          await callApi(`/api/calls/${encodeURIComponent(call.callId)}/${action}`);
        } catch {
          /* ignore */
        }
      }
    },
    [room, clearAssistantTimers, onDisconnected, setCallPhase, stopRemoteControl]
  );

  const leaveCall = React.useCallback(() => finishCall('leave'), [finishCall]);
  const endCall = React.useCallback(() => finishCall('end'), [finishCall]);

  /** Assistant-call surface: hanging up a 1:1 call ends its session. */
  const disconnect = React.useCallback(async () => {
    await finishCall(activeCallRef.current?.scope === 'assistant_dm' ? 'end' : 'leave');
  }, [finishCall]);

  React.useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  // --- Media toggles ---
  const toggleMic = React.useCallback(async () => {
    if (devModeRef.current || room.state === 'disconnected') {
      setMicEnabled((v) => !v);
      return;
    }
    const next = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(next, CALL_AUDIO_CAPTURE_OPTIONS);
    setMicEnabled(next);
  }, [room, micEnabled]);

  const toggleCam = React.useCallback(async () => {
    if (devModeRef.current || room.state === 'disconnected') {
      setCamEnabled((v) => !v);
      return;
    }
    const next = !camEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setCamEnabled(next);
    setRoomEpoch((n) => n + 1);
  }, [room, camEnabled]);

  const toggleScreenShare = React.useCallback(async () => {
    if (devModeRef.current || room.state === 'disconnected') {
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
  }, [room, screenShareEnabled]);

  // --- Assistants on the call ---
  const addAssistant = React.useCallback(async (assistantId: number) => {
    const call = activeCallRef.current;
    if (!call?.callId) return false;
    try {
      const data = await callApi(`/api/calls/${encodeURIComponent(call.callId)}/assistants`, {
        assistantId,
      });
      setActiveCall(parseOrgCallSession(data));
      return true;
    } catch {
      setError('Could not add assistant to the call');
      return false;
    }
  }, []);

  // --- Incoming frames (from either SSE stream) ---
  const handleIncomingCall = React.useCallback(
    (call: OrgCallSession) => {
      if (currentUserId && call.callerUserId === currentUserId && !call.createdByAssistantId) {
        return;
      }
      const me = call.participants.find((p) => p.userId === currentUserId);
      if (me && me.status !== 'invited') return;
      setIncomingCall(call);
    },
    [currentUserId]
  );

  const handleCallAnswered = React.useCallback((call: OrgCallSession) => {
    setActiveCall((prev) => (prev?.callId === call.callId ? call : prev));
  }, []);

  const handleRemoteEnded = React.useCallback(
    async (call: OrgCallSession) => {
      setIncomingCall((prev) => (prev?.callId === call.callId ? null : prev));
      if (activeCallRef.current?.callId === call.callId) {
        isCancelledRef.current = true;
        clearAssistantTimers();
        stopRemoteControl();
        if (room.state !== 'disconnected') {
          await room.disconnect();
        } else {
          onDisconnected();
        }
      }
    },
    [room, clearAssistantTimers, onDisconnected, stopRemoteControl]
  );

  const handleParticipantUpdate = React.useCallback((call: OrgCallSession) => {
    setActiveCall((prev) => (prev?.callId === call.callId ? call : prev));
  }, []);

  // --- Desktop / remote control (assistant on the call) ---

  // Whether this assistant has a desktop to show at all. Hosted installs need
  // the managed Computer add-on (``active`` / ``grace_period``); self-host
  // serves the local desktop container from ``getLiveviewUrl``, where the
  // managed-desktop billing state is meaningless.
  const isDesktopEnabled =
    isSelfHost || (!!activeCallAssistant && resolveManagedDesktopMode(activeCallAssistant) != null);

  const [runtimeJobName, setRuntimeJobName] = React.useState<string | null>(null);

  React.useEffect(() => {
    const assistantId = activeCallAssistant?.agentId;
    if (!assistantId || !isDesktopEnabled) {
      setRuntimeJobName(null);
      return;
    }
    let cancelled = false;
    const refreshRuntimeJobName = async () => {
      try {
        const jobStatus = await fetchAssistantStatus(assistantId);
        if (cancelled || !jobStatus?.jobName) return;
        setRuntimeJobName(jobStatus.jobName);
      } catch {
        // Status is best-effort; desktop-ready polling retries on its own cadence.
      }
    };
    refreshRuntimeJobName();
    const interval = setInterval(refreshRuntimeJobName, RUNTIME_JOB_NAME_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeCallAssistant?.agentId, isDesktopEnabled]);

  const runtimePollScope = React.useMemo<DesktopSessionScope | null>(
    () => (runtimeJobName ? { jobName: runtimeJobName } : null),
    [runtimeJobName]
  );

  const boundGetLiveviewUrl = React.useCallback(
    (id: string, scope?: DesktopSessionScope | null) =>
      assistantActions.desktop.getLiveviewUrl(
        id,
        activeCallAssistant?.userId ?? '',
        activeCallAssistant?.organizationId ?? null,
        scope
      ),
    [assistantActions.desktop, activeCallAssistant?.userId, activeCallAssistant?.organizationId]
  );

  const { isDesktopReady, eventLiveviewUrl, eventBindingId, eventLiveviewPassword } =
    useDesktopReady(
      isDesktopEnabled ? activeCallAssistant?.agentId : undefined,
      boundGetLiveviewUrl,
      false,
      undefined,
      0,
      activeCall?.callId ?? null,
      runtimePollScope
    );

  const scopedLiveviewLookup = React.useCallback((): DesktopSessionScope | null => {
    if (eventBindingId) {
      return { bindingId: eventBindingId };
    }
    if (runtimeJobName) {
      return { jobName: runtimeJobName };
    }
    return null;
  }, [eventBindingId, runtimeJobName]);

  const refreshRemoteControlUrl = React.useCallback(async () => {
    if (!activeCallAssistant || !eventLiveviewUrl) return;
    const built = await assistantActions.desktop.buildLiveviewUrl(
      eventLiveviewUrl,
      activeCallAssistant.userId,
      activeCallAssistant.organizationId ?? null,
      eventLiveviewPassword
    );
    const healthy = await assistantActions.desktop.checkLiveviewHealth(built.liveviewUrl);
    if (!healthy) {
      throw new Error('Desktop liveview path is not reachable yet.');
    }
    setLiveviewUrl(built.liveviewUrl);
  }, [activeCallAssistant, assistantActions.desktop, eventLiveviewUrl, eventLiveviewPassword]);

  React.useEffect(() => {
    if (!isRemoteControlActive || !isDesktopReady || !eventLiveviewUrl) return;
    refreshRemoteControlUrl().catch((err) => {
      console.error('[useCall] Failed to refresh remote control URL:', err);
    });
  }, [eventLiveviewUrl, isDesktopReady, isRemoteControlActive, refreshRemoteControlUrl]);

  // Names this viewer to the runtime, so one participant closing the desktop
  // does not take it away from everyone else still watching it.
  const callViewerFields = React.useCallback(
    () => ({
      viewerUserId: currentUserId ?? '',
      viewerSource: callViewerSource(activeCallRef.current?.callId ?? ''),
    }),
    [currentUserId]
  );

  const toggleRemoteControl = React.useCallback(async () => {
    if (!activeCallAssistant) return;

    if (isRemoteControlActive) {
      if (isRemoteControlInteractive) {
        assistantActions.desktop
          .sendSystemEvent(
            activeCallAssistant.agentId,
            'user_remote_control_stopped',
            'User released remote control of assistant desktop'
          )
          .catch(console.error);
      }
      assistantActions.desktop
        .sendSystemEvent(
          activeCallAssistant.agentId,
          'assistant_screen_share_stopped',
          'User disabled assistant screen sharing',
          callViewerFields()
        )
        .catch(console.error);
      stopRemoteControl();
      return;
    }

    setIsRemoteControlLoading(true);
    const toastId = toast.loading('Starting assistant screen sharing...');

    try {
      let resolvedUrl: string | undefined;

      if (eventLiveviewUrl) {
        const built = await assistantActions.desktop.buildLiveviewUrl(
          eventLiveviewUrl,
          activeCallAssistant.userId,
          activeCallAssistant.organizationId ?? null,
          eventLiveviewPassword
        );
        resolvedUrl = built.liveviewUrl;
      } else if (isDesktopReady) {
        const result = await assistantActions.desktop.getLiveviewUrl(
          activeCallAssistant.agentId,
          activeCallAssistant.userId,
          activeCallAssistant.organizationId ?? null,
          scopedLiveviewLookup()
        );
        if ('liveviewUrl' in result) {
          resolvedUrl = result.liveviewUrl;
        }
      }

      if (resolvedUrl) {
        const healthy = await assistantActions.desktop.checkLiveviewHealth(resolvedUrl);
        if (!healthy) {
          throw new Error('Desktop is not reachable — it may still be starting up.');
        }
        setLiveviewUrl(resolvedUrl);
      } else {
        setLiveviewUrl(null);
      }
      setIsRemoteControlActive(true);
      setIsRemoteControlInteractive(false);
      assistantActions.desktop
        .sendSystemEvent(
          activeCallAssistant.agentId,
          'assistant_screen_share_started',
          'User enabled assistant screen sharing',
          callViewerFields()
        )
        .catch(console.error);
      toast.success('Assistant screen sharing started.', { id: toastId });
    } catch (e: any) {
      console.error('[useCall] Toggle remote control failed:', e.message);
      toast.error('The assistant could not share their screen. Please try again.', {
        id: toastId,
      });
    } finally {
      setIsRemoteControlLoading(false);
    }
  }, [
    isRemoteControlActive,
    isRemoteControlInteractive,
    stopRemoteControl,
    assistantActions.desktop,
    activeCallAssistant,
    eventLiveviewUrl,
    eventLiveviewPassword,
    isDesktopReady,
    scopedLiveviewLookup,
    callViewerFields,
  ]);

  const toggleRemoteControlInteractive = React.useCallback(async () => {
    if (!isRemoteControlActive || !activeCallAssistant) return;

    const nextState = !isRemoteControlInteractive;
    const eventType = nextState ? 'user_remote_control_started' : 'user_remote_control_stopped';
    const message = nextState
      ? 'User took remote control of assistant desktop'
      : 'User released remote control of assistant desktop';

    setIsRemoteControlInteractiveLoading(true);
    try {
      const result = await assistantActions.desktop.sendSystemEvent(
        activeCallAssistant.agentId,
        eventType,
        message
      );
      if (result.detail) {
        throw new Error(result.detail);
      }
      setIsRemoteControlInteractive(nextState);
      toast.info(nextState ? 'Interactive mode enabled.' : 'View-only mode enabled.');
    } catch (e: any) {
      console.error(`[useCall] Failed to toggle interactive mode to ${nextState}:`, e.message);
      toast.error(`Could not ${nextState ? 'enable' : 'disable'} interactive mode.`);
    } finally {
      setIsRemoteControlInteractiveLoading(false);
    }
  }, [
    isRemoteControlActive,
    isRemoteControlInteractive,
    activeCallAssistant,
    assistantActions.desktop,
  ]);

  const isHost = Boolean(
    activeCall &&
    currentUserId &&
    (activeCall.createdByUserId === currentUserId || activeCall.scope === 'assistant_dm')
  );

  return {
    // Shared session surface
    status,
    activeCall,
    incomingCall,
    error,
    room,
    roomEpoch,
    micEnabled,
    camEnabled,
    screenShareEnabled,
    assistantSharesById,
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
    // Assistant-call surface
    connect,
    disconnect,
    retryConnection,
    activeCallAssistant,
    callType,
    callPhase,
    isWaitingForAssistant,
    isAssistantPreparing,
    waitingMessage,
    connectionError,
    activeOpeningConfig,
    isSpeakerMuted,
    toggleSpeakerMute,
    setPlaybackHold,
    avatarMood,
    // Desktop / remote control surface
    isDesktopEnabled,
    isDesktopReady,
    isRemoteControlActive,
    liveviewUrl,
    isRemoteControlLoading,
    toggleRemoteControl,
    isRemoteControlInteractive,
    isRemoteControlInteractiveLoading,
    toggleRemoteControlInteractive,
  };
}

export type CallEngine = ReturnType<typeof useCall>;
