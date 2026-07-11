import * as React from 'react';
import { Room, RoomEvent, type AudioCaptureOptions } from 'livekit-client';
import { toast } from 'sonner';
import {
  Assistant,
  AssistantActions,
  AssistantCallConnectOptions,
} from '@/types/assistants/assistant';
import { ConnectionDetails } from '@/types/assistants/call';
import { makeRoomName } from '@/utils/assistants/call-utils';
import { useDesktopReady } from '@/hooks/Assistants/useDesktopReady';
import type { DesktopSessionScope } from '@/lib/assistants/desktopSessionScope';
import { clearDesktopReadyCache } from '@/lib/assistants/desktopSessionScope';
import { fetchAssistantStatus } from '@/lib/client/assistant';
import { useCallSounds } from '@/hooks/Assistants/useCallSounds';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import type { CreatureMood } from '@/components/Brand/TeammateCreature';

const DEFAULT_AVATAR_MOOD = 'happy' satisfies CreatureMood;
const ASSISTANT_JOIN_SLOW_THRESHOLD = 90000; // 90 seconds — soft warning, not an error
const ASSISTANT_REJOIN_TIMEOUT = 30000; // 30 seconds for rejoin
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
// Abort a connection-details/dispatch request that never settles (e.g. a request
// stalled behind a dev-server rebuild) so the retry loop can recover instead of
// the whole call hanging forever.
const CALL_DISPATCH_TIMEOUT = 12000;
// If the assistant never makes its first appearance in the room, re-dispatch it
// once, then fail the attempt cleanly. Without this an interrupted/dropped initial
// dispatch leaves the caller waiting on an assistant that was never summoned.
const ASSISTANT_INITIAL_REDISPATCH_DELAY = 12000;
const ASSISTANT_INITIAL_JOIN_TIMEOUT = 60000;
const RUNTIME_JOB_NAME_POLL_INTERVAL_MS = 15000;
const CALL_AUDIO_CAPTURE_OPTIONS: AudioCaptureOptions = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

type CallPhase =
  | 'idle'
  | 'connecting'
  | 'awaiting_assistant'
  | 'preparing_assistant'
  | 'active'
  | 'recovering_assistant'
  | 'ending'
  | 'failed';

type PendingRoomDelete = {
  generation: number;
  roomName: string;
};

function createCallSessionId(assistantId: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `meet-${assistantId}-${Date.now()}-${random}`;
}

// Races a promise against a timeout. The underlying request is not cancelled
// (server actions are not abortable here); we simply stop awaiting it so a hung
// request becomes a recoverable rejection rather than an indefinite wait.
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

async function publishMicrophoneForCallStartup(room: Room, options?: AssistantCallConnectOptions) {
  const publication = await room.localParticipant.setMicrophoneEnabled(
    true,
    CALL_AUDIO_CAPTURE_OPTIONS
  );
  if (options?.startMuted === true) {
    await publication?.mute();
  }
}

type AssistantReadyWaiter = {
  attemptId: number;
  resolve: () => void;
  reject: (error: Error) => void;
};

