'use client';

import * as React from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { useCallContext } from '@/components/Pages/Assistants/Communication/CallProvider';
import { useOrgCall, OrgCallEngine } from '@/hooks/Assistants/useOrgCall';
import { useOrgCallEvents } from '@/hooks/Assistants/useOrgCallEvents';
import {
  OrgCallSession,
  OrgRoster,
  parseOrgCallSession,
  parseOrgRoster,
  withOrgNameForManagedTeams,
  withOrgProfileImageForTeams,
} from '@/types/orgChat';
import { IncomingHumanCallCard } from './IncomingHumanCallCard';
import { OrgCallMeetStage } from './OrgCallMeetStage';
import { OrgCallMinimized } from './OrgCallMinimized';
import { OrgCallErrorBoundary } from './OrgCallErrorBoundary';
import type { OrgCallAssistantInfo, OrgCallHumanInfo } from './OrgCallTiles';

const ORG_CALL_ACTIVE_STORAGE_KEY = 'console:org-call-active';

export type OrgCallViewMode = 'expanded' | 'minimized';

export interface OrgCallContextValue extends OrgCallEngine {
  viewMode: OrgCallViewMode;
  expand: () => void;
  minimize: () => void;
  /** A live call (from a previous page load) the user can rejoin. */
  resumableCall: OrgCallSession | null;
  dismissResumableCall: () => void;
}

const OrgCallContext = React.createContext<OrgCallContextValue | null>(null);

export function useOrgCallContext(): OrgCallContextValue {
  const context = React.useContext(OrgCallContext);
  if (!context) {
    throw new Error('useOrgCallContext must be used within OrgCallProvider');
  }
  return context;
}

/**
 * App-level engine for multi-party org calls (DM/team/group). Lives in the
 * authenticated layout — beside the 1:1 assistant CallProvider — so the
 * LiveKit session, ringing UI, and the minimized widget survive navigation
 * across every page. Pages consume the engine through `useOrgCallContext`.
 */
