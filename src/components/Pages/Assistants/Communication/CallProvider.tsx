'use client';

import * as React from 'react';
import { LogLevel, Room, setLogLevel } from 'livekit-client';
import { RoomContext } from '@livekit/components-react';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { useCall } from '@/hooks/Assistants/useCall';
import { useAssistantLiveview } from '@/hooks/Assistants/useAssistantLiveview';
import { resolveManagedDesktopMode } from '@/utils/assistants/managed-desktop';
import { useOrgCallEvents } from '@/hooks/Assistants/useOrgCallEvents';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import {
  AssistantCommunicationDialog,
  useIsCoordinatorIntroAudioPlaying,
} from './AssistantCommunicationDialog';
import { AssistantLiveKitAudioRenderer } from './AssistantLiveKitAudioRenderer';
import { VoiceEnrollmentFallbackDialog } from './VoiceEnrollmentFallbackDialog';
import { useAppShellNavigation, useShellActivePath } from '@/lib/navigation/AppShellRouter';
import { useConsoleActionScript } from '@/hooks/Assistants/useConsoleActionScript';
import { flashElement } from '@/lib/agent-guidance/flashElement';
import { isAssistantsPath } from '@/lib/navigation/appShellRoutes';
import { useVoiceEnrollmentFallbackPrompt } from '@/hooks/Assistants/useVoiceEnrollmentFallbackPrompt';
import {
  OrgCallSession,
  OrgRoster,
  parseOrgCallSession,
  parseOrgRoster,
  withOrgNameForManagedTeams,
  withOrgProfileImageForTeams,
} from '@/types/orgChat';
import { IncomingHumanCallCard } from '@/components/Pages/Assistants/OrgChat/IncomingHumanCallCard';
import {
  OrgCallMeetStage,
  type AssistantDesktopToggle,
} from '@/components/Pages/Assistants/OrgChat/OrgCallMeetStage';
import { OrgCallMinimized } from '@/components/Pages/Assistants/OrgChat/OrgCallMinimized';
import { OrgCallErrorBoundary } from '@/components/Pages/Assistants/OrgChat/OrgCallErrorBoundary';
import type {
  OrgCallAssistantInfo,
  OrgCallHumanInfo,
} from '@/components/Pages/Assistants/OrgChat/OrgCallTiles';
import type { AssistantActions } from '@/types/assistants/assistant';

const CALL_ACTIVE_STORAGE_KEY = 'console:call-active';

/**
 * The action subset the call engine needs: desktop drives in-call remote
 * control, chat is used by the in-call chat panel, and assistant.update is
 * kept for parity with the page-level action bag.
 */
export type CallProviderActions = Pick<AssistantActions, 'desktop' | 'chat'> & {
  assistant: Pick<AssistantActions['assistant'], 'update'>;
  /** Live action events, so the call avatar can adopt its "working" pose while
   *  an `act` is in flight (the same stream the Actions pane consumes). */
  actions: NonNullable<AssistantActions['actions']>;
};

interface CallUserMeta {
  email: string | null | undefined;
  image: string | null | undefined;
  voiceSample?: string | null;
}

type CallEngine = ReturnType<typeof useCall>;

export type CallViewMode = 'expanded' | 'minimized';

export interface CallContextValue extends CallEngine {
  /** Whether an active assistant call should dock into the /assistants chat
   *  slot (true) or float as a standalone window (false). */
  isDocked: boolean;
  popOut: () => void;
  redock: () => void;
  /** Multi-party stage presentation (expanded overlay vs minimized widget). */
  viewMode: CallViewMode;
  expand: () => void;
  minimize: () => void;
  /** A live call (from a previous page load) the user can rejoin. */
  resumableCall: OrgCallSession | null;
  dismissResumableCall: () => void;
}

const CallContext = React.createContext<CallContextValue | null>(null);

