'use client';

import * as React from 'react';
import { LogLevel, Room, setLogLevel } from 'livekit-client';
import { RoomContext } from '@livekit/components-react';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { useCall } from '@/hooks/Assistants/useCall';
import { useOrgCallEvents } from '@/hooks/Assistants/useOrgCallEvents';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useIsCoordinatorIntroAudioPlaying } from './AssistantCommunicationDialog';
import { VoiceEnrollmentFallbackDialog } from './VoiceEnrollmentFallbackDialog';
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
import { OrgCallMeetStage } from '@/components/Pages/Assistants/OrgChat/OrgCallMeetStage';
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
 * here app-wide; assistant_dm chrome docks into the /assistants page.
 */
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

  // --- Multi-party stage presentation ---
  const [viewMode, setViewMode] = React.useState<CallViewMode>('expanded');
  const expand = React.useCallback(() => setViewMode('expanded'), []);
  const minimize = React.useCallback(() => setViewMode('minimized'), []);
  const activeCallId = call.activeCall?.callId ?? null;
  React.useEffect(() => {
    if (activeCallId) setViewMode('expanded');
  }, [activeCallId]);

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
  // chrome (docked dialog, floating window) renders from the /assistants
  // page against the same engine, so it is suppressed here.
  const incomingCall = call.incomingCall;
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
                onToggleMic={() => void call.toggleMic()}
                onToggleCam={() => void call.toggleCam()}
                onToggleScreenShare={() => void call.toggleScreenShare()}
                onMinimize={minimize}
                onLeave={() => void call.leaveCall()}
                onEnd={() => void call.endCall()}
                onAddAssistant={(assistantId) => void call.addAssistant(assistantId)}
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