export function OrgCallProvider({ children }: { children: React.ReactNode }) {
  const { user, activeWorkspace, currentUserId } = useWorkspace();
  const { activeCallAssistant } = useCallContext();
  const orgId = activeWorkspace?.type === 'organization' ? activeWorkspace.id : null;

  const engine = useOrgCall({
    orgId,
    currentUserId,
    assistantCallActive: !!activeCallAssistant,
  });

  const [viewMode, setViewMode] = React.useState<OrgCallViewMode>('expanded');
  const [resumableCall, setResumableCall] = React.useState<OrgCallSession | null>(null);
  const [roster, setRoster] = React.useState<OrgRoster | null>(null);

  useOrgCallEvents(orgId, {
    onIncoming: engine.handleIncomingCall,
    onAnswered: engine.handleCallAnswered,
    onEnded: engine.handleRemoteEnded,
    onParticipantUpdate: engine.handleParticipantUpdate,
  });

  // Calls started on this page load open expanded, Meet style.
  const activeCallId = engine.activeCall?.callId ?? null;
  React.useEffect(() => {
    if (activeCallId) setViewMode('expanded');
  }, [activeCallId]);

  React.useEffect(() => {
    sessionStorage.setItem(
      ORG_CALL_ACTIVE_STORAGE_KEY,
      engine.isConnected && engine.activeCall ? '1' : '0'
    );
  }, [engine.isConnected, engine.activeCall]);

  // Names and faces for tiles: fetched lazily the first time call UI needs
  // them (per org), instead of polling the roster app-wide.
  const needsRoster = Boolean(engine.activeCall || engine.incomingCall || resumableCall);
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
        // Tiles degrade to placeholder names; next call attempt refetches.
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

  // Rejoin after reload: a live call that still lists us can be re-attached.
  React.useEffect(() => {
    if (!orgId || !currentUserId) {
      setResumableCall(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/organizations/${orgId}/calls/active`);
        if (!response.ok) return;
        const data = await response.json();
        const sessions: OrgCallSession[] = Array.isArray(data?.calls)
          ? data.calls.map((c: Record<string, unknown>) => parseOrgCallSession(c))
          : [];
        const mine = sessions.find((call) =>
          call.participants.some((p) => p.userId === currentUserId && p.status === 'joined')
        );
        if (!cancelled && mine) setResumableCall(mine);
      } catch {
        // No resumable-call banner; the next incoming frame still rings.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, currentUserId]);

  // Once connected (or the call ended remotely), the resume banner is moot.
  React.useEffect(() => {
    if (engine.isConnected) setResumableCall(null);
  }, [engine.isConnected]);

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
    const call = engine.activeCall;
    if (!call) return [];
    const memberIds =
      call.scope === 'team' && call.teamId != null
        ? (rosterTeams.find((t) => t.teamId === call.teamId)?.assistantMemberIds ?? [])
        : call.scope === 'group' && call.groupId != null
          ? (roster?.groups.find((g) => g.groupId === call.groupId)?.assistantMemberIds ?? [])
          : [];
    return memberIds
      .filter((id) => !call.assistantIds.includes(id))
      .map((id) => assistantsById[String(id)])
      .filter(Boolean);
  }, [engine.activeCall, rosterTeams, roster?.groups, assistantsById]);

  const localName =
    (currentUserId && humansById[currentUserId]?.name) || user?.name || user?.email || 'You';
  const localImage = (currentUserId && humansById[currentUserId]?.image) || user?.image || null;

  const expand = React.useCallback(() => setViewMode('expanded'), []);
  const minimize = React.useCallback(() => setViewMode('minimized'), []);
  const dismissResumableCall = React.useCallback(() => setResumableCall(null), []);

  const value = React.useMemo<OrgCallContextValue>(
    () => ({
      ...engine,
      viewMode,
      expand,
      minimize,
      resumableCall,
      dismissResumableCall,
    }),
    [engine, viewMode, expand, minimize, resumableCall, dismissResumableCall]
  );

  const incomingCall = engine.incomingCall;
  const incomingName = incomingCall
    ? incomingCall.scope === 'team'
      ? rosterTeams.find((t) => t.teamId === incomingCall.teamId)?.name?.trim() || 'Team call'
      : incomingCall.scope === 'group'
        ? roster?.groups.find((g) => g.groupId === incomingCall.groupId)?.name?.trim() ||
          'Group call'
        : humansById[incomingCall.callerUserId]?.name?.trim() || 'Teammate'
    : '';

  return (
    <OrgCallContext.Provider value={value}>
      {children}
      {incomingCall && !activeCallAssistant && (
        <IncomingHumanCallCard
          callerName={incomingName}
          subtitle={
            incomingCall.scope === 'team'
              ? 'Team call ringing…'
              : incomingCall.scope === 'group'
                ? 'Group call ringing…'
                : 'is calling you…'
          }
          onAnswer={() => void engine.answerCall(incomingCall)}
          onDecline={() => void engine.declineCall(incomingCall)}
        />
      )}
      {resumableCall && !engine.activeCall && !incomingCall && (
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
              onClick={() => void engine.joinCall(resumableCall)}
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
      {engine.isConnected && engine.activeCall && (
        <OrgCallErrorBoundary onLeave={() => void engine.leaveCall()}>
          {viewMode === 'expanded' ? (
            <OrgCallMeetStage
              call={engine.activeCall}
              room={engine.room}
              roomEpoch={engine.roomEpoch}
              currentUserId={currentUserId}
              humansById={humansById}
              assistantsById={assistantsById}
              localName={localName}
              localImage={localImage}
              micEnabled={engine.micEnabled}
              camEnabled={engine.camEnabled}
              screenShareEnabled={engine.screenShareEnabled}
              isHost={engine.isHost}
              addableAssistants={addableAssistants}
              onToggleMic={() => void engine.toggleMic()}
              onToggleCam={() => void engine.toggleCam()}
              onToggleScreenShare={() => void engine.toggleScreenShare()}
              onMinimize={minimize}
              onLeave={() => void engine.leaveCall()}
              onEnd={() => void engine.endCall()}
              onAddAssistant={(assistantId) => void engine.addAssistant(assistantId)}
            />
          ) : (
            <OrgCallMinimized
              call={engine.activeCall}
              room={engine.room}
              roomEpoch={engine.roomEpoch}
              currentUserId={currentUserId}
              humansById={humansById}
              assistantsById={assistantsById}
              localName={localName}
              localImage={localImage}
              micEnabled={engine.micEnabled}
              camEnabled={engine.camEnabled}
              onToggleMic={() => void engine.toggleMic()}
              onToggleCam={() => void engine.toggleCam()}
              onExpand={expand}
              onLeave={() => void engine.leaveCall()}
            />
          )}
        </OrgCallErrorBoundary>
      )}
    </OrgCallContext.Provider>
  );
}