export function useCallContext(): CallContextValue {
  const ctx = React.useContext(CallContext);
  if (!ctx) throw new Error('useCallContext must be used within a CallProvider');
  return ctx;
}

/**
 * Owns the single LiveKit Room and the unified call engine for the whole
 * (home) layout: every call — human DM, team, group, or 1:1 assistant — runs
 * through one engine and survives client-side navigation. Multi-party call
 * chrome (ring card, Meet stage, minimized widget, rejoin banner) renders
 * here app-wide. assistant_dm chrome docks into the /assistants page while
 * that route is active, and falls back to the floating window here off it.
 */
/**
 * Resolves one shared assistant desktop to a URL for this viewer.
 *
 * A component per desktop rather than a loop: each needs its own
 * `useAssistantLiveview`, and every participant resolves independently — the
 * URL is not passed around from whoever started the share.
 */
function SharedDesktopResolver({
  assistant,
  callActions,
  onResolved,
}: {
  assistant: OrgCallAssistantInfo;
  callActions: CallProviderActions;
  onResolved: (assistantId: string, url: string | null) => void;
}) {
  const { liveviewUrl } = useAssistantLiveview(assistant, callActions, true);
  const agentId = assistant.agentId;
  React.useEffect(() => {
    onResolved(agentId, liveviewUrl);
    return () => onResolved(agentId, null);
  }, [agentId, liveviewUrl, onResolved]);
  return null;
}

