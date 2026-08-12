/**
 * Render tests for the multi-party Meet grid against a mock LiveKit Room.
 *
 * The critical regression covered here: a participant can be `joined` in the
 * Orchestra call session before their LiveKit connection exists (answer API
 * raced ahead of the room connect). Tiles must render the avatar fallback in
 * that window instead of calling participant-context hooks with `undefined`,
 * which throws and used to blank the whole Assistants page. The dev-calls e2e
 * suite never exercises this because it runs without a real Room.
 */
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MeetGrid } from '@/components/Pages/Assistants/OrgChat/OrgCallMeetStage';
import { OrgCallErrorBoundary } from '@/components/Pages/Assistants/OrgChat/OrgCallErrorBoundary';
import { RoomContext } from '@livekit/components-react';
import type { OrgCallSession } from '@/types/orgChat';

class FakeParticipant {
  identity: string;
  name: string;
  isLocal = false;
  attributes: Record<string, string>;
  audioTrackPublications = new Map();
  videoTrackPublications = new Map();
  trackPublications = new Map();
  isSpeaking = false;

  constructor(identity: string, name: string, attributes: Record<string, string> = {}) {
    this.identity = identity;
    this.name = name;
    this.attributes = attributes;
  }

  on() {
    return this;
  }
  off() {
    return this;
  }
  addListener() {
    return this;
  }
  removeListener() {
    return this;
  }
  getTrackPublications() {
    return [];
  }
}

class FakeRoom {
  state = 'connected';
  remoteParticipants = new Map<string, FakeParticipant>();
  localParticipant: FakeParticipant;

  constructor(remotes: FakeParticipant[] = []) {
    this.localParticipant = new FakeParticipant('user-me-abc', 'Me');
    this.localParticipant.isLocal = true;
    for (const p of remotes) {
      this.remoteParticipants.set(p.identity, p);
    }
  }

  on() {
    return this;
  }
  off() {
    return this;
  }
  addListener() {
    return this;
  }
  removeListener() {
    return this;
  }
}

function makeCall(overrides: Partial<OrgCallSession> = {}): OrgCallSession {
  return {
    callId: 'call-1',
    roomName: 'org_call_room',
    status: 'active',
    scope: 'team',
    createdByUserId: 'me',
    callerUserId: 'me',
    calleeUserId: null,
    teamId: 7,
    groupId: null,
    organizationId: 1,
    createdByAssistantId: null,
    threadId: null,
    userIds: ['me', 'peer'],
    assistantIds: [],
    participants: [
      { userId: 'me', role: 'host', status: 'joined' },
      { userId: 'peer', role: 'member', status: 'joined' },
    ],
    roster: [],
    ...overrides,
  } as OrgCallSession;
}

function renderGrid(room: FakeRoom | null, call: OrgCallSession, assistantsById = {}) {
  const grid = (
    <MeetGrid
      call={call}
      room={room as never}
      roomEpoch={0}
      currentUserId="me"
      humansById={{
        me: { userId: 'me', name: 'Me', image: null },
        peer: { userId: 'peer', name: 'Peer Person', image: null },
      }}
      assistantsById={assistantsById}
      localName="Me"
      localImage={null}
    />
  );
  if (!room) return render(grid);
  return render(<RoomContext.Provider value={room as never}>{grid}</RoomContext.Provider>);
}

describe('MeetGrid with a live room', () => {
  it('renders an avatar tile for a joined peer that has no LiveKit participant yet', () => {
    // Peer answered the call (Orchestra says joined) but their LiveKit
    // connection has not landed: remoteParticipants is empty.
    const room = new FakeRoom([]);
    renderGrid(room, makeCall());

    const tiles = screen.getAllByTestId('org-call-human-tile');
    expect(tiles).toHaveLength(2);
    expect(screen.getByText('Peer Person')).toBeDefined();
  });

  it('renders the connected tile once the peer exists in the room', () => {
    const room = new FakeRoom([new FakeParticipant('user-peer-x1y2', 'Peer Person')]);
    renderGrid(room, makeCall());

    expect(screen.getAllByTestId('org-call-human-tile')).toHaveLength(2);
  });

  it('stops ringing once the peer is in the room, even if the session is stale', () => {
    // The regression: the peer answered, the `call_answered` frame never
    // reached this client, and the session snapshot still said "invited" — so
    // a teammate who was present and talking showed as ringing for the rest of
    // the call, with nothing to correct it.
    const room = new FakeRoom([new FakeParticipant('user-peer-x1y2', 'Peer Person')]);
    renderGrid(
      room,
      makeCall({
        participants: [
          { userId: 'me', role: 'host', status: 'joined' },
          { userId: 'peer', role: 'member', status: 'invited' },
        ],
      })
    );

    expect(screen.queryByText(/ringing…/)).toBeNull();
  });

  it('marks invited (still ringing) participants without mounting live hooks', () => {
    const room = new FakeRoom([]);
    renderGrid(
      room,
      makeCall({
        participants: [
          { userId: 'me', role: 'host', status: 'joined' },
          { userId: 'peer', role: 'member', status: 'invited' },
        ],
      })
    );

    expect(screen.getByText(/ringing…/)).toBeDefined();
  });

  it('shows a connecting assistant tile until the agent joins, then a live tile', () => {
    const call = makeCall({ assistantIds: [42] });
    const assistantsById = {
      '42': {
        agentId: '42',
        name: 'T-W1N',
        image: null,
        ownerUserId: 'user-1',
        organizationId: 7,
        desktopMode: 'ubuntu' as const,
        managedDesktopStatus: 'active' as const,
      },
    };

    const withoutAgent = renderGrid(new FakeRoom([]), call, assistantsById);
    expect(screen.getByText(/connecting…/)).toBeDefined();
    withoutAgent.unmount();

    const agent = new FakeParticipant('agent-AJ_123', 'unity', {
      unify_assistant_id: '42',
      'lk.agent.state': 'speaking',
    });
    renderGrid(new FakeRoom([agent]), call, assistantsById);
    expect(screen.queryByText(/connecting…/)).toBeNull();
    expect(screen.getByTestId('org-call-assistant-tile')).toBeDefined();
  });
});

describe('OrgCallErrorBoundary', () => {
  it('degrades to the recovery card instead of unmounting the page', () => {
    const Boom = () => {
      throw new Error('render exploded');
    };
    const onLeave = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <OrgCallErrorBoundary onLeave={onLeave}>
        <Boom />
      </OrgCallErrorBoundary>
    );
    spy.mockRestore();

    expect(screen.getByTestId('org-call-error-boundary')).toBeDefined();
    screen.getByTestId('org-call-error-leave').click();
    expect(onLeave).toHaveBeenCalled();
  });
});