// The call hook only touches the call + desktop action groups, so it accepts
// the narrow subset rather than the full AssistantActions bag. This lets the
// layout-level CallProvider feed it without assembling every action factory.
export function useAssistantCall(
  room: Room,
  assistantActions: Pick<AssistantActions, 'call' | 'desktop'>
) {
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [activeCallAssistant, setActiveCallAssistant] = React.useState<Assistant | null>(null);
  const [callType, setCallType] = React.useState<'video' | 'audio' | null>(null);
  const [isSpeakerMuted, setIsSpeakerMuted] = React.useState(false);
  const [isWaitingForAssistant, setIsWaitingForAssistant] = React.useState(false);
  const [isAssistantPreparing, setIsAssistantPreparing] = React.useState(false);
  const [activeOpeningConfig, setActiveOpeningConfig] =
    React.useState<AssistantCallConnectOptions['openingConfig']>(undefined);
  const [waitingMessage, setWaitingMessage] = React.useState<string | null>(null);
  const [connectionError, setConnectionError] = React.useState<string | null>(null);
  const avatarMood: CreatureMood = DEFAULT_AVATAR_MOOD;
  const [callPhase, setCallPhaseState] = React.useState<CallPhase>('idle');
  const assistantJoinTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const assistantRejoinTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Initial-join recovery timers: re-dispatch the assistant if it never shows up
  // on a fresh call, then give up cleanly so the caller isn't stuck on a spinner.
  const assistantInitialRedispatchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const assistantInitialJoinTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // ``redispatchAssistant`` is defined further down; connect() reaches it through
  // this ref to avoid a declaration-order/circular-dependency cycle.
  const redispatchAssistantRef = React.useRef<(() => void) | null>(null);
  const isCancelledRef = React.useRef(false);
  const isRedispatchingRef = React.useRef(false);
  const redispatchPromiseRef = React.useRef<Promise<void> | null>(null);
  const pendingRoomDeleteRef = React.useRef<PendingRoomDelete | null>(null);
  const sdkReconnectingRef = React.useRef(false);
  const expectsReadyToSpeakRef = React.useRef(false);
  const assistantReadyWaiterRef = React.useRef<AssistantReadyWaiter | null>(null);
  const activeConnectOptionsRef = React.useRef<AssistantCallConnectOptions | undefined>(undefined);
  const [activeCallSessionId, setActiveCallSessionId] = React.useState<string | null>(null);
  const activeCallSessionIdRef = React.useRef<string | null>(null);
  const connectionDetailsRef = React.useRef<ConnectionDetails | null>(null);
  const callPhaseRef = React.useRef<CallPhase>('idle');
  // Unique ID for each connection attempt - used to detect stale operations
  const connectionAttemptIdRef = React.useRef(0);
  // Lets room event handlers (defined in an effect below) reach the latest
  // ``disconnect`` without re-subscribing on every render. Used to react to the
  // assistant ending the meet (``call_ended``) by leaving gracefully ourselves.
  const disconnectRef = React.useRef<(() => Promise<void>) | null>(null);

  // --- Remote Control State ---
  const [isRemoteControlActive, setIsRemoteControlActive] = React.useState(false);
  const [liveviewUrl, setLiveviewUrl] = React.useState<string | null>(null);
  const [isRemoteControlLoading, setIsRemoteControlLoading] = React.useState(false);
  const [isRemoteControlInteractive, setIsRemoteControlInteractive] = React.useState(false);
  const [isRemoteControlInteractiveLoading, setIsRemoteControlInteractiveLoading] =
    React.useState(false);

  const { startRinging, stopRinging, setRingingMuted, playHangup } = useCallSounds();

  // Track whether we were truly connected so we only play hangup when appropriate
  const wasConnectedRef = React.useRef(false);

  const toggleSpeakerMute = React.useCallback(() => {
    setIsSpeakerMuted((prev) => !prev);
  }, []);

  React.useEffect(() => {
    setRingingMuted(isSpeakerMuted);
  }, [isSpeakerMuted, setRingingMuted]);

  const setCallPhase = React.useCallback((phase: CallPhase) => {
    callPhaseRef.current = phase;
    setCallPhaseState(phase);
  }, []);

  const isCurrentGeneration = React.useCallback((generation: number) => {
    return !isCancelledRef.current && connectionAttemptIdRef.current === generation;
  }, []);

  const clearAssistantJoinTimeout = React.useCallback(() => {
    if (assistantJoinTimeoutRef.current) {
      clearTimeout(assistantJoinTimeoutRef.current);
      assistantJoinTimeoutRef.current = null;
    }
    if (assistantRejoinTimeoutRef.current) {
      clearTimeout(assistantRejoinTimeoutRef.current);
      assistantRejoinTimeoutRef.current = null;
    }
    if (assistantInitialRedispatchTimeoutRef.current) {
      clearTimeout(assistantInitialRedispatchTimeoutRef.current);
      assistantInitialRedispatchTimeoutRef.current = null;
    }
    if (assistantInitialJoinTimeoutRef.current) {
      clearTimeout(assistantInitialJoinTimeoutRef.current);
      assistantInitialJoinTimeoutRef.current = null;
    }
  }, []);

  const stopRemoteControl = React.useCallback(() => {
    setIsRemoteControlActive(false);
    setLiveviewUrl(null);
    setIsRemoteControlInteractive(false);
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

  const onDisconnected = React.useCallback(() => {
    rejectAssistantReadyWaiter('Call disconnected before the assistant was ready.');
    stopRinging();
    const pendingDelete = pendingRoomDeleteRef.current;
    pendingRoomDeleteRef.current = null;
    if (pendingDelete && connectionAttemptIdRef.current === pendingDelete.generation) {
      assistantActions.call.deleteRoom(pendingDelete.roomName).catch(() => {});
    }
    if (wasConnectedRef.current) {
      playHangup();
    }
    wasConnectedRef.current = false;

    const disconnectingId = activeCallAssistantRef.current?.agentId;
    if (disconnectingId) {
      clearDesktopReadyCache(disconnectingId);
    }

    setIsConnected(false);
    setIsConnecting(false);
    setIsWaitingForAssistant(false);
    setIsAssistantPreparing(false);
    setCallPhase('idle');
    setWaitingMessage(null);
    setConnectionError(null);
    setConnectionDetails(null);
    connectionDetailsRef.current = null;
    setActiveCallAssistant(null);
    setCallType(null);
    activeConnectOptionsRef.current = undefined;
    activeCallSessionIdRef.current = null;
    setActiveCallSessionId(null);
    setActiveOpeningConfig(undefined);
    setIsSpeakerMuted(false);
    isRedispatchingRef.current = false;
    redispatchPromiseRef.current = null;
    sdkReconnectingRef.current = false;
    stopRemoteControl();
    clearAssistantJoinTimeout();
  }, [
    assistantActions.call,
    clearAssistantJoinTimeout,
    rejectAssistantReadyWaiter,
    setCallPhase,
    stopRemoteControl,
    stopRinging,
    playHangup,
  ]);

  const connect = React.useCallback(
    async (
      assistant: Assistant,
      type: 'video' | 'audio',
      options?: AssistantCallConnectOptions
    ) => {
      resolveAssistantReadyWaiter();
      connectionAttemptIdRef.current += 1;
      const thisAttemptId = connectionAttemptIdRef.current;
      const callSessionId = options?.callSessionId ?? createCallSessionId(assistant.agentId);
      const optionsWithSession = { ...options, callSessionId };
      activeConnectOptionsRef.current = optionsWithSession;
      activeCallSessionIdRef.current = callSessionId;
      setActiveCallSessionId(callSessionId);
      clearDesktopReadyCache(assistant.agentId);
      setActiveOpeningConfig(optionsWithSession.openingConfig);
      isCancelledRef.current = false;
      pendingRoomDeleteRef.current = null;
      redispatchPromiseRef.current = null;
      isRedispatchingRef.current = false;
      sdkReconnectingRef.current = false;
      expectsReadyToSpeakRef.current =
        !optionsWithSession.openingConfig ||
        optionsWithSession.openingConfig.mode === 'speak' ||
        optionsWithSession.openingConfig.mode === 'recorded';
      const shouldWaitForAssistantReady =
        optionsWithSession.waitForAssistantReady === true && expectsReadyToSpeakRef.current;
      let readyToSpeakPromise: Promise<void> | null = null;

      const isStaleAttempt = () =>
        isCancelledRef.current || connectionAttemptIdRef.current !== thisAttemptId;

      if (room.state !== 'disconnected') {
        setConnectionError('A call is already connecting or ending. Please try again in a moment.');
        setCallPhase('failed');
        return;
      }
      if (!assistant) return;

      setIsConnecting(true);
      setCallPhase('connecting');
      setCallType(type);
      setActiveCallAssistant(assistant);
      setError(null);
      setConnectionError(null);
      if (!optionsWithSession.suppressRinging) {
        startRinging();
      }
      try {
        const expectedRoomName = makeRoomName(assistant.agentId, 'meet');

        const assistantName = assistantDisplayName(assistant);
        let connDetails: ConnectionDetails | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
          if (isStaleAttempt()) return;

          try {
            // Run getConnectionDetails and dispatchToCall in parallel.
            // The room name is deterministic (unity_{id}_meet), so dispatch
            // doesn't need to wait for connection details.
            //
            // Time-box the pair: if either request stalls without settling (seen
            // when a dev-server rebuild interrupts an in-flight server action),
            // the timeout turns it into a retryable rejection instead of hanging
            // the entire call setup.
            const dispatchTimeout =
              (typeof window !== 'undefined' && (window as any)._TEST_CALL_DISPATCH_TIMEOUT) ||
              CALL_DISPATCH_TIMEOUT;
            const [details, dispatchResult] = await promiseWithTimeout(
              Promise.all([
                assistantActions.call.getConnectionDetails(assistant.agentId, assistantName),
                assistantActions.call.dispatchToCall(
                  assistant.agentId,
                  expectedRoomName,
                  optionsWithSession.openingConfig,
                  callSessionId
                ),
              ]),
              dispatchTimeout,
              'Timed out preparing the call. Retrying…'
            );
            if (isStaleAttempt()) return;

            if ('detail' in details) {
              throw new Error((details as any).detail || 'Could not get call details.');
            }
            connDetails = details as ConnectionDetails;
            setConnectionDetails(connDetails);
            connectionDetailsRef.current = connDetails;

            if (dispatchResult.detail) {
              throw new Error(`Failed to dispatch assistant: ${dispatchResult.detail}`);
            }

            break;
          } catch (err: any) {
            if (attempt > MAX_RETRIES) {
              throw err;
            }

            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        if (!connDetails) return;

        if (connDetails.mode === 'dev') {
          setConnectionDetails(connDetails);
          connectionDetailsRef.current = connDetails;
          stopRinging();
          setIsConnected(true);
          setIsConnecting(false);
          setCallPhase('active');
          wasConnectedRef.current = true;
          setIsWaitingForAssistant(false);
          setIsAssistantPreparing(false);
        } else {
          if (shouldWaitForAssistantReady) {
            readyToSpeakPromise = new Promise((resolve, reject) => {
              assistantReadyWaiterRef.current = { attemptId: thisAttemptId, resolve, reject };
            });
          }

          await room.connect(connDetails.serverUrl, connDetails.token);
          if (isStaleAttempt()) {
            resolveAssistantReadyWaiter(thisAttemptId);
            await room.disconnect();
            return;
          }

          await Promise.all([
            publishMicrophoneForCallStartup(room, optionsWithSession),
            room.localParticipant.setCameraEnabled(type === 'video'),
          ]);
          setIsConnected(true);
          setIsConnecting(false);
          wasConnectedRef.current = true;

          if (room.remoteParticipants.size < 1) {
            setIsWaitingForAssistant(true);
            setIsAssistantPreparing(false);
            setCallPhase('awaiting_assistant');
            const timeoutDuration =
              (typeof window !== 'undefined' && (window as any)._TEST_ASSISTANT_JOIN_TIMEOUT) ||
              ASSISTANT_JOIN_SLOW_THRESHOLD;
            assistantJoinTimeoutRef.current = setTimeout(() => {
              if (isStaleAttempt()) return;
              setWaitingMessage(
                `${assistantDisplayName(assistant)} is taking a bit longer than expected…`
              );
            }, timeoutDuration);

            // When the caller blocks on the assistant being ready (the onboarding
            // intro call), guard the *first* join: if the assistant never appears
            // — e.g. an initial dispatch that was dropped or never issued — try a
            // single re-dispatch, then fail the attempt so the UI can recover
            // (retry / fall back to chat) instead of spinning indefinitely. All
            // timers are cleared the moment the participant connects.
            if (shouldWaitForAssistantReady) {
              const redispatchDelay =
                (typeof window !== 'undefined' &&
                  (window as any)._TEST_ASSISTANT_INITIAL_REDISPATCH_DELAY) ||
                ASSISTANT_INITIAL_REDISPATCH_DELAY;
              assistantInitialRedispatchTimeoutRef.current = setTimeout(() => {
                if (isStaleAttempt()) return;
                if (room.remoteParticipants.size < 1) {
                  redispatchAssistantRef.current?.();
                }
              }, redispatchDelay);

              const joinTimeout =
                (typeof window !== 'undefined' &&
                  (window as any)._TEST_ASSISTANT_INITIAL_JOIN_TIMEOUT) ||
                ASSISTANT_INITIAL_JOIN_TIMEOUT;
              assistantInitialJoinTimeoutRef.current = setTimeout(() => {
                if (isStaleAttempt()) return;
                if (room.remoteParticipants.size < 1) {
                  rejectAssistantReadyWaiter(
                    `${assistantDisplayName(assistant)} didn't join the call in time.`,
                    thisAttemptId
                  );
                }
              }, joinTimeout);
            }
          } else {
            setIsWaitingForAssistant(false);
            setIsAssistantPreparing(expectsReadyToSpeakRef.current);
            setCallPhase(expectsReadyToSpeakRef.current ? 'preparing_assistant' : 'active');
            stopRinging();
          }

          if (readyToSpeakPromise) {
            await readyToSpeakPromise;
          }
        }
      } catch (e: any) {
        // Only handle error if this attempt is still the current one
        if (isStaleAttempt()) return;

        resolveAssistantReadyWaiter(thisAttemptId);
        stopRinging();
        setIsConnecting(false);
        setCallPhase('failed');
        toast.error(`Failed to start call. Please try again.`);
        setError(`Failed to start call: ${e.message}`);
        // Ensure we disconnect if we were partially connected (e.g. mic permission failed)
        if (room.state !== 'disconnected') {
          room.disconnect().catch(console.error);
        }
        onDisconnected();
      }
    },
    [
      room,
      assistantActions.call,
      onDisconnected,
      startRinging,
      stopRinging,
      resolveAssistantReadyWaiter,
      rejectAssistantReadyWaiter,
      setCallPhase,
    ]
  );

  const disconnect = React.useCallback(async () => {
    const generation = connectionAttemptIdRef.current;
    const assistant = activeCallAssistantRef.current;
    const roomName =
      connectionDetailsRef.current?.roomName ??
      (assistant ? makeRoomName(assistant.agentId, 'meet') : null);
    isCancelledRef.current = true;
    clearAssistantJoinTimeout();
    stopRemoteControl();
    setCallPhase('ending');
    setConnectionError(null);
    isRedispatchingRef.current = false;
    redispatchPromiseRef.current = null;
    if (roomName) {
      pendingRoomDeleteRef.current = { generation, roomName };
    }

    if (isConnecting) {
      setIsConnecting(false);
    }

    if (room.state !== 'disconnected') {
      await room.disconnect();
    } else {
      if (pendingRoomDeleteRef.current && roomName) {
        pendingRoomDeleteRef.current = null;
        await assistantActions.call.deleteRoom(roomName).catch(() => {});
      }
      // If room wasn't even connecting, we still need to trigger cleanup.
      onDisconnected();
    }
  }, [
    room,
    assistantActions.call,
    clearAssistantJoinTimeout,
    stopRemoteControl,
    isConnecting,
    onDisconnected,
    setCallPhase,
  ]);

  React.useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  const retryConnection = React.useCallback(async () => {
    const assistantToRetry = activeCallAssistant;
    const callTypeToRetry = callType;
    if (!assistantToRetry || !callTypeToRetry) return;

    if (room.state !== 'disconnected' && connectionDetailsRef.current) {
      const generation = connectionAttemptIdRef.current;
      setConnectionError(null);
      setWaitingMessage(`Trying to reconnect ${assistantDisplayName(assistantToRetry)}...`);
      setIsWaitingForAssistant(true);
      setIsAssistantPreparing(false);
      setCallPhase('recovering_assistant');
      try {
        const result = await assistantActions.call.dispatchToCall(
          assistantToRetry.agentId,
          connectionDetailsRef.current.roomName,
          undefined,
          activeCallSessionIdRef.current ?? undefined
        );
        if (!isCurrentGeneration(generation)) return;
        if (result.detail) {
          throw new Error(result.detail);
        }
      } catch (error) {
        if (!isCurrentGeneration(generation)) return;
        const message = error instanceof Error ? error.message : 'Unknown reconnect error.';
        setConnectionError(
          `${assistantDisplayName(assistantToRetry)} could not rejoin: ${message}`
        );
        setIsWaitingForAssistant(false);
        setCallPhase('failed');
      }
      return;
    }

    // Start the connection process again with the same assistant
    connect(assistantToRetry, callTypeToRetry, activeConnectOptionsRef.current);
  }, [
    activeCallAssistant,
    callType,
    room,
    connect,
    isCurrentGeneration,
    setCallPhase,
    assistantActions.call,
  ]);

  const [runtimeJobName, setRuntimeJobName] = React.useState<string | null>(null);

  React.useEffect(() => {
    const assistantId = activeCallAssistant?.agentId;
    if (!assistantId) {
      setRuntimeJobName(null);
      return;
    }

    let cancelled = false;

    const refreshRuntimeJobName = async () => {
      try {
        const status = await fetchAssistantStatus(assistantId);
        if (cancelled || !status?.jobName) return;
        setRuntimeJobName(status.jobName);
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
  }, [activeCallAssistant?.agentId]);

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

  const { isDesktopReady, eventLiveviewUrl, eventBindingId } = useDesktopReady(
    activeCallAssistant?.agentId,
    boundGetLiveviewUrl,
    false,
    undefined,
    0,
    activeCallSessionId,
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
      activeCallAssistant.organizationId ?? null
    );
    const healthy = await assistantActions.desktop.checkLiveviewHealth(built.liveviewUrl);
    if (!healthy) {
      throw new Error('Desktop liveview path is not reachable yet.');
    }
    setLiveviewUrl(built.liveviewUrl);
  }, [activeCallAssistant, assistantActions.desktop, eventLiveviewUrl]);

  React.useEffect(() => {
    if (!isRemoteControlActive || !isDesktopReady || !eventLiveviewUrl) return;
    refreshRemoteControlUrl().catch((error) => {
      console.error('[useAssistantCall] Failed to refresh remote control URL:', error);
    });
  }, [eventLiveviewUrl, isDesktopReady, isRemoteControlActive, refreshRemoteControlUrl]);

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
          'User disabled assistant screen sharing'
        )
        .catch(console.error);
      stopRemoteControl();
      return;
    }

    setIsRemoteControlLoading(true);
    const toastId = toast.loading('Starting assistant screen sharing...');

    try {
      if (!isDesktopReady && !eventLiveviewUrl) {
        setIsRemoteControlActive(true);
        setLiveviewUrl(null);
        setIsRemoteControlInteractive(false);
        assistantActions.desktop
          .sendSystemEvent(
            activeCallAssistant.agentId,
            'assistant_screen_share_started',
            'User enabled assistant screen sharing'
          )
          .catch(console.error);
        toast.success('Assistant screen sharing started.', { id: toastId });
        return;
      }

      let resolvedUrl: string | undefined;

      if (eventLiveviewUrl) {
        const built = await assistantActions.desktop.buildLiveviewUrl(
          eventLiveviewUrl,
          activeCallAssistant.userId,
          activeCallAssistant.organizationId ?? null
        );
        resolvedUrl = built.liveviewUrl;
      } else {
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
        setIsRemoteControlActive(true);
        setIsRemoteControlInteractive(false);
        assistantActions.desktop
          .sendSystemEvent(
            activeCallAssistant.agentId,
            'assistant_screen_share_started',
            'User enabled assistant screen sharing'
          )
          .catch(console.error);
        toast.success('Assistant screen sharing started.', { id: toastId });
      } else {
        setIsRemoteControlActive(true);
        setLiveviewUrl(null);
        setIsRemoteControlInteractive(false);
        assistantActions.desktop
          .sendSystemEvent(
            activeCallAssistant.agentId,
            'assistant_screen_share_started',
            'User enabled assistant screen sharing'
          )
          .catch(console.error);
        toast.success('Assistant screen sharing started.', { id: toastId });
      }
    } catch (e: any) {
      console.error('[useAssistantCall] Toggle remote control failed:', e.message);
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
    isDesktopReady,
    scopedLiveviewLookup,
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
      // Only update the state if the webhook call was successful
      setIsRemoteControlInteractive(nextState);
      toast.info(nextState ? 'Interactive mode enabled.' : 'View-only mode enabled.');
    } catch (e: any) {
      console.error(
        `[useAssistantCall] Failed to toggle interactive mode to ${nextState}:`,
        e.message
      );
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

  // Helper function to redispatch assistant to the room
  const redispatchAssistant = React.useCallback(async () => {
    const assistant = activeCallAssistantRef.current;
    const details = connectionDetailsRef.current;
    if (!assistant || !details) return;
    if (redispatchPromiseRef.current) return redispatchPromiseRef.current;

    isRedispatchingRef.current = true;
    const generation = connectionAttemptIdRef.current;
    const displayName = assistantDisplayName(assistant);

    const redispatch = (async () => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (!isCurrentGeneration(generation)) return;

        try {
          const dispatchResult = await assistantActions.call.dispatchToCall(
            assistant.agentId,
            details.roomName,
            undefined,
            activeCallSessionIdRef.current ?? undefined
          );

          if (dispatchResult.detail) {
            throw new Error(dispatchResult.detail);
          }

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
        isRedispatchingRef.current = false;
      }
    }
  }, [assistantActions.call, isCurrentGeneration, setCallPhase]);

  // Expose ``redispatchAssistant`` to connect()'s initial-join recovery timer,
  // which is created before this callback in source order.
  React.useEffect(() => {
    redispatchAssistantRef.current = redispatchAssistant;
  }, [redispatchAssistant]);

  // Store refs to current state for event handlers to avoid stale closures
  const isConnectedRef = React.useRef(isConnected);
  const activeCallAssistantRef = React.useRef(activeCallAssistant);

  React.useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  React.useEffect(() => {
    activeCallAssistantRef.current = activeCallAssistant;
  }, [activeCallAssistant]);

  React.useEffect(() => {
    connectionDetailsRef.current = connectionDetails;
  }, [connectionDetails]);

  React.useEffect(() => {
    const READY_FALLBACK_TIMEOUT = 10_000;
    let readyFallbackTimer: NodeJS.Timeout | null = null;

    const clearReadyFallbackTimer = () => {
      if (readyFallbackTimer) {
        clearTimeout(readyFallbackTimer);
        readyFallbackTimer = null;
      }
    };

    const clearJoinState = () => {
      setIsWaitingForAssistant(false);
      setWaitingMessage(null);
      setConnectionError(null);
      isRedispatchingRef.current = false;
      redispatchPromiseRef.current = null;
      clearAssistantJoinTimeout();
      stopRinging();
    };

    const clearPreparingState = () => {
      setIsAssistantPreparing(false);
      clearReadyFallbackTimer();
    };

    const onDataReceived = (
      payload: Uint8Array,
      _participant?: any,
      _kind?: any,
      topic?: string
    ) => {
      if (topic !== 'agent_status') return;
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === 'ready_to_speak') {
          clearJoinState();
          clearPreparingState();
          setCallPhase('active');
          resolveAssistantReadyWaiter();
          return;
        }
        if (data.type === 'call_ended') {
          // The assistant ended the meet. Leave the room ourselves so our
          // WebRTC peer connection closes cleanly, instead of waiting to be
          // force-evicted by the imminent server-side room deletion (which logs
          // benign "Unknown DataChannel error" noise in the console). Routing
          // through disconnect() also suppresses the rejoin/redispatch logic.
          disconnectRef.current?.();
          return;
        }
      } catch {
        // ignore malformed data messages
      }
    };

    const onParticipantConnected = () => {
      clearJoinState();
      if (!expectsReadyToSpeakRef.current) {
        clearPreparingState();
        setCallPhase('active');
        return;
      }
      setIsAssistantPreparing(true);
      setCallPhase('preparing_assistant');
      clearReadyFallbackTimer();
      readyFallbackTimer = setTimeout(clearPreparingState, READY_FALLBACK_TIMEOUT);
    };

    const onParticipantDisconnected = () => {
      if (!isConnectedRef.current || !activeCallAssistantRef.current) return;

      if (room.remoteParticipants.size < 1) {
        clearAssistantJoinTimeout();
        if (sdkReconnectingRef.current) {
          setWaitingMessage('Reconnecting call audio...');
          setIsWaitingForAssistant(true);
          setIsAssistantPreparing(false);
          setCallPhase('recovering_assistant');
          return;
        }
        const displayName = assistantDisplayName(activeCallAssistantRef.current);
        setWaitingMessage(`${displayName} disconnected, waiting for them to rejoin...`);
        setIsWaitingForAssistant(true);
        setIsAssistantPreparing(false);
        setConnectionError(null);
        setCallPhase('recovering_assistant');
        clearReadyFallbackTimer();

        // Try to redispatch the assistant
        redispatchAssistant();

        // Set a timeout for the assistant to rejoin
        const generation = connectionAttemptIdRef.current;
        const timeoutDuration =
          (typeof window !== 'undefined' && (window as any)._TEST_ASSISTANT_REJOIN_TIMEOUT) ||
          ASSISTANT_REJOIN_TIMEOUT;

        assistantRejoinTimeoutRef.current = setTimeout(() => {
          if (!isCurrentGeneration(generation)) return;
          if (room.remoteParticipants.size < 1) {
            isRedispatchingRef.current = false;
            redispatchPromiseRef.current = null;
            toast.error(
              `${displayName} couldn't rejoin the call. Please try calling again if needed.`
            );
            setConnectionError(
              `${displayName} couldn't rejoin. You can retry without leaving the call.`
            );
            setIsWaitingForAssistant(false);
            setCallPhase('failed');
          }
        }, timeoutDuration);
      }
    };

    const onReconnecting = () => {
      if (!isConnectedRef.current) return;
      sdkReconnectingRef.current = true;
      setWaitingMessage('Reconnecting call audio...');
      setIsWaitingForAssistant(true);
      setIsAssistantPreparing(false);
      setCallPhase('recovering_assistant');
    };

    const onReconnected = () => {
      if (!isConnectedRef.current) return;
      sdkReconnectingRef.current = false;
      if (room.remoteParticipants.size < 1) {
        redispatchAssistant();
        return;
      }
      clearJoinState();
      clearPreparingState();
      setCallPhase('active');
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      clearReadyFallbackTimer();
      clearAssistantJoinTimeout();
    };
  }, [
    room,
    onDisconnected,
    clearAssistantJoinTimeout,
    redispatchAssistant,
    assistantActions.call,
    isCurrentGeneration,
    setCallPhase,
    stopRinging,
    resolveAssistantReadyWaiter,
  ]);

  // Ensure proper cleanup on component unmount
  React.useEffect(() => {
    return () => {
      if (room.state !== 'disconnected') {
        room.disconnect();
      }
    };
  }, [room]);

  return {
    room,
    connectionDetails,
    error,
    isConnected,
    isConnecting,
    callPhase,
    activeCallAssistant,
    callType,
    isSpeakerMuted,
    toggleSpeakerMute,
    connect,
    disconnect,
    isWaitingForAssistant,
    isAssistantPreparing,
    activeOpeningConfig,
    waitingMessage,
    connectionError,
    retryConnection,
    // Remote control exports
    isDesktopReady,
    isRemoteControlActive,
    liveviewUrl,
    isRemoteControlLoading,
    toggleRemoteControl,
    isRemoteControlInteractive,
    isRemoteControlInteractiveLoading,
    toggleRemoteControlInteractive,
    avatarMood,
  };
}
