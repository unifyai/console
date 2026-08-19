/**
 * Several people presenting at once on a Meet-stage call.
 *
 * The regression covered here: the stage picked the focused share with
 * `tracks.at(-1)` — the last entry LiveKit happened to list, which is neither
 * stable nor the newest — and rendered exactly one with no way to reach the
 * others. A second person sharing was silently invisible. The attach was also
 * done in a ref callback with no detach, which only survived because the
 * focused track could never change.
 */
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  liveviewShareSid,
  presenterLabel,
  presentingCaption,
  resolveFocusedSid,
  sortSharesByStart,
  trackShareStarts,
  type ShareEntry,
} from '@/utils/assistants/screen-shares';

const mockTracks = vi.hoisted(() => ({ current: [] as unknown[] }));

vi.mock('@livekit/components-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@livekit/components-react')>();
  return {
    ...actual,
    useTracks: () => mockTracks.current,
    useIsSpeaking: () => false,
    useMediaDeviceSelect: () => ({
      devices: [],
      activeDeviceId: '',
      setActiveMediaDevice: vi.fn(),
    }),
  };
});

// Imported after the mock so the component picks up the stubbed hooks.
const { OrgCallMeetStage } = await import('@/components/Pages/Assistants/OrgChat/OrgCallMeetStage');
const { RoomContext } = await import('@livekit/components-react');

// ── Pure selection logic ────────────────────────────────────────────────────

const entry = (sid: string, name = sid, isLocal = false): ShareEntry => ({
  kind: 'track',
  sid,
  presenterName: name,
  isLocal,
});

/** An assistant desktop on the stage — no track, so a synthetic sid. */
const desktopEntry = (assistantId: string, name = assistantId): ShareEntry => ({
  kind: 'liveview',
  sid: liveviewShareSid(assistantId),
  presenterName: name,
  isLocal: false,
  assistantId,
});

describe('screen-share focus selection', () => {
  it('keeps the start time a share already had', () => {
    const shares = [entry('a')];
    const first = trackShareStarts(shares, {}, 1000);
    const second = trackShareStarts(shares, first, 5000);

    expect(second.a).toBe(1000);
  });

  it('stamps only the shares it has not seen before', () => {
    const first = trackShareStarts([entry('a')], {}, 1000);
    const second = trackShareStarts([entry('a'), entry('b')], first, 5000);

    expect(second).toEqual({ a: 1000, b: 5000 });
  });

  it('forgets a share that has ended', () => {
    const known = trackShareStarts([entry('a'), entry('b')], {}, 1000);
    const after = trackShareStarts([entry('b')], known, 2000);

    expect(after).toEqual({ b: 1000 });
  });

  it('orders by start time rather than by array position', () => {
    const shares = [entry('late'), entry('early')];
    const startedAt = { early: 100, late: 900 };

    expect(sortSharesByStart(shares, startedAt).map((s) => s.sid)).toEqual(['early', 'late']);
  });

  it('breaks a same-millisecond tie deterministically', () => {
    const startedAt = { a: 500, b: 500 };
    const one = sortSharesByStart([entry('b'), entry('a')], startedAt);
    const two = sortSharesByStart([entry('a'), entry('b')], startedAt);

    expect(one.map((s) => s.sid)).toEqual(two.map((s) => s.sid));
  });

  it('focuses the newest share when the viewer has not chosen', () => {
    const shares = [entry('old'), entry('new')];

    expect(resolveFocusedSid(shares, null, { old: 100, new: 900 })).toBe('new');
  });

  it('keeps the viewer’s choice when a newer share starts', () => {
    const shares = [entry('old'), entry('new')];

    expect(resolveFocusedSid(shares, 'old', { old: 100, new: 900 })).toBe('old');
  });

  it('falls back to the newest when the chosen share ends', () => {
    const shares = [entry('a'), entry('b')];

    expect(resolveFocusedSid(shares, 'gone', { a: 100, b: 900 })).toBe('b');
  });

  it('reports no focus when nobody is sharing', () => {
    expect(resolveFocusedSid([], 'a', {})).toBeNull();
  });

  it('names the local sharer as the viewer, not by display name', () => {
    expect(presenterLabel(entry('a', 'Me', true))).toBe('You');
    expect(presentingCaption(entry('a', 'Me', true))).toBe('You are presenting');
  });

  it('falls back to Teammate for an unnamed remote sharer', () => {
    expect(presenterLabel(entry('a', ''))).toBe('Teammate');
    expect(presentingCaption(entry('a', ''))).toBe('Teammate is presenting');
  });

  it('names an assistant desktop by the teammate, like any other share', () => {
    // The picker names people, whichever kind of share they have up. The
    // caption is where a desktop reads as the whole machine rather than a
    // window: "Ava is presenting" would say the wrong thing there.
    expect(presenterLabel(desktopEntry('42', 'Ava'))).toBe('Ava');
    expect(presenterLabel(desktopEntry('42', ''))).toBe('Teammate');
    expect(presentingCaption(desktopEntry('42', 'Ava'))).toBe('Ava is showing their desktop');
  });

  it('orders and focuses desktops alongside tracks', () => {
    const shares = [entry('track-a'), desktopEntry('42', 'Ava')];
    const startedAt = { 'track-a': 1000, [liveviewShareSid('42')]: 2000 };

    // Newest wins with no explicit pick, whichever kind it is.
    expect(resolveFocusedSid(shares, null, startedAt)).toBe(liveviewShareSid('42'));
    expect(sortSharesByStart(shares, startedAt).map((s) => s.sid)).toEqual([
      'track-a',
      liveviewShareSid('42'),
    ]);
    // An explicit pick survives across kinds.
    expect(resolveFocusedSid(shares, 'track-a', startedAt)).toBe('track-a');
  });
});