export function CallProvider({
  callActions,
  userMeta,
  children,
}: {
  callActions: CallProviderActions;
  userMeta: CallUserMeta;
  children: React.ReactNode;
}) {
  const room = React.useMemo(() => {
    setLogLevel(LogLevel.warn);
    return new Room();
  }, []);

  const { user, activeWorkspace, currentUserId } = useWorkspace();
  const orgId = activeWorkspace?.type === 'organization' ? activeWorkspace.id : null;

  const call = useCall(room, callActions, { orgId, currentUserId });

  // --- Assistant-call dock state ---
  const [isDocked, setIsDocked] = React.useState(true);
  const popOut = React.useCallback(() => setIsDocked(false), []);
  const redock = React.useCallback(() => setIsDocked(true), []);
  const { isConnecting, isConnected, connectionError } = call;
  React.useEffect(() => {
    if (connectionError) return;
    if (!isConnecting && !isConnected && !isDocked) {
      setIsDocked(true);
    }
  }, [isConnecting, isConnected, connectionError, isDocked]);

  // --- Cross-page assistant call surface ---
  // The /assistants page owns the docked and popped-out surfaces, but it can
  // only render them while that route is active. Off /assistants the call
  // window lives here instead, so a 1:1 call stays visible (and audible)
  // wherever the user navigates.
  const shellActivePath = useShellActivePath();
  const { navigateToAssistants } = useAppShellNavigation();
  const handleFloatingRedock = React.useCallback(() => {
    redock();
    navigateToAssistants();
  }, [redock, navigateToAssistants]);

  // --- Multi-party stage presentation ---
  const [viewMode, setViewMode] = React.useState<CallViewMode>('expanded');
  const expand = React.useCallback(() => setViewMode('expanded'), []);
  const minimize = React.useCallback(() => setViewMode('minimized'), []);
  const activeCallId = call.activeCall?.callId ?? null;
  React.useEffect(() => {
    if (activeCallId) setViewMode('expanded');
  }, [activeCallId]);

  // --- Assistant-driven navigation ---
  // The call window covers most of the console when expanded, so a move made
  // behind it would be narrated and never seen. Shrinking first is part of the
  // move, not a nicety.
  const consoleNav = useAppShellNavigation();
  const revealConsole = React.useCallback(() => {
    minimize();
    if (isDocked) popOut();
  }, [minimize, isDocked, popOut]);

  useConsoleActionScript({
    room,
    nav: consoleNav,
    assistantId: call.activeCallAssistant?.agentId ?? null,
    revealConsole,
    highlight: flashElement,
    enabled: Boolean(activeCallId),
  });

  // --- Org call signaling stream (dm/team/group scopes) ---
  useOrgCallEvents(orgId, {
    onIncoming: call.handleIncomingCall,
    onAnswered: call.handleCallAnswered,
    onEnded: call.handleRemoteEnded,
    onParticipantUpdate: call.handleParticipantUpdate,
  });

  // --- Call lifecycle flag (SPA navigation persistence, e2e) ---
  React.useEffect(() => {
    sessionStorage.setItem(CALL_ACTIVE_STORAGE_KEY, isConnecting || isConnected ? '1' : '0');
  }, [isConnecting, isConnected]);

  // --- Coordinator intro: hold LiveKit playback while the recorded intro plays ---
  const isCoordinatorIntroAudioPlaying = useIsCoordinatorIntroAudioPlaying();
  React.useEffect(() => {
    call.setPlaybackHold(isCoordinatorIntroAudioPlaying);
  }, [call, isCoordinatorIntroAudioPlaying]);

  // --- Voice enrollment fallback ---
  const { activeCallAssistant } = call;
  const callLifecycleActive = isConnecting || isConnected;
  const voiceEnrollmentFallback = useVoiceEnrollmentFallbackPrompt({
    assistantId: activeCallAssistant?.agentId ?? null,
    callLifecycleActive,
    hasVoiceSample: !!userMeta.voiceSample,
  });

  // --- Roster (names + faces) for multi-party tiles, fetched lazily ---
  const [roster, setRoster] = React.useState<OrgRoster | null>(null);
  const [resumableCall, setResumableCall] = React.useState<OrgCallSession | null>(null);
  const needsRoster = Boolean(call.activeCall || call.incomingCall || resumableCall);
  const rosterOrgIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!orgId || !needsRoster || rosterOrgIdRef.current === orgId) return;
    rosterOrgIdRef.current = orgId;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/organizations/${orgId}/roster`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setRoster(parseOrgRoster(data));
      } catch {
        rosterOrgIdRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, needsRoster]);
  React.useEffect(() => {
    if (rosterOrgIdRef.current && rosterOrgIdRef.current !== orgId) {
      rosterOrgIdRef.current = null;
      setRoster(null);
    }
  }, [orgId]);

  // --- Rejoin after reload ---
  React.useEffect(() => {
    if (!currentUserId) {
      setResumableCall(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/calls/active');
        if (!response.ok) return;
        const data = await response.json();
        const sessions: OrgCallSession[] = Array.isArray(data?.calls)
          ? data.calls.map((c: Record<string, unknown>) => parseOrgCallSession(c))
          : [];
        const mine = sessions.find(
          (session) =>
            session.scope !== 'assistant_dm' &&
            session.participants.some((p) => p.userId === currentUserId && p.status === 'joined')
        );
        if (!cancelled && mine) setResumableCall(mine);
      } catch {
        // No resumable-call banner; the next incoming frame still rings.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);
  React.useEffect(() => {
    if (call.isConnected) setResumableCall(null);
  }, [call.isConnected]);
  const dismissResumableCall = React.useCallback(() => {
    // Dismissing means "I'm not coming back": leave the session server-side,
    // otherwise the stale joined participant re-surfaces this banner on
    // every reload (and, as the last joined human, keeps a zombie session
    // alive forever).
    const callId = resumableCall?.callId;
    setResumableCall(null);
    if (callId) {
      fetch(`/api/calls/${encodeURIComponent(callId)}/leave`, { method: 'POST' }).catch(() => {});
    }
  }, [resumableCall?.callId]);

  const humansById = React.useMemo<Record<string, OrgCallHumanInfo>>(() => {
    const byId: Record<string, OrgCallHumanInfo> = {};
    for (const human of roster?.humans ?? []) {
      byId[human.userId] = { userId: human.userId, name: human.name, image: human.image };
    }
    return byId;
  }, [roster]);

  const assistantsById = React.useMemo<Record<string, OrgCallAssistantInfo>>(() => {
    const byId: Record<string, OrgCallAssistantInfo> = {};
    for (const assistant of roster?.assistants ?? []) {
      byId[String(assistant.assistantId)] = {
        agentId: String(assistant.assistantId),
        name: assistant.name,
        image: assistant.image,
        ownerUserId: assistant.ownerUserId,
        organizationId: assistant.organizationId,
        desktopMode: assistant.desktopMode,
        managedDesktopStatus: assistant.managedDesktopStatus,
      };
    }
    return byId;
  }, [roster]);

  const rosterTeams = React.useMemo(
    () =>
      withOrgNameForManagedTeams(
        withOrgProfileImageForTeams(
          roster?.teams ?? [],
          activeWorkspace?.type === 'organization' ? activeWorkspace.image : null
        ),
        activeWorkspace?.type === 'organization' ? activeWorkspace.name : null
      ),
    [activeWorkspace, roster?.teams]
  );

  const addableAssistants = React.useMemo<OrgCallAssistantInfo[]>(() => {
    const active = call.activeCall;
    if (!active) return [];
    const memberIds =
      active.scope === 'team' && active.teamId != null
        ? (rosterTeams.find((t) => t.teamId === active.teamId)?.assistantMemberIds ?? [])
        : active.scope === 'group' && active.groupId != null
          ? (roster?.groups.find((g) => g.groupId === active.groupId)?.assistantMemberIds ?? [])
          : [];
    return memberIds
      .filter((id) => !active.assistantIds.includes(id))
      .map((id) => assistantsById[String(id)])
      .filter(Boolean);
  }, [call.activeCall, rosterTeams, roster?.groups, assistantsById]);

  // Every teammate on the call, with whether its desktop is on the stage and
  // whether it has one to show.
  //
  // Open to everyone on the call, not just the host. A desktop on the stage is
  // shared room state — one switch the runtime keys to the call rather than to
  // whoever pressed it — so anybody here can put one up and anybody here can
  // take it down again, including one somebody else put up. Host-only was the
  // shape that left a share unstoppable the moment the host walked out.
  //
  // Teammates without a managed desktop stay in the list and render disabled.
  // Dropping them silently made the roster disagree with the tiles above it, and
  // "that name is missing" is a worse answer than "that one has no desktop".
  const desktopToggles = React.useMemo<AssistantDesktopToggle[]>(() => {
    const active = call.activeCall;
    if (!active) return [];
    return active.assistantIds
      .map((id) => assistantsById[String(id)])
      .filter(Boolean)
      .map((assistant) => ({
        assistant,
        sharing: Boolean(call.assistantSharesById[assistant.agentId]),
        available: resolveManagedDesktopMode(assistant) != null,
      }));
  }, [call.activeCall, call.assistantSharesById, assistantsById]);

  // Assistants presenting a desktop, and the URL each resolved to here.
  const sharedAssistants = React.useMemo(
    () =>
      Object.keys(call.assistantSharesById)
        .map((agentId) => assistantsById[agentId])
        .filter(Boolean),
    [call.assistantSharesById, assistantsById]
  );
  const [liveviewUrls, setLiveviewUrls] = React.useState<Record<string, string | null>>({});
  const handleLiveviewResolved = React.useCallback((agentId: string, url: string | null) => {
    setLiveviewUrls((prev) => (prev[agentId] === url ? prev : { ...prev, [agentId]: url }));
  }, []);
  const liveviewShares = React.useMemo(
    () =>
      sharedAssistants
        .map((assistant) => ({
          assistantId: assistant.agentId,
          presenterName: assistant.name,
          url: liveviewUrls[assistant.agentId] ?? '',
        }))
        // Nothing to put on the stage until it resolves — a tile with no source
        // reads as a broken share rather than one still coming up.
        .filter((share) => Boolean(share.url)),
    [sharedAssistants, liveviewUrls]
  );

  const localName =
    (currentUserId && humansById[currentUserId]?.name) || user?.name || user?.email || 'You';
  const localImage = (currentUserId && humansById[currentUserId]?.image) || user?.image || null;

  const value = React.useMemo<CallContextValue>(
    () => ({
      ...call,
      isDocked,
      popOut,
      redock,
      viewMode,
      expand,
      minimize,
      resumableCall,
      dismissResumableCall,
    }),
    [
      call,
      isDocked,
      popOut,
      redock,
      viewMode,
      expand,
      minimize,
      resumableCall,
      dismissResumableCall,
    ]
  );

  // Multi-party chrome renders app-wide from the provider. Assistant 1:1
  // chrome docks into the /assistants page against the same engine, so it is
  // suppressed here while that route is active.
  const incomingCall = call.incomingCall;
  const hasActiveAssistantCall = !!activeCallAssistant && callLifecycleActive;
  const showFloatingAssistantCall = hasActiveAssistantCall && !isAssistantsPath(shellActivePath);
  const showOrgIncoming = incomingCall && incomingCall.scope !== 'assistant_dm';
  const activeOrgCall =
    call.isConnected && call.activeCall && call.activeCall.scope !== 'assistant_dm'
      ? call.activeCall
      : null;
  const incomingName = showOrgIncoming
    ? incomingCall.scope === 'team'
      ? rosterTeams.find((t) => t.teamId === incomingCall.teamId)?.name?.trim() || 'Team call'
      : incomingCall.scope === 'group'
        ? roster?.groups.find((g) => g.groupId === incomingCall.groupId)?.name?.trim() ||
          'Group call'
        : humansById[incomingCall.callerUserId]?.name?.trim() || 'Teammate'
    : '';

  return (
    <CallContext.Provider value={value}>
      {children}
      <VoiceEnrollmentFallbackDialog
        open={voiceEnrollmentFallback.open}
        onOpenChange={voiceEnrollmentFallback.onOpenChange}
        onEnrolled={voiceEnrollmentFallback.onEnrolled}
      />
      {hasActiveAssistantCall && activeCallAssistant && (
        <RoomContext.Provider value={room}>
          {/* Single, persistent audio sink for the call. Living here (rather
           *  than inside whichever dialog instance is mounted) keeps audio
           *  continuous as the visible surface swaps during navigation. */}
          {!isCoordinatorIntroAudioPlaying && <AssistantLiveKitAudioRenderer />}
          {showFloatingAssistantCall && (
            <AssistantCommunicationDialog
              isOpen
              defaultFloating
              chatDisabled
              onClose={call.disconnect}
              onRedock={handleFloatingRedock}
              assistant={activeCallAssistant}
              assistantActions={callActions}
              room={room}
              chatHistories={{}}
              setChatHistories={() => {}}
              isConnecting={call.isConnecting}
              userEmail={userMeta.email}
              userImage={userMeta.image}
              isWaitingForAssistant={call.isWaitingForAssistant}
              isAssistantPreparing={call.isAssistantPreparing}
              activeOpeningConfig={call.activeOpeningConfig}
              waitingMessage={call.waitingMessage}
              isCallConnected={call.isConnected}
              connectionError={call.connectionError}
              onRetry={call.retryConnection}
              isRemoteControlActive={call.isRemoteControlActive}
              liveviewUrl={call.liveviewUrl}
              isRemoteControlLoading={call.isRemoteControlLoading}
              toggleRemoteControl={call.toggleRemoteControl}
              isRemoteControlInteractive={call.isRemoteControlInteractive}
              isRemoteControlInteractiveLoading={call.isRemoteControlInteractiveLoading}
              toggleRemoteControlInteractive={call.toggleRemoteControlInteractive}
              isDesktopEnabled={call.isDesktopEnabled}
              isDesktopReady={call.isDesktopReady}
              callType={call.callType}
              isSpeakerMuted={call.isSpeakerMuted}
              onToggleSpeaker={call.toggleSpeakerMute}
              avatarMood={call.avatarMood}
              chatStreamConnectionStatus="connected"
              reconnectChatStream={() => {}}
              chatStreamActivitySignal={0}
            />
          )}
        </RoomContext.Provider>
      )}
      {showOrgIncoming && (
        <IncomingHumanCallCard
          callerName={incomingName}
          subtitle={
            incomingCall.scope === 'team'
              ? 'Team call ringing…'
              : incomingCall.scope === 'group'
                ? 'Group call ringing…'
                : 'is calling you…'
          }
          onAnswer={() => void call.answerCall(incomingCall)}
          onDecline={() => void call.declineCall(incomingCall)}
        />
      )}
      {resumableCall && !call.activeCall && !incomingCall && (
        <div
          role="dialog"
          aria-label="Return to call"
          data-testid="org-call-resume-card"
          className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border bg-background p-4 shadow-lg"
        >
          <p className="text-body text-foreground">A call you joined is still running.</p>
          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1"
              onClick={() => void call.joinCall(resumableCall)}
              data-testid="org-call-resume-join"
            >
              <Phone className="mr-2 h-4 w-4" />
              Rejoin
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={dismissResumableCall}
              data-testid="org-call-resume-dismiss"
            >
              <PhoneOff className="mr-2 h-4 w-4" />
              Dismiss
            </Button>
          </div>
        </div>
      )}
      {sharedAssistants.map((assistant) => (
        <SharedDesktopResolver
          key={assistant.agentId}
          assistant={assistant}
          callActions={callActions}
          onResolved={handleLiveviewResolved}
        />
      ))}
      {activeOrgCall && (
        <RoomContext.Provider value={room}>
          <OrgCallErrorBoundary onLeave={() => void call.leaveCall()}>
            {viewMode === 'expanded' ? (
              <OrgCallMeetStage
                call={activeOrgCall}
                room={call.room.state === 'connected' ? call.room : null}
                roomEpoch={call.roomEpoch}
                currentUserId={currentUserId}
                humansById={humansById}
                assistantsById={assistantsById}
                localName={localName}
                localImage={localImage}
                micEnabled={call.micEnabled}
                camEnabled={call.camEnabled}
                screenShareEnabled={call.screenShareEnabled}
                isHost={call.isHost}
                addableAssistants={addableAssistants}
                liveviewShares={liveviewShares}
                desktopToggles={desktopToggles}
                onToggleMic={() => void call.toggleMic()}
                onToggleCam={() => void call.toggleCam()}
                onToggleScreenShare={() => void call.toggleScreenShare()}
                onMinimize={minimize}
                onLeave={() => void call.leaveCall()}
                onEnd={() => void call.endCall()}
                onAddAssistant={(assistantId) => void call.addAssistant(assistantId)}
                onToggleAssistantDesktop={call.setAssistantDesktopShared}
              />
            ) : (
              <OrgCallMinimized
                call={activeOrgCall}
                room={call.room.state === 'connected' ? call.room : null}
                roomEpoch={call.roomEpoch}
                currentUserId={currentUserId}
                humansById={humansById}
                assistantsById={assistantsById}
                localName={localName}
                localImage={localImage}
                micEnabled={call.micEnabled}
                camEnabled={call.camEnabled}
                onToggleMic={() => void call.toggleMic()}
                onToggleCam={() => void call.toggleCam()}
                onExpand={expand}
                onLeave={() => void call.leaveCall()}
              />
            )}
          </OrgCallErrorBoundary>
        </RoomContext.Provider>
      )}
    </CallContext.Provider>
  );
}