// ── Stage rendering ─────────────────────────────────────────────────────────

class FakeParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  attributes: Record<string, string> = {};
  audioTrackPublications = new Map();
  videoTrackPublications = new Map();
  trackPublications = new Map();
  isSpeaking = false;

  constructor(identity: string, name: string, isLocal = false) {
    this.identity = identity;
    this.name = name;
    this.isLocal = isLocal;
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
  remoteParticipants = new Map();
  localParticipant = new FakeParticipant('user-me-abc', 'Me', true);
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

function fakeShare(sid: string, presenter: string, isLocal = false) {
  const attach = vi.fn();
  const detach = vi.fn();
  return {
    publication: { trackSid: sid, track: { attach, detach } },
    participant: new FakeParticipant(`user-${presenter}-x`, presenter, isLocal),
    attach,
    detach,
  };
}

function renderStage() {
  const room = new FakeRoom();
  return render(
    <RoomContext.Provider value={room as never}>
      <OrgCallMeetStage
        call={
          {
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
            userIds: ['me'],
            assistantIds: [],
            participants: [{ userId: 'me', role: 'host', status: 'joined' }],
            roster: [],
          } as never
        }
        room={room as never}
        roomEpoch={0}
        currentUserId="me"
        humansById={{ me: { userId: 'me', name: 'Me', image: null } }}
        assistantsById={{}}
        localName="Me"
        localImage={null}
        micEnabled
        camEnabled={false}
        screenShareEnabled={false}
        isHost
        addableAssistants={[]}
        onToggleMic={vi.fn()}
        onToggleCam={vi.fn()}
        onToggleScreenShare={vi.fn()}
        onMinimize={vi.fn()}
        onLeave={vi.fn()}
        onEnd={vi.fn()}
        onAddAssistant={vi.fn()}
      />
    </RoomContext.Provider>
  );
}

describe('OrgCallMeetStage presenter focus', () => {
  let now = 1_000;

  beforeEach(() => {
    mockTracks.current = [];
    now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1_000));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows no focus area while nobody is presenting', () => {
    renderStage();

    expect(screen.queryByTestId('org-call-focus')).toBeNull();
    expect(screen.queryByTestId('org-call-presenter-strip')).toBeNull();
  });

  it('shows one share with no picker to choose from', () => {
    mockTracks.current = [fakeShare('sid-a', 'Alice')];
    renderStage();

    expect(screen.getByTestId('org-call-focus')).toBeDefined();
    expect(screen.queryByTestId('org-call-presenter-strip')).toBeNull();
    expect(screen.getByText('Alice is presenting')).toBeDefined();
    expect(screen.getByText(/1 presenting/)).toBeDefined();
  });

  it('offers every presenter once a second screen goes up', () => {
    mockTracks.current = [fakeShare('sid-a', 'Alice'), fakeShare('sid-b', 'Bob')];
    renderStage();

    const options = screen.getAllByTestId('org-call-presenter-option');
    expect(options.map((o) => o.textContent)).toEqual(['Alice', 'Bob']);
    expect(screen.getByText(/2 presenting/)).toBeDefined();
  });

  it('switches the focused share when a presenter is picked', () => {
    const alice = fakeShare('sid-a', 'Alice');
    const bob = fakeShare('sid-b', 'Bob');
    mockTracks.current = [alice, bob];
    renderStage();

    // Alice starts first, so Bob holds the stage as the newest share.
    expect(screen.getByText('Bob is presenting')).toBeDefined();

    fireEvent.click(screen.getAllByTestId('org-call-presenter-option')[0]);

    expect(screen.getByText('Alice is presenting')).toBeDefined();
  });

  it('detaches the previous video when the focus moves', () => {
    const alice = fakeShare('sid-a', 'Alice');
    const bob = fakeShare('sid-b', 'Bob');
    mockTracks.current = [alice, bob];
    renderStage();

    expect(bob.attach).toHaveBeenCalled();
    fireEvent.click(screen.getAllByTestId('org-call-presenter-option')[0]);

    expect(bob.detach).toHaveBeenCalled();
    expect(alice.attach).toHaveBeenCalled();
  });

  it('labels the local sharer as the viewer in the picker', () => {
    mockTracks.current = [fakeShare('sid-a', 'Alice'), fakeShare('sid-me', 'Me', true)];
    renderStage();

    const options = screen.getAllByTestId('org-call-presenter-option');
    expect(options.map((o) => o.textContent)).toContain('You');
  });
});
